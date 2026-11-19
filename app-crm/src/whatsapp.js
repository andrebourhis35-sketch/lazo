import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { now, token, requireThat, text, phone, HttpError, vault } from './core.js';
import { mediaFiles } from './media.js';

const rank = { queued: 0, unknown: 0, accepted: 1, sent: 2, failed: 2.5, delivered: 3, read: 4 };
export function laterStatus(before, after) {
  return (rank[after] ?? -1) > (rank[before] ?? -1) ? after : before;
}
export function validSignature(raw, signature, secret) {
  if (!secret || !/^sha256=[a-f\d]{64}$/i.test(signature || '')) return false;
  return timingSafeEqual(Buffer.from(signature.slice(7), 'hex'), createHmac('sha256', secret).update(raw).digest());
}

export function whatsapp(store, config, fetchImpl = fetch, onIncoming = () => {}) {
  const secrets = vault(config.masterKey);
  const media=mediaFiles(store,config,fetchImpl,credentials);
  function credentials(company) {
    const row = store.get('SELECT * FROM connections WHERE company_id=?', company);
    return row ? { ...row, ...secrets.open(row.config, company) } : null;
  }
  function safe(company) {
    const c=credentials(company);
    return c ? { configured:true, phoneId:c.phone_id, wabaId:c.waba_id, graphVersion:c.graphVersion,
      checkedAt:c.checked, webhookAt:c.webhook_at, webhookVerified:Boolean(c.verified),
      hasAppSecret:Boolean(c.appSecret), testOnly:Boolean(c.testRecipient),
      callbackUrl:`${config.origin}/webhooks/whatsapp`, verifyToken:c.verifyToken } : {configured:false};
  }
  async function graph(c, path, method='GET', body) {
    let response;
    try {
      response=await fetchImpl(`https://graph.facebook.com/${c.graphVersion}/${path}`,{
        method,headers:{Authorization:`Bearer ${c.accessToken}`,'Content-Type':'application/json'},
        body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)
      });
    } catch {
      throw new HttpError(502,'No se pudo confirmar la respuesta de Meta. Revisa el estado antes de volver a enviar.');
    }
    let result;
    try {result=await response.json();} catch {throw new HttpError(502,'Meta devolvió una respuesta no válida.');}
    if (!response.ok || result?.error) {
      const error=new HttpError(502,`Meta rechazó la operación (código ${Number(result?.error?.code)||response.status}). Revisa permisos, token y destinatario de prueba.`);
      error.metaCode=String(result?.error?.code||response.status);throw error;
    }
    return result;
  }
  function saveRaw(company,c,verified=0) {
    const existing=store.get('SELECT company_id FROM connections WHERE phone_id=?',c.phoneId);
    requireThat(!existing||existing.company_id===company,'Ese número ya está conectado a otra empresa.',409);
    store.run('INSERT INTO connections(company_id,phone_id,waba_id,config,checked,verified) VALUES(?,?,?,?,?,?) ON CONFLICT(company_id) DO UPDATE SET phone_id=excluded.phone_id,waba_id=excluded.waba_id,config=excluded.config,checked=excluded.checked,verified=excluded.verified',
      company,c.phoneId,c.wabaId,secrets.seal(c,company),now(),verified);
  }
  function providerWebhookReady(secret){
    return Boolean(secret)&&store.all('SELECT company_id FROM connections WHERE verified=1').some(row=>credentials(row.company_id)?.appSecret===secret);
  }
  async function connect(company,data,actor,ensureCurrent=()=>{},verifiedProvider=false) {
    const old=credentials(company);
    const c={ accessToken:text(data.accessToken||old?.accessToken||'',4096,true),appSecret:text(data.appSecret||old?.appSecret||'',256),
      phoneId:text(data.phoneId||old?.phone_id||'',50,true),wabaId:text(data.wabaId||old?.waba_id||'',50,true),
      graphVersion:text(data.graphVersion||old?.graphVersion||'',12,true),verifyToken:old?.verifyToken||token(),
      testRecipient:old?.testRecipient||config.testRecipient||'' };
    requireThat(/^\d+$/.test(c.phoneId)&&/^\d+$/.test(c.wabaId)&&/^v\d+\.\d+$/.test(c.graphVersion),'Revisa los identificadores y la versión de la API.');
    requireThat(!old||(old.phone_id===c.phoneId&&old.waba_id===c.wabaId),
      'Para conectar otro número o cuenta, crea un espacio de empresa separado en Conexiones. La conexión actual conserva su historial y sus flujos.',409);
    requireThat(!c.testRecipient||/^\d{8,15}$/.test(c.testRecipient),'Destinatario de prueba no válido.');
    const phones=await graph(c,`${c.wabaId}/phone_numbers?fields=id&limit=100`);
    requireThat(phones.data?.some(p=>p.id===c.phoneId),'El número no pertenece a esta cuenta de WhatsApp.');
    ensureCurrent();
    requireThat(!verifiedProvider||providerWebhookReady(c.appSecret),'El webhook del proveedor todavía no está verificado.',409);
    const current=store.get('SELECT config FROM connections WHERE company_id=?',company);
    requireThat((current?.config||null)===(old?.config||null),'La conexión cambió mientras se comprobaba. Recarga Conexiones antes de guardar.',409);
    saveRaw(company,c,verifiedProvider?1:old?.phone_id===c.phoneId&&old?.appSecret===c.appSecret?old.verified:0);
    store.audit(company,actor,'whatsapp.connected');return safe(company);
  }
  async function templates(company) {
    const c=credentials(company);requireThat(c,'Conecta WhatsApp en Ajustes.',409);
    const result=await graph(c,`${c.waba_id}/message_templates?fields=name,language,status,components&limit=100`);
    return (result.data||[]).filter(t=>t.status==='APPROVED'&&(t.components||[]).every(part=>part.type==='BODY'||part.type==='FOOTER'||(part.type==='HEADER'&&part.format==='TEXT'&&!/{{/.test(part.text||''))))
      .map(t=>({name:t.name,language:t.language,body:t.components?.find(p=>p.type==='BODY')?.text||'',parameters:[...new Set((t.components?.find(p=>p.type==='BODY')?.text||'').match(/{{\d+}}/g)||[])].length}));
  }
  async function send(company,contactId,data,actor) {
    const c=credentials(company);requireThat(c,'Conecta WhatsApp en Ajustes.',409);
    const contact=store.contact(company,contactId);
    requireThat(!c.testRecipient||contact.phone===c.testRecipient,'Solo se puede enviar al destinatario de prueba autorizado.',403);
    requireThat(typeof data.clientId==='string'&&/^[a-zA-Z\d-]{12,80}$/.test(data.clientId),'Identificador de envío no válido.');
    const old=store.get('SELECT * FROM messages WHERE company_id=? AND client_id=?',company,data.clientId);
    if(old) {requireThat(old.contact_id===contactId,'El identificador del envío ya pertenece a otra conversación.',409);return old;}
    let payload,body,type=data.type,attachment=null;
    if(type==='text') {
      requireThat(contact.last_inbound>now()-24*60*60*1000,'Para iniciar o reabrir una conversación, utiliza una plantilla aprobada.');
      body=text(data.text,4000,true);payload={type:'text',text:{preview_url:false,body}};
    } else if(type==='image'||type==='document') {
      requireThat(contact.last_inbound>now()-24*60*60*1000,'Para enviar un archivo, espera un mensaje del contacto o usa una plantilla aprobada.');
      requireThat(data.file&&((type==='image'&&data.file.mime?.startsWith('image/'))||(type==='document'&&data.file.mime==='application/pdf')),'Archivo no válido.');
      body=text(data.text||'',1024);
    } else {
      requireThat(type==='template','Tipo de mensaje no válido.');
      const available=await templates(company);
      const template=available.find(t=>t.name===data.templateName&&t.language===data.language);
      requireThat(template,'Elige una plantilla aprobada de la cuenta.');
      const parameters=data.parameters||[];
      requireThat(Array.isArray(parameters)&&parameters.length===template.parameters,'Completa los valores de la plantilla.');
      const values=parameters.map(p=>text(p,500,true));
      body=template.body.replace(/{{(\d+)}}/g,(_,i)=>values[Number(i)-1]||'');
      payload={type:'template',template:{name:template.name,language:{code:template.language}}};
      if(values.length) payload.template.components=[{type:'body',parameters:values.map(value=>({type:'text',text:value}))}];
    }
    // No SQLite transaction is kept open during a network request. Reserve the client ID first.
    const reserved=store.get('SELECT * FROM messages WHERE company_id=? AND client_id=?',company,data.clientId);
    if(reserved){requireThat(reserved.contact_id===contactId,'El identificador del envío ya pertenece a otra conversación.',409);return reserved;}
    const id=randomUUID(),time=now();
    store.run("INSERT INTO messages(id,company_id,contact_id,direction,body,type,status,client_id,created,updated) VALUES(?,?,?,'out',?,?,'queued',?,?,?)",id,company,contactId,body,type,data.clientId,time,time);
    let sending=false;
    try {
      if(type==='image'||type==='document') {
        attachment=media.saveUpload(company,data.file);
        store.run('UPDATE messages SET attachment_id=? WHERE company_id=? AND id=?',attachment,company,id);
        const uploaded=await media.upload(company,attachment,c);
        payload={type,[type]:{id:uploaded.id,...(body?{caption:body}:{}),...(type==='document'?{filename:uploaded.filename}:{})}};
        if(!body)store.run('UPDATE messages SET body=? WHERE company_id=? AND id=?',type==='image'?'Imagen':uploaded.filename,company,id);
      }
      sending=true;
      const result=await graph(c,`${c.phone_id}/messages`,'POST',{messaging_product:'whatsapp',recipient_type:'individual',to:contact.phone,...payload});
      const waId=result.messages?.[0]?.id;
      requireThat(typeof waId==='string','Meta no confirmó el identificador del mensaje.',502);
      const event=store.get('SELECT * FROM status_events WHERE company_id=? AND wa_id=?',company,waId);
      const status=laterStatus('accepted',event?.status||'accepted');
      store.run('UPDATE messages SET wa_id=?,status=?,error_code=?,updated=? WHERE id=? AND company_id=?',waId,status,event?.error_code||null,now(),id,company);
      store.run('UPDATE contacts SET resolved=0,updated=? WHERE company_id=? AND id=?',now(),company,contactId);
      store.audit(company,actor,'message.sent');
    } catch(error) {
      store.run('UPDATE messages SET status=?,error_code=?,updated=? WHERE id=? AND company_id=?',!sending||error.metaCode?'failed':'unknown',error.metaCode||null,now(),id,company);
      throw error;
    }
    return store.get('SELECT * FROM messages WHERE company_id=? AND id=?',company,id);
  }
  function verify(query) {
    const rows=store.all('SELECT company_id FROM connections');
    const c=rows.map(r=>credentials(r.company_id)).find(c=>c.verifyToken===query.get('hub.verify_token'));
    requireThat(c&&query.get('hub.mode')==='subscribe'&&c.appSecret,'Verificación no válida.',403);
    const challenge=query.get('hub.challenge');requireThat(challenge&&/^\d{1,100}$/.test(challenge),'Challenge no válido.');
    store.run('UPDATE connections SET verified=1 WHERE company_id=?',c.company_id);return challenge;
  }
  function receive(raw,signature) {
    const cs=store.all('SELECT company_id FROM connections').map(r=>credentials(r.company_id));
    requireThat(cs.some(c=>validSignature(raw,signature,c.appSecret)),'Firma de Meta no válida.',403);
    let event;try{event=JSON.parse(raw);}catch{throw new HttpError(400,'JSON no válido.');}
    requireThat(event.object==='whatsapp_business_account'&&Array.isArray(event.entry),'Evento no válido.');
    return store.tx(()=>{
      for(const entry of event.entry) for(const change of entry.changes||[]) {
        if(change.field!=='messages')continue;
        const value=change.value;
        const c=cs.find(c=>c.phone_id===value?.metadata?.phone_number_id&&c.waba_id===entry.id);
        if(!c||!validSignature(raw,signature,c.appSecret))continue;
        store.run('UPDATE connections SET webhook_at=? WHERE company_id=?',now(),c.company_id);
        for(const msg of value.messages||[]) {
          if(typeof msg.id!=='string'||store.get('SELECT 1 FROM messages WHERE wa_id=?',msg.id))continue;
          if(!/^\d{8,15}$/.test(msg.from||'')||(c.testRecipient&&msg.from!==c.testRecipient))continue;
          const created=Math.min(now(),Number(msg.timestamp)*1000||now());
          let contact=store.get('SELECT * FROM contacts WHERE company_id=? AND phone=?',c.company_id,msg.from);
          if(!contact) {
            const user=store.get("SELECT user_id FROM memberships WHERE company_id=? AND role='owner' LIMIT 1",c.company_id);
            const name=value.contacts?.find(p=>p.wa_id===msg.from)?.profile?.name||msg.from;
            contact=store.addContact(c.company_id,{name:String(name).slice(0,80),phone:msg.from},user.user_id);
          }
          const part=msg[msg.type],attachment=media.incoming(c.company_id,msg.type,part,created);
          const body=msg.type==='text'?String(msg.text?.body||'').slice(0,4000):attachment?String(part.caption||part.filename||(msg.type==='image'?'Imagen':'Documento PDF')).slice(0,1024):`[Mensaje recibido: ${String(msg.type||'desconocido').slice(0,30)}]`;
          const messageId=randomUUID();
          store.run("INSERT INTO messages(id,company_id,contact_id,direction,body,type,status,wa_id,created,updated,attachment_id) VALUES(?,?,?,'in',?,?,'received',?,?,?,?)",messageId,c.company_id,contact.id,body,msg.type||'other',msg.id,created,now(),attachment);
          store.run('UPDATE contacts SET unread=unread+1,resolved=0,last_inbound=MAX(last_inbound,?),updated=MAX(updated,?) WHERE id=? AND company_id=?',created,created,contact.id,c.company_id);
          onIncoming({id:messageId,company_id:c.company_id,contact_id:contact.id,body,type:msg.type||'other',created});
        }
        for(const status of value.statuses||[]) {
          if(!['sent','delivered','read','failed'].includes(status.status)||typeof status.id!=='string')continue;
          const old=store.get('SELECT * FROM status_events WHERE wa_id=?',status.id);
          if(old&&old.company_id!==c.company_id)continue;
          const state=laterStatus(old?.status||'queued',status.status),code=String(status.errors?.[0]?.code||'')||null;
          store.run('INSERT INTO status_events(wa_id,company_id,status,error_code,updated) VALUES(?,?,?,?,?) ON CONFLICT(wa_id) DO UPDATE SET status=excluded.status,error_code=excluded.error_code,updated=excluded.updated',status.id,c.company_id,state,code,now());
          const message=store.get('SELECT * FROM messages WHERE company_id=? AND wa_id=?',c.company_id,status.id);
          if(message)store.run('UPDATE messages SET status=?,error_code=?,updated=? WHERE id=? AND company_id=?',laterStatus(message.status,state),code,now(),message.id,c.company_id);
        }
      }
      return {ok:true};
    });
  }
  async function subscribe(company,actor) {
    const c=credentials(company);requireThat(c?.appSecret&&c.verified,'Guarda el secreto y verifica primero la URL de devolución en Meta.');
    const result=await graph(c,`${c.waba_id}/subscribed_apps`,'POST',{});
    requireThat(result.success===true,'Meta no confirmó la suscripción de la app a esta cuenta.',502);
    store.audit(company,actor,'whatsapp.subscribed');return {ok:true};
  }
  return {credentials,safe,connect,send,templates,verify,receive,subscribe,saveRaw,media,providerWebhookReady};
}
