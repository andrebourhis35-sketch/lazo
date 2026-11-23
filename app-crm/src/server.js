import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.js';
import { authentication } from './auth.js';
import { whatsapp } from './whatsapp.js';
import { HttpError, requireThat, digest } from './core.js';
import { workspaceTools } from './workspace.js';
import { mediaLimits } from './media.js';
import { mailService } from './mail.js';
import { automationFlows } from './flows.js';
import { flowAI } from './flow-ai.js';
import { embeddedSignup } from './embedded-signup.js';

const root=fileURLToPath(new URL('../public/',import.meta.url));
const assets={
  '/app/':['index.html','text/html; charset=utf-8'], '/app/app.js':['app.js','text/javascript; charset=utf-8'],
  '/app/app.css':['app.css','text/css; charset=utf-8'],
  '/app/chat-compact.css':['chat-compact.css','text/css; charset=utf-8'],
  '/app/connections-ui.js':['connections-ui.js','text/javascript; charset=utf-8'],
  '/app/meta-signup.js':['meta-signup.js','text/javascript; charset=utf-8'],
  '/app/work-ui.js':['work-ui.js','text/javascript; charset=utf-8'],
  '/app/visual-preview.js':['visual-preview.js','text/javascript; charset=utf-8'],
  '/app/visual-preview.css':['visual-preview.css','text/css; charset=utf-8'],
  '/app/marca-volumen.svg':['marca-volumen.svg','image/svg+xml'],
  '/app/styles.css':['styles.css','text/css; charset=utf-8'],
  '/app/crm.css':['crm.css','text/css; charset=utf-8'],
  '/app/marca.svg':['marca.svg','image/svg+xml']
};
const headers={ 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'self'; script-src 'self' https://connect.facebook.net; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob:; connect-src 'self' https://graph.facebook.com https://www.facebook.com https://connect.facebook.net; frame-src https://www.facebook.com https://web.facebook.com https://staticxx.facebook.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" };
export function createServer(config,{store=openStore(config.database),fetchImpl=fetch,mailTransportFactory}={}) {
  const mail=mailService(store,config,mailTransportFactory);
  let flows;
  const auth=authentication(store,config,mail),wa=whatsapp(store,config,fetchImpl,message=>flows.enqueue(message)),workspace=workspaceTools(store);
  const ai=flowAI(store,config,fetchImpl);
  flows=automationFlows(store,wa,ai);
  const signup=embeddedSignup(store,config,wa,fetchImpl);
  let fileUploads=0;
  const origin=new URL(config.origin);
  const cookieName=config.secureCookies?'__Host-lazo_session':'lazo_dev_session';
  const cookie=(value,expire=false)=>`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; ${config.secureCookies?'Secure; ':''}Max-Age=${expire?0:43200}`;
  const response=(res,status,data,type='application/json; charset=utf-8',extra={})=>{
    res.writeHead(status,{...headers,'Content-Type':type,...extra});res.end(type.startsWith('application/json')?JSON.stringify(data):data);
  };
  async function raw(req,max=64*1024) {
    const chunks=[];let size=0;
    for await(const part of req){size+=part.length;if(size>max)throw new HttpError(413,'Solicitud demasiado grande.');chunks.push(part);}
    return Buffer.concat(chunks);
  }
  async function json(req,max=64*1024) {
    requireThat((req.headers['content-type']||'').split(';')[0]==='application/json','Se esperaba JSON.',415);
    try {const result=JSON.parse((await raw(req,max)).toString());requireThat(result&&typeof result==='object'&&!Array.isArray(result),'Formulario no válido.');return result;}
    catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'Formulario no válido.');}
  }
  function currentSession(req) {
    const value=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
    return value.length===43?store.member(digest(value)):null;
  }
  function assertSession(s) {
    const fresh=store.member(s.hash);
    requireThat(fresh&&fresh.user_id===s.user_id&&fresh.company_id===s.company_id&&fresh.role===s.role,
      'Tu sesión cambió o caducó. Inicia sesión de nuevo.',401);
    return fresh;
  }
  async function authorizedJson(req,s,action,max) {
    const data=await json(req,max);
    assertSession(s);
    return action(data); // Apply immediately after validation, without another await boundary.
  }
  const admin=s=>requireThat(['admin','owner'].includes(s.role),'Acceso exclusivo para administradores.',403);
  const members=company=>store.all('SELECT u.id,u.name,u.email,m.role FROM memberships m JOIN users u ON m.user_id=u.id WHERE m.company_id=? ORDER BY u.name',company);
  const server=http.createServer(async(req,res)=>{
    try {
      const pathname=new URL(req.url,'http://localhost').pathname;
      requireThat([origin.host,`127.0.0.1:${server.address().port}`,`localhost:${server.address().port}`].includes(req.headers.host),'Host no permitido.',421);
      if(pathname==='/healthz'&&req.method==='GET')return response(res,200,{ok:true});
      if(pathname==='/webhooks/whatsapp') {
        const url=new URL(req.url,config.origin);
        if(req.method==='GET')return response(res,200,wa.verify(url.searchParams),'text/plain; charset=utf-8');
        if(req.method==='POST') {
          const result=wa.receive(await raw(req,1024*1024),req.headers['x-hub-signature-256']);
          void wa.media.warm().catch(()=>{});
          void flows.flush().catch(()=>{});
          return response(res,200,result);
        }
        throw new HttpError(405,'Método no admitido.');
      }
      if(pathname==='/app'&&req.method==='GET')return response(res,302,'','text/plain',{Location:'/app/'});
      if(assets[pathname]&&req.method==='GET') {
        const [file,type,folder=root]=assets[pathname];return response(res,200,await readFile(folder+file),type);
      }
      requireThat(pathname.startsWith('/api/crm/'),'No encontrado.',404);
      const route=pathname.slice('/api/crm'.length),method=req.method;
      const s=currentSession(req);
      if(s&&route!=='/session'&&!['/login','/bootstrap','/invitations/info','/invitations/accept','/password/forgot','/password/reset'].includes(route)) {
        if(req.headers['x-lazo-company']!==s.company_id||req.headers['x-lazo-user']!==s.user_id) {
          return response(res,409,{error:'Tu sesión cambió en otra pestaña. Recarga para confirmar la empresa activa.',code:'CONTEXT_CHANGED'});
        }
      }
      if(!['GET','HEAD'].includes(method)) {
        requireThat(req.headers.origin===config.origin&&req.headers['x-lazo-client']==='1','Origen no autorizado.',403);
        if(s)requireThat(req.headers['x-csrf-token']===s.csrf,'Sesión no válida. Recarga la página.',403);
      }
      const ip=req.socket.remoteAddress==='127.0.0.1'||req.socket.remoteAddress==='::ffff:127.0.0.1'?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0]:req.socket.remoteAddress;
      if(method==='POST'&&route==='/password/forgot') {
        const result=await auth.requestReset(await json(req),ip);
        void mail.flush().catch(()=>{});return response(res,202,result);
      }
      if(method==='POST'&&route==='/password/reset') {
        const result=await auth.resetPassword(await json(req),ip);
        void mail.flush().catch(()=>{});return response(res,200,result,'application/json; charset=utf-8',{'Set-Cookie':cookie('',true)});
      }
      if(method==='GET'&&route==='/setup')return response(res,200,{available:auth.bootstrapAvailable()});
      if(method==='POST'&&['/login','/bootstrap','/invitations/accept','/invitations/info'].includes(route)) {
        store.limit('authip:'+digest(ip),50,15*60*1000);
        const data=await json(req);
        let session;
        if(route==='/login') {
          store.limit('login:'+digest(String(data.email||'').toLowerCase()),10,15*60*1000);
          session=await auth.login(data,ip);
        } else if(route==='/bootstrap') {
          session=await auth.bootstrap(data,ip);
          if(config.initialWhatsApp) {
            const owner=store.member(digest(session.secret));
            wa.saveRaw(owner.company_id,config.initialWhatsApp);
            store.run('UPDATE connections SET checked=0 WHERE company_id=?',owner.company_id);
          }
        }
        else if(route==='/invitations/accept')session=await auth.acceptInvite(data,s);
        else {
          const i=auth.inviteInfo(data.token);
          return response(res,200,{email:i.email,company:i.company_name,existing:!!store.get('SELECT 1 FROM users WHERE email=?',i.email)});
        }
        if(s)store.run('DELETE FROM sessions WHERE hash=?',s.hash);
        return response(res,200,{ok:true},'application/json; charset=utf-8',{'Set-Cookie':cookie(session.secret)});
      }
      requireThat(s,'Inicia sesión para continuar.',401);
      if(method==='GET'&&route==='/session')return response(res,200,{...auth.identity(s),chatTextSize:store.get('SELECT chat_text_size FROM user_preferences WHERE user_id=?',s.user_id)?.chat_text_size||'normal',emailEnabled:mail.available,companies:store.all('SELECT c.id,c.name,m.role FROM companies c JOIN memberships m ON m.company_id=c.id WHERE m.user_id=?',s.user_id)});
      if(method==='PATCH'&&route==='/preferences/chat-text') {
        return response(res,200,await authorizedJson(req,s,data=>{
          const size=data.size;
          requireThat(['small','normal','large','extra'].includes(size),'Elige un tamaño de texto válido.');
          store.run('INSERT INTO user_preferences(user_id,chat_text_size) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET chat_text_size=excluded.chat_text_size',s.user_id,size);
          return {chatTextSize:size};
        }));
      }
      if(method==='POST'&&route==='/logout') {store.run('DELETE FROM sessions WHERE hash=?',s.hash);return response(res,200,{ok:true},'application/json; charset=utf-8',{'Set-Cookie':cookie('',true)});}
      if(method==='POST'&&route==='/companies')return response(res,201,await authorizedJson(req,s,data=>auth.newCompany(s,data)));
      if(method==='POST'&&route==='/companies/switch') {
        const data=await json(req);assertSession(s);requireThat(store.get('SELECT 1 FROM memberships WHERE company_id=? AND user_id=?',data.companyId,s.user_id),'Empresa no disponible.',403);
        const fresh=store.session(s.user_id,data.companyId,{parentHash:s.hash});store.run('DELETE FROM sessions WHERE hash=?',s.hash);
        return response(res,200,{ok:true},'application/json; charset=utf-8',{'Set-Cookie':cookie(fresh.secret)});
      }
      if(method==='GET'&&route==='/members')return response(res,200,{members:members(s.company_id)});
      if(route==='/flow-ai') {
        requireThat(s.role==='owner','Solo el propietario puede gestionar la clave de IA.',403);
        if(method==='GET')return response(res,200,ai.settings(s.company_id));
        if(method==='POST')return response(res,200,await authorizedJson(req,s,data=>ai.save(s.company_id,data,s.user_id)));
      }
      if(route==='/flows') {
        admin(s);
        if(method==='GET')return response(res,200,{flows:flows.list(s.company_id)});
        if(method==='POST')return response(res,201,await authorizedJson(req,s,data=>flows.save(s.company_id,null,data,s.user_id),2*1024*1024));
      }
      const flowMatch=route.match(/^\/flows\/([a-f\d-]+)(?:\/(activate|pause|runs))?$/);
      if(flowMatch) {
        admin(s);const [,id,action]=flowMatch;
        if(method==='GET'&&action==='runs')return response(res,200,{runs:flows.runs(s.company_id,id)});
        if(method==='PUT'&&!action)return response(res,200,await authorizedJson(req,s,data=>flows.save(s.company_id,id,data,s.user_id),2*1024*1024));
        if(method==='POST'&&action==='activate')return response(res,200,await authorizedJson(req,s,data=>flows.publish(s.company_id,id,data,s.user_id)));
        if(method==='POST'&&action==='pause')return response(res,200,await authorizedJson(req,s,()=>flows.pause(s.company_id,id,s.user_id)));
      }
      if(method==='GET'&&route==='/pipeline')return response(res,200,{stages:workspace.pipeline(s.company_id)});
      if(method==='POST'&&route==='/pipeline/stages') {admin(s);return response(res,201,{stages:await authorizedJson(req,s,data=>workspace.addStage(s.company_id,data,s.user_id))});}
      if(method==='PUT'&&route==='/pipeline/order') {admin(s);return response(res,200,{stages:await authorizedJson(req,s,data=>workspace.orderStages(s.company_id,data.ids,s.user_id))});}
      const stageMatch=route.match(/^\/pipeline\/stages\/([a-f\d-]+)$/);
      if(stageMatch&&['PATCH','DELETE'].includes(method)) {
        admin(s);const stages=method==='DELETE'?workspace.removeStage(s.company_id,stageMatch[1],s.user_id):await authorizedJson(req,s,data=>workspace.updateStage(s.company_id,stageMatch[1],data,s.user_id));
        return response(res,200,{stages});
      }
      if(method==='GET'&&route==='/quick-replies')return response(res,200,{replies:workspace.replies(s.company_id)});
      if(method==='POST'&&route==='/quick-replies') {admin(s);return response(res,201,{replies:await authorizedJson(req,s,data=>workspace.saveReply(s.company_id,null,data,s.user_id))});}
      const replyMatch=route.match(/^\/quick-replies\/([a-f\d-]+)$/);
      if(replyMatch&&['PATCH','DELETE'].includes(method)) {
        admin(s);const replies=method==='DELETE'?workspace.removeReply(s.company_id,replyMatch[1],s.user_id):await authorizedJson(req,s,data=>workspace.saveReply(s.company_id,replyMatch[1],data,s.user_id));
        return response(res,200,{replies});
      }
      if(method==='GET'&&route==='/statistics') {
        store.limit('stats:'+s.company_id,90,60000);
        return response(res,200,workspace.statistics(s.company_id,Number(new URL(req.url,config.origin).searchParams.get('days')||30)));
      }
      if(method==='POST'&&route==='/invitations') {
        store.limit('invite:'+s.company_id,30,3600000);
        const result=await authorizedJson(req,s,data=>auth.invite(s,data));void mail.flush().catch(()=>{});return response(res,201,result);
      }
      const invitationMail=route.match(/^\/invitations\/email\/([a-f\d-]+)$/);
      if(method==='GET'&&invitationMail) {
        admin(s);
        const job=store.get("SELECT state,expires FROM mail_jobs WHERE id=? AND company_id=? AND kind='invite'",invitationMail[1],s.company_id);
        requireThat(job,'Invitación no encontrada.',404);return response(res,200,job);
      }
      const memberMatch=route.match(/^\/members\/([a-f\d-]+)$/);
      if(method==='DELETE'&&memberMatch) {
        admin(s);const member=store.get('SELECT * FROM memberships WHERE company_id=? AND user_id=?',s.company_id,memberMatch[1]);
        requireThat(member&&member.role!=='owner'&&member.user_id!==s.user_id,'No se puede retirar este usuario.',403);
        requireThat(s.role==='owner'||member.role==='agent','Solo el propietario puede retirar administradores.',403);
        store.tx(()=>{store.run('DELETE FROM sessions WHERE company_id=? AND user_id=?',s.company_id,member.user_id);store.run('UPDATE contacts SET owner_id=? WHERE company_id=? AND owner_id=?',s.user_id,s.company_id,member.user_id);store.run('DELETE FROM memberships WHERE company_id=? AND user_id=?',s.company_id,member.user_id);store.audit(s.company_id,s.user_id,'member.removed');});
        return response(res,200,{ok:true});
      }
      if(method==='GET'&&route==='/inbox-overview') {
        const url=new URL(req.url,config.origin),company=url.searchParams.get('company')||null;
        const sources=store.all(`SELECT c.id,c.name,w.phone_id FROM memberships m JOIN companies c ON c.id=m.company_id
          JOIN connections w ON w.company_id=c.id WHERE m.user_id=? ORDER BY c.name,c.id`,s.user_id);
        requireThat(!company||sources.some(source=>source.id===company),'Número no disponible.',403);
        const conversations=store.all(`SELECT c.id,c.company_id,c.name,c.unread,c.updated,company.name AS source,
          (SELECT body FROM messages m WHERE m.company_id=c.company_id AND m.contact_id=c.id ORDER BY m.created DESC,m.id DESC LIMIT 1) AS last_message
          FROM contacts c JOIN memberships access ON access.company_id=c.company_id AND access.user_id=?
          JOIN companies company ON company.id=c.company_id JOIN connections w ON w.company_id=c.company_id
          WHERE (? IS NULL OR c.company_id=?) AND EXISTS(SELECT 1 FROM messages m WHERE m.company_id=c.company_id AND m.contact_id=c.id)
          ORDER BY c.updated DESC,c.id LIMIT 100`,s.user_id,company,company);
        return response(res,200,{sources,conversations});
      }
      if(method==='GET'&&route==='/contacts')return response(res,200,{contacts:store.all(`SELECT c.*,(SELECT body FROM messages m WHERE m.company_id=c.company_id AND m.contact_id=c.id ORDER BY m.created DESC LIMIT 1) AS last_message FROM contacts c WHERE company_id=? ORDER BY updated DESC LIMIT 1000`,s.company_id)});
      if(method==='POST'&&route==='/contacts')return response(res,201,await authorizedJson(req,s,data=>store.addContact(s.company_id,data,s.user_id)));
      const fileMatch=route.match(/^\/messages\/([a-f\d-]+)\/attachment$/);
      if(method==='GET'&&fileMatch) {
        store.limit('download:'+s.company_id,120,60000);
        const file=await wa.media.forMessage(s.company_id,fileMatch[1]);
        assertSession(s);
        const name=encodeURIComponent(file.filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
        return response(res,200,file.bytes,file.mime,{'Content-Disposition':"attachment; filename=\"archivo"+(file.mime==='application/pdf'?'.pdf':file.mime==='image/png'?'.png':'.jpg')+"\"; filename*=UTF-8''"+name,'Content-Length':String(file.bytes.length),'Content-Security-Policy':"sandbox; default-src 'none'"});
      }
      const contactMatch=route.match(/^\/contacts\/([a-f\d-]+)(?:\/(messages|read|attachments|automation|orders))?$/);
      if(contactMatch) {
        const id=contactMatch[1],action=contactMatch[2],contact=store.contact(s.company_id,id);
        if(method==='GET'&&!action)return response(res,200,{contact});
        if(method==='PATCH'&&!action)return response(res,200,await authorizedJson(req,s,data=>store.updateContact(s.company_id,id,data,s.user_id)));
        if(action==='orders'&&method==='GET')return response(res,200,{orders:flows.sales.list(s.company_id,id)});
        if(action==='orders'&&method==='POST') {
          admin(s);
          const result=await authorizedJson(req,s,data=>data.action==='resend'?flows.sales.resend(s.company_id,id,data.orderId,data.requestId,s.user_id):flows.sales.confirm(s.company_id,id,data.orderId,data,s.user_id));
          void flows.flush().catch(()=>{});
          return response(res,200,result);
        }
        if(action==='automation'&&method==='GET')return response(res,200,{paused:Boolean(store.contact(s.company_id,id).automation_paused),runs:flows.contactHistory(s.company_id,id)});
        if(action==='automation'&&method==='POST')return response(res,200,await authorizedJson(req,s,data=>{
          requireThat(typeof data.paused==='boolean','Estado no válido.');
          return flows.setAutomation(s.company_id,id,data.paused,s.user_id);
        }));
        if(method==='POST'&&action==='read') {store.run('UPDATE contacts SET unread=0 WHERE company_id=? AND id=?',s.company_id,id);return response(res,200,{ok:true});}
        if(method==='GET'&&action==='messages') {
          const messages=store.all('SELECT * FROM messages WHERE company_id=? AND contact_id=? ORDER BY created DESC,id DESC LIMIT 100',s.company_id,id).reverse();
          return response(res,200,{messages:messages.map(m=>({...m,attachment:wa.media.describe(s.company_id,m.attachment_id)})),limit:100});
        }
        if(method==='POST'&&action==='attachments') {
          store.limit('send:'+s.company_id,30,60000);
          requireThat(fileUploads<2,'Hay otros archivos en proceso. Intenta de nuevo en unos segundos.',429);
          requireThat((req.headers['content-type']||'').startsWith('multipart/form-data;'),'Selecciona un archivo.',415);
          fileUploads++;
          try {
            const bytes=await raw(req,10*1024*1024+65536);
            let form;try{form=await new Request('http://localhost/upload',{method:'POST',headers:{'Content-Type':req.headers['content-type']},body:bytes}).formData();}catch{throw new HttpError(400,'No se pudo leer el archivo.');}
            const file=form.get('file'),clientId=form.get('clientId');
            requireThat(file&&typeof file.arrayBuffer==='function'&&form.getAll('file').length===1,'Selecciona un único archivo.');
            requireThat(mediaLimits[file.type]&&file.size<=mediaLimits[file.type]&&file.size>0,'Usa JPG/PNG de hasta 5 MB o PDF de hasta 10 MB.',413);
            requireThat(typeof clientId==='string'&&/^[a-f\d-]{36}$/.test(clientId),'Identificador de envío no válido.');
            const content=Buffer.from(await file.arrayBuffer());assertSession(s);
            flows.cancelReminder(s.company_id,id,'Un asesor intervino.');
            const result=await wa.send(s.company_id,id,{type:file.type==='application/pdf'?'document':'image',text:form.get('caption')||'',clientId,file:{bytes:content,mime:file.type,filename:file.name}},s.user_id);
            return response(res,200,result);
          } finally {fileUploads--;}
        }
        if(method==='POST'&&action==='messages') {
          store.limit('send:'+s.company_id,30,60000);const data=await json(req);assertSession(s);
          requireThat(typeof data.clientId==='string'&&/^[a-f\d-]{36}$/.test(data.clientId),'Identificador de envío no válido.');
          flows.cancelReminder(s.company_id,id,'Un asesor intervino.');
          return response(res,200,await wa.send(s.company_id,id,data,s.user_id));
        }
      }
      if(route==='/whatsapp/signup'&&method==='GET') {admin(s);return response(res,200,signup.settings());}
      if(route==='/whatsapp/signup/start'&&method==='POST') {admin(s);store.limit('signup:'+s.company_id,10,60000);return response(res,200,await authorizedJson(req,s,()=>signup.start(s)));}
      if(route==='/whatsapp/signup/exchange'&&method==='POST') {admin(s);return response(res,200,await authorizedJson(req,s,data=>signup.exchange(s,data,()=>assertSession(s))));}
      if(route==='/whatsapp/signup/complete'&&method==='POST') {admin(s);return response(res,200,await authorizedJson(req,s,data=>signup.complete(s,data,()=>assertSession(s))));}
      if(route==='/whatsapp'&&method==='GET') {admin(s);return response(res,200,wa.safe(s.company_id));}
      if(route==='/whatsapp'&&method==='PUT') {admin(s);store.limit('connect:'+s.company_id,10,60000);return response(res,200,await authorizedJson(req,s,data=>wa.connect(s.company_id,data,s.user_id,()=>assertSession(s))));}
      if(route==='/whatsapp/subscribe'&&method==='POST') {admin(s);return response(res,200,await wa.subscribe(s.company_id,s.user_id));}
      if(route==='/templates'&&method==='GET')return response(res,200,{templates:await wa.templates(s.company_id)});
      throw new HttpError(404,'Ruta no encontrada.');
    } catch(error) {
      if(error instanceof HttpError)return response(res,error.status,{error:error.message});
      if(String(error.code||'').includes('CONSTRAINT'))return response(res,409,{error:'Los datos ya existen o la operación entra en conflicto.'});
      // Do not log request data, Graph responses, credentials or customer messages.
      console.error('LAZO CRM: fallo interno de solicitud.');response(res,500,{error:'No se pudo completar la operación. Intenta de nuevo.'});
    }
  });
  server.requestTimeout=60000;server.headersTimeout=10000;
  server.keepAliveTimeout=5000;
  server.lazo={store,auth,wa,workspace,mail,flows};return server;
}
