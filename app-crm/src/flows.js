import { randomUUID } from 'node:crypto';
import { HttpError, now, requireThat, digest } from './core.js';
import { flowSales } from './flow-sales.js';
import { parseDraft, validateFlow, outputsFor } from './flow-model.js';

const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const buttonLifetime = 24 * 60 * 60 * 1000;
const sendKey = (run, nodeId) => 'flow-'+digest(run.id+':'+nodeId+(run.visits?':'+run.visits:''));
const tagKey = value => value.trim().toLocaleLowerCase('es');
export function automationFlows(store, wa, ai) {
  const sales=flowSales(store,wa);
  const saleKinds=new Set(['plan','charge','confirm','deliver']);
  let task=null, stopping=false;
  const get = (company,id) => { const row=store.get('SELECT * FROM flows WHERE company_id=? AND id=?',company,id);requireThat(row,'Flujo no encontrado.',404);return row; };
  const safe = row => ({id:row.id,revision:row.revision,publishedRevision:row.published_revision,active:Boolean(row.active),updated:row.updated,graph:JSON.parse(row.draft),phoneIds:JSON.parse(row.draft_numbers),activePhoneIds:row.active?JSON.parse(row.published_numbers):[]});
  const list = company => store.all('SELECT * FROM flows WHERE company_id=? ORDER BY created,id',company).map(safe);
  const trace = (run,label,detail,messageId=null) => store.run('INSERT INTO flow_steps(run_id,label,detail,message_id,created) VALUES(?,?,?,?,?)',run.id,label,detail,messageId,now());
  const cancelReminder = (company,contact,reason) => store.run("UPDATE flow_runs SET state='cancelled',reason=?,updated=? WHERE company_id=? AND contact_id=? AND due IS NOT NULL AND state IN ('scheduled','pending','running')",reason,now(),company,contact);
  function setAutomation(company,contact,paused,actor) {
    store.contact(company,contact);
    store.tx(()=>{
      store.run('UPDATE contacts SET automation_paused=? WHERE company_id=? AND id=?',Number(paused),company,contact);
      if(paused)store.run("UPDATE flow_runs SET state='cancelled',reason='El equipo tomó la conversación.',updated=? WHERE company_id=? AND contact_id=? AND state IN ('pending','scheduled','delayed','agent_wait','payment_wait','running','waiting')",now(),company,contact);
      store.audit(company,actor,paused?'flow.contact-paused':'flow.contact-resumed');
    });
    return {paused};
  }
  function contactHistory(company,contact) {
    return store.all(`SELECT r.id,r.state,r.reason,r.updated,json_extract(r.snapshot,'$.name') AS name FROM flow_runs r
      WHERE r.company_id=? AND r.contact_id=? ORDER BY r.created DESC,r.id DESC LIMIT 10`,company,contact).map(run=>({...run,steps:store.all(`SELECT s.label,s.detail,s.created,m.body,m.status FROM flow_steps s
      LEFT JOIN messages m ON m.id=s.message_id AND m.company_id=? AND m.contact_id=?
      WHERE s.run_id=? ORDER BY s.id DESC LIMIT 60`,company,contact,run.id).reverse()}));
  }
  function graph(value) {
    let result;try { result=parseDraft(JSON.stringify(value)); } catch { requireThat(false,'Revisa el formato y el tamaño del flujo.'); }
    requireThat(result.name.trim(),'Ponle un nombre al flujo.');return result;
  }
  function save(company,id,data,actor) {
    const draft=JSON.stringify(graph(data.graph)),time=now();
    const old=id?get(company,id):null;
    const numbers=store.numbers(company).map(row=>row.phone_id);
    const phoneIds=data.phoneIds??(old?JSON.parse(old.draft_numbers):numbers.length===1?numbers:[]);
    requireThat(Array.isArray(phoneIds)&&phoneIds.every(phoneId=>numbers.includes(phoneId)),'Elige números vinculados a este espacio.');
    const draftNumbers=JSON.stringify([...new Set(phoneIds)].sort());
    if(old) {
      requireThat(Number.isInteger(data.revision)&&old.revision===data.revision,'Otra pestaña modificó este flujo. Vuelve a abrirlo antes de guardar.',409);
      store.run('UPDATE flows SET draft=?,draft_numbers=?,revision=revision+1,updated=? WHERE company_id=? AND id=?',draft,draftNumbers,time,company,id);
    } else {
      requireThat(list(company).length<30,'Puedes guardar hasta treinta flujos por empresa.');id=randomUUID();
      store.run('INSERT INTO flows(id,company_id,draft,draft_numbers,created,updated) VALUES(?,?,?,?,?,?)',id,company,draft,draftNumbers,time,time);
    }
    store.audit(company,actor,'flow.saved');return safe(get(company,id));
  }
  function publish(company,id,data,actor) {
    const row=get(company,id);requireThat(data.revision===row.revision,'Guarda y vuelve a revisar la versión actual.',409);
    const draft=graph(JSON.parse(row.draft)),errors=validateFlow(draft);requireThat(!errors.length,errors[0]||'Completa el flujo.');
    requireThat(draft.nodes.length<=20&&draft.nodes.every(n=>['trigger','message','buttons','tag','assign','handoff','reminder','back','end','ai','wait','plan','charge','confirm','deliver'].includes(n.data.kind)),'Las condiciones de texto siguen en simulación. Usa botones para elegir una rama real.');
    const menus=draft.nodes.filter(n=>n.data.kind==='buttons');
    const agents=draft.nodes.filter(node=>node.data.kind==='ai');
    requireThat(agents.length<=1,'Usa un agente IA por flujo.');
    if(agents.length) {
      requireThat(ai.settings(company).enabled,'Habilita Agente IA en Ajustes antes de activar este flujo.');
      const handoff=draft.edges.find(edge=>edge.source===agents[0].id&&edge.sourceHandle==='handoff');
      requireThat(draft.nodes.find(node=>node.id===handoff?.target)?.data.kind==='handoff','Conecta la salida Asesor al bloque Traspasar a asesor.');
    }
    requireThat(menus.length||agents.length||draft.nodes.some(node=>node.data.kind==='message'),'Añade un mensaje, un menú o un agente IA.');
    requireThat(draft.nodes.every(node=>node.data.kind!=='wait'||Number(node.data.value)<=1380),'La espera real admite hasta 1380 minutos.');

    for(const node of draft.nodes.filter(n=>n.data.kind==='reminder')) {
      const next=draft.edges.find(edge=>edge.source===node.id);
      requireThat(draft.nodes.find(n=>n.id===next?.target)?.data.kind==='message','Conecta cada espera sin respuesta a un mensaje de seguimiento.');
    }
    const start=draft.nodes.find(n=>n.data.kind==='trigger');requireThat(start.data.value.trim(),'La ejecución real requiere una palabra clave.');
    requireThat(new Set(draft.nodes.filter(n=>n.data.kind==='tag').map(n=>tagKey(n.data.value))).size<=8,'El flujo admite hasta ocho etiquetas distintas.');
    for(const node of draft.nodes) {
      if(node.data.kind==='tag')requireThat(node.data.value.trim().length<=30&&!/[,\x00-\x1f]/.test(node.data.value),'La etiqueta admite hasta treinta caracteres, sin comas ni saltos.');
      if(['assign','handoff'].includes(node.data.kind))requireThat(store.get('SELECT 1 FROM memberships WHERE company_id=? AND user_id=?',company,node.data.value),'Selecciona un asesor de esta empresa.');
    }
    const numbers=JSON.parse(row.draft_numbers);
    requireThat(numbers.length,'Elige al menos un número y guarda el flujo.');
    for(const phoneId of numbers){
      const connection=wa.credentials(company,phoneId);
      requireThat(connection?.testRecipient&&connection.appSecret&&connection.verified,'Esta fase requiere números de prueba con webhook verificado.');
    }
    if(row.active&&row.published_revision===row.revision&&row.actor_id===actor)return safe(row);
    store.tx(()=>{
      requireThat(!store.get(`SELECT 1 FROM flows f, json_each(f.published_numbers) n
        WHERE f.company_id=? AND f.active=1 AND f.id<>? AND n.value IN (SELECT value FROM json_each(?))`,
        company,id,row.draft_numbers),'Pausa el otro flujo activo que usa uno de estos números.',409);
      store.run('UPDATE flows SET published=draft,published_numbers=draft_numbers,published_revision=revision,activation=activation+1,active=1,actor_id=?,updated=? WHERE company_id=? AND id=?',actor,now(),company,id);
      store.run("UPDATE flow_runs SET state='cancelled',reason='Nueva versión activada',updated=? WHERE flow_id=? AND state IN ('pending','waiting','scheduled','delayed','agent_wait','payment_wait')",now(),id);
      store.audit(company,actor,'flow.activated');
    });return safe(get(company,id));
  }
  function pause(company,id,actor) {
    get(company,id);store.tx(()=>{store.run('UPDATE flows SET active=0,updated=? WHERE company_id=? AND id=?',now(),company,id);store.run("UPDATE flow_runs SET state='cancelled',reason='Flujo pausado',updated=? WHERE company_id=? AND flow_id=? AND state IN ('pending','waiting','scheduled','delayed','agent_wait','payment_wait')",now(),company,id);store.audit(company,actor,'flow.paused');});return safe(get(company,id));
  }
  function enqueue(message) {
    if(message.created<now()-5*60000)return;
    const cancelled=cancelReminder(message.company_id,message.contact_id,'El contacto respondió.');
    const contact=store.contact(message.company_id,message.contact_id);
    if(contact.automation_paused)return;
    if(message.type==='text'&&/\b(stop|baja|cancelar)\b/.test(normalize(message.body))) {
      store.run("UPDATE flow_runs SET state='cancelled',reason='El contacto pidió detener la automatización.',due=NULL,updated=? WHERE company_id=? AND contact_id=? AND state IN ('pending','running','waiting','scheduled','delayed','agent_wait','payment_wait')",now(),message.company_id,message.contact_id);
      return;
    }
    if(sales.enqueue(message))return;
    if(message.type==='interactive') {
      const match=/^lazo:([a-f0-9-]{36}):(option-[123])$/.exec(message.buttonId||'');
      if(!match||!message.contextId)return;
      const [,id,option]=match;
      const run=store.get("SELECT * FROM flow_runs WHERE id=? AND company_id=? AND contact_id=? AND state='waiting' AND updated>?",id,message.company_id,message.contact_id,now()-buttonLifetime);
      if(!run)return;
      const menu=store.get("SELECT 1 FROM messages WHERE company_id=? AND contact_id=? AND client_id=? AND wa_id=? AND direction='out'",run.company_id,run.contact_id,sendKey(run,run.step),message.contextId);
      if(!menu)return;
      const edge=JSON.parse(run.snapshot).edges.find(edge=>edge.source===run.step&&edge.sourceHandle===option);
      if(edge) {
        store.run("UPDATE flow_runs SET state='pending',step=?,message_id=?,updated=? WHERE id=? AND state='waiting'",edge.target,message.id,now(),id);
        const node=JSON.parse(run.snapshot).nodes.find(node=>node.id===run.step);
        trace(run,node.data.label,'Eligió «'+node.data.choices[Number(option.at(-1))-1]+'»',message.id);
      }
      return;
    }
    if(message.type!=='text')return;
    const value=normalize(message.body);
    const waitingAgent=store.get("SELECT id FROM flow_runs WHERE company_id=? AND contact_id=? AND state='agent_wait' AND updated>? ORDER BY updated DESC LIMIT 1",message.company_id,message.contact_id,now()-buttonLifetime);
    if(waitingAgent) {
      store.run("UPDATE flow_runs SET state='pending',message_id=?,updated=? WHERE id=? AND state='agent_wait'",message.id,now(),waitingAgent.id);
      return;
    }
    if(Number(cancelled.changes))return;
    const row=store.get(`SELECT f.* FROM flows f, json_each(f.published_numbers) n
      WHERE f.company_id=? AND f.active=1 AND n.value=?`,message.company_id,contact.phone_id);if(!row)return;
    const draft=JSON.parse(row.published),start=draft.nodes.find(n=>n.data.kind==='trigger');
    if(!value.includes(normalize(start.data.value)))return;
    if(store.get("SELECT 1 FROM flow_runs WHERE company_id=? AND contact_id=? AND (created>? OR (state IN ('waiting','agent_wait','delayed') AND updated>?))",message.company_id,message.contact_id,now()-60000,now()-buttonLifetime))return;
    if(store.get("SELECT count(*) n FROM flow_runs WHERE company_id=? AND state IN ('pending','running','waiting','scheduled','delayed','agent_wait')",message.company_id).n>=100)return;
    const time=now();store.run("INSERT OR IGNORE INTO flow_runs(id,company_id,flow_id,contact_id,message_id,revision,activation,snapshot,state,created,updated) VALUES(?,?,?,?,?,?,?,?,'pending',?,?)",randomUUID(),message.company_id,row.id,message.contact_id,message.id,row.published_revision,row.activation,row.published,time,time);
  }
  function runs(company,id) {
    get(company,id);
    return store.all(`SELECT r.id,r.state,r.step,r.reason,r.created,r.updated,r.due,r.revision,c.name AS contact,
      (SELECT json_extract(n.value,'$.data.label') FROM json_each(r.snapshot,'$.nodes') n WHERE json_extract(n.value,'$.id')=r.step) AS block
      FROM flow_runs r JOIN contacts c ON c.id=r.contact_id AND c.company_id=r.company_id
      WHERE r.company_id=? AND r.flow_id=? ORDER BY r.created DESC,r.id DESC LIMIT 30`,company,id).map(run=>({
      ...run,steps:store.all(`SELECT s.label,s.detail,s.created,m.status FROM flow_steps s
        LEFT JOIN messages m ON m.id=s.message_id AND m.company_id=?
        WHERE s.run_id=? ORDER BY s.id DESC LIMIT 25`,company,run.id).reverse(),
    }));
  }
  function permitted(run) {
    const current=store.get('SELECT * FROM flows WHERE company_id=? AND id=?',run.company_id,run.flow_id);
    return store.get("SELECT 1 FROM flow_runs WHERE id=? AND company_id=? AND state='running'",run.id,run.company_id)&&current?.active&&current.published_revision===run.revision&&current.activation===run.activation&&store.get("SELECT 1 FROM memberships WHERE company_id=? AND user_id=? AND role IN ('owner','admin')",run.company_id,current.actor_id)?current:null;
  }
  async function execute(run) {
    const claimed=store.run("UPDATE flow_runs SET state='running',updated=? WHERE id=? AND state='pending'",now(),run.id);
    if(Number(claimed.changes)!==1)return;
    try {
      const draft=JSON.parse(run.snapshot);
      const menus=JSON.parse(run.menus);
      let node=draft.nodes.find(n=>run.step?n.id===run.step:n.data.kind==='trigger');
      const initialContact=store.contact(run.company_id,run.contact_id);
      requireThat(initialContact.phone_id&&wa.credentials(run.company_id,initialContact.phone_id)?.testRecipient,'La automatización requiere una cuenta de prueba.');
      requireThat(!initialContact.automation_paused,'El equipo está atendiendo esta conversación.');
      const plannedTags=new Set([...JSON.parse(initialContact.tags||'[]'),...draft.nodes.filter(n=>n.data.kind==='tag').map(n=>n.data.value)].map(tagKey));
      requireThat(plannedTags.size<=8,'El contacto no tiene espacio para las etiquetas del flujo.');
      for(const assignment of draft.nodes.filter(n=>['assign','handoff'].includes(n.data.kind)))requireThat(store.get('SELECT 1 FROM memberships WHERE company_id=? AND user_id=?',run.company_id,assignment.data.value),'El asesor ya no pertenece a la empresa.');
      while(node) {
        const owner=permitted(run);requireThat(owner,'Flujo pausado, versión sustituida o acceso retirado.',409);
        const contact=store.contact(run.company_id,run.contact_id),source=store.get("SELECT id,rowid,type,body FROM messages WHERE company_id=? AND id=? AND direction='in'",run.company_id,run.message_id);
        requireThat(source,'El mensaje de origen ya no está disponible.',409);
        requireThat(++run.visits<=60,'Se alcanzó el límite del recorrido.');
        store.run('UPDATE flow_runs SET visits=?,step=?,updated=? WHERE id=?',run.visits,node.id,now(),run.id);
        const edge=draft.edges.find(e=>e.source===node.id);
        if(saleKinds.has(node.data.kind)) {
          const result=await sales.execute(run,node,owner.actor_id);
          trace(run,node.data.label,result.detail,result.messageId);
          if(result.pause)return;
        }
        if(node.data.kind==='wait') {
          const due=now()+Number(node.data.value)*60000;
          if(due>=contact.last_inbound+buttonLifetime) {
            store.run("UPDATE flow_runs SET state='cancelled',reason='La espera excede la ventana de WhatsApp.',updated=? WHERE id=?",now(),run.id);
            return;
          }
          store.run("UPDATE flow_runs SET state='delayed',step=?,due=?,updated=? WHERE id=?",edge.target,due,now(),run.id);
          trace(run,node.data.label,'Pausa programada');
          return;
        }
        if(node.data.kind==='reminder') {
          const won=store.get('SELECT is_won FROM pipeline_stages WHERE company_id=? AND name=?',run.company_id,contact.stage)?.is_won;
          const newInbound=store.get("SELECT 1 FROM messages WHERE company_id=? AND contact_id=? AND direction='in' AND rowid>?",run.company_id,contact.id,source.rowid);
          if(won||newInbound) {
            store.run("UPDATE flow_runs SET state='cancelled',reason=?,updated=? WHERE id=?",won?'Venta ganada.':'El contacto respondió.',now(),run.id);
            return;
          }
          const due=now()+Number(node.data.value)*60000;
          if(due>=contact.last_inbound+buttonLifetime) {
            store.run("UPDATE flow_runs SET state='cancelled',reason='La espera excede la ventana de WhatsApp.',updated=? WHERE id=?",now(),run.id);
            return;
          }
          store.run("UPDATE flow_runs SET state='scheduled',step=?,due=?,updated=? WHERE id=?",edge.target,due,now(),run.id);
          trace(run,node.data.label,'Seguimiento programado');
          return;
        }
        if(node.data.kind==='back') {
          menus.pop();
          const previous=menus.pop();
          if(!previous) {
            store.run("UPDATE flow_runs SET state='cancelled',reason='No hay un menú anterior.',updated=? WHERE id=?",now(),run.id);
            return;
          }
          trace(run,node.data.label,'Volvió al menú anterior');
          node=draft.nodes.find(n=>n.id===previous);
          continue;
        }
        if(node.data.kind==='ai') {
          const prior=store.get("SELECT m.body FROM flow_steps s JOIN messages m ON m.id=s.message_id WHERE s.run_id=? AND s.detail='Pidió un dato adicional' ORDER BY s.id DESC LIMIT 1",run.id);
          const result=source.type==='text'
            ?await ai.reply(run.company_id,{knowledge:node.data.value,message:source.body,previousQuestion:prior?.body||''})
            :{decision:'clarify',text:'¿En qué podemos ayudarte? Cuéntanos tu consulta en un mensaje.'};
          requireThat(permitted(run),'El equipo tomó la conversación o cambió la versión.',409);
          let outcome=result.decision;
          if(outcome==='clarify'&&prior)outcome='handoff';
          if(outcome!=='handoff') {
            const sent=await wa.send(run.company_id,run.contact_id,{type:'text',text:result.text,clientId:sendKey(run,node.id)},owner.actor_id,{flow:true});
            const accepted=['accepted','sent','delivered','read'].includes(sent.status);
            if(accepted)trace(run,node.data.label,outcome==='clarify'?'Pidió un dato adicional':'Respondió con IA',sent.id);
            else outcome='handoff';
            requireThat(permitted(run),'El equipo tomó la conversación o cambió la versión.',409);
            if(outcome==='clarify') {
              store.run("UPDATE flow_runs SET state='agent_wait',updated=? WHERE id=?",now(),run.id);
              return;
            }
          }
          const branch=outcome==='handoff'?'handoff':'answered';
          if(branch==='handoff')trace(run,node.data.label,result.reason||'La consulta requiere un asesor.');
          const target=draft.edges.find(edge=>edge.source===node.id&&edge.sourceHandle===branch)?.target;
          node=draft.nodes.find(item=>item.id===target);
          continue;
        }
        if(node.data.kind==='message') {
          const result=await wa.send(run.company_id,run.contact_id,{type:'text',text:node.data.value.replaceAll('{{nombre}}',contact.name),clientId:sendKey(run,node.id)},owner.actor_id,{flow:true});
          requireThat(['accepted','sent','delivered','read'].includes(result.status),'El envío no quedó confirmado. Revisa la conversación antes de repetir.',409);
          trace(run,node.data.label,'Mensaje enviado',result.id);
          if(run.due)store.run('UPDATE flow_runs SET due=NULL WHERE id=?',run.id);
        }
        if(node.data.kind==='buttons') {
          const buttons=outputsFor(node.data).map((output,index)=>({id:'lazo:'+run.id+':'+output,title:node.data.choices[index].trim()}));
          const result=await wa.send(run.company_id,run.contact_id,{
            type:'interactive',text:node.data.value.replaceAll('{{nombre}}',contact.name),buttons,clientId:sendKey(run,node.id),
          },owner.actor_id,{flow:true});
          requireThat(result.wa_id&&['accepted','sent','delivered','read'].includes(result.status),'Meta no confirmó el menú.',409);
          requireThat(permitted(run),'Flujo pausado, versión sustituida o acceso retirado.',409);
          menus.push(node.id);
          store.run("UPDATE flow_runs SET state='waiting',menus=?,updated=? WHERE id=? AND state='running'",JSON.stringify(menus),now(),run.id);
          trace(run,node.data.label,'Menú enviado',result.id);
          return;
        }
        if(node.data.kind==='tag') {const tags=JSON.parse(contact.tags||'[]');if(!tags.some(t=>tagKey(t)===tagKey(node.data.value)))tags.push(node.data.value);store.updateContact(run.company_id,contact.id,{tags},owner.actor_id);}
        if(node.data.kind==='assign')store.updateContact(run.company_id,contact.id,{ownerId:node.data.value},owner.actor_id);
        if(node.data.kind==='handoff') {
          store.updateContact(run.company_id,contact.id,{ownerId:node.data.value},owner.actor_id);
          store.tx(()=>{
            store.run('UPDATE contacts SET automation_paused=1 WHERE company_id=? AND id=?',run.company_id,contact.id);
            store.run("UPDATE flow_runs SET state='done',reason='Traspasado a un asesor.',updated=? WHERE id=?",now(),run.id);
            trace(run,node.data.label,'Chat asignado y automatización pausada');
          });
          return;
        }
        if(node.data.kind==='end'){
          store.tx(()=>{
            trace(run,node.data.label,'Recorrido finalizado');
            store.run("UPDATE flow_runs SET state='done',updated=? WHERE id=?",now(),run.id);
          });
          return;
        }
        if(['trigger','tag','assign'].includes(node.data.kind))trace(run,node.data.label,'Paso ejecutado');
        requireThat(permitted(run),'Flujo pausado, versión sustituida o acceso retirado.',409);
        node=draft.nodes.find(n=>n.id===edge?.target);
      }
      throw new Error('Recorrido incompleto');
    } catch(error) {
      const reason=error instanceof HttpError?error.message:'Ejecución detenida. Revisa el último bloque antes de repetir.';
      store.run("UPDATE flow_runs SET state=?,reason=?,updated=? WHERE id=? AND state='running'",permitted(run)?'failed':'cancelled',reason,now(),run.id);
    }
  }
  function recover() {store.run("UPDATE flow_runs SET state='interrupted',reason='El servicio se reinició durante la ejecución; no se reintenta automáticamente.',updated=? WHERE state='running'",now());}
  function flush() {
    if(task||stopping)return task||Promise.resolve();
    task=(async()=>{
      store.run("UPDATE flow_runs SET state='cancelled',reason='El menú venció sin respuesta.',updated=? WHERE state IN ('waiting','agent_wait') AND updated<=?",now(),now()-buttonLifetime);
      store.run("UPDATE flow_runs SET state='pending' WHERE state='scheduled' AND due<=?",now());
      store.run("UPDATE flow_runs SET state='pending',due=NULL WHERE state='delayed' AND due<=?",now());
      for(const order of store.all("SELECT * FROM flow_runs WHERE state='payment_wait' AND due<=? ORDER BY due LIMIT 10",now())){
        if(stopping)break;
        try {await sales.remind(order);} catch {trace(order,'Recordatorio de pago','No se pudo confirmar el envío.');}
      }
      for(const row of store.all("SELECT * FROM flow_runs WHERE state='pending' ORDER BY created,id LIMIT 10")){if(stopping)break;await execute(row);}})().finally(()=>{task=null;});return task;
  }
  async function stop(){stopping=true;if(task)await task;}
  return {sales,list,save,publish,pause,enqueue,runs,contactHistory,setAutomation,cancelReminder,recover,flush,stop};
}
