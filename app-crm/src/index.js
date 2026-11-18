import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createServer } from './server.js';
const env=process.env,production=env.NODE_ENV==='production';
const origin=env.LAZO_ORIGIN||'http://127.0.0.1:3031';
if(production&&!origin.startsWith('https://'))throw new Error('LAZO_ORIGIN debe usar HTTPS.');
const database=resolve(env.LAZO_DATABASE||'data/lazo.sqlite');
mkdirSync(dirname(database),{recursive:true,mode:0o700});
const config={origin,database,masterKey:env.LAZO_MASTER_KEY||'',bootstrapHash:env.LAZO_BOOTSTRAP_HASH||'',secureCookies:production,testRecipient:env.LAZO_TEST_RECIPIENT||''};
if(env.LAZO_SMTP_HOST||env.LAZO_SMTP_USER||env.LAZO_SMTP_PASSWORD) {
  config.smtp={host:env.LAZO_SMTP_HOST,port:Number(env.LAZO_SMTP_PORT||465),user:env.LAZO_SMTP_USER,password:env.LAZO_SMTP_PASSWORD};
}
if(env.WHATSAPP_ACCESS_TOKEN&&env.WHATSAPP_PHONE_NUMBER_ID&&env.WHATSAPP_BUSINESS_ACCOUNT_ID&&env.GRAPH_API_VERSION) {
  config.initialWhatsApp={accessToken:env.WHATSAPP_ACCESS_TOKEN,phoneId:env.WHATSAPP_PHONE_NUMBER_ID,wabaId:env.WHATSAPP_BUSINESS_ACCOUNT_ID,graphVersion:env.GRAPH_API_VERSION,appSecret:env.WHATSAPP_APP_SECRET||'',testRecipient:config.testRecipient,verifyToken:env.LAZO_WEBHOOK_VERIFY_TOKEN||''};
  if(!config.initialWhatsApp.verifyToken)throw new Error('Falta LAZO_WEBHOOK_VERIFY_TOKEN.');
}
const server=createServer(config);
// An interrupted send must not be silently retried after a process restart.
server.lazo.store.run("UPDATE messages SET status='unknown',updated=? WHERE status='queued'",Date.now());
server.listen(Number(env.PORT||3031),'127.0.0.1',()=>console.log('LAZO CRM: servicio iniciado en la interfaz local.'));
server.lazo.store.purge();
const timer=setInterval(()=>server.lazo.store.purge(),3600000);timer.unref();
const mediaTimer=setInterval(()=>{void server.lazo.wa.media.warm().catch(()=>{});},30000);mediaTimer.unref();
void server.lazo.wa.media.warm().catch(()=>{});
const mailTimer=setInterval(()=>{void server.lazo.mail.flush().catch(()=>{});},5000);mailTimer.unref();
void server.lazo.mail.flush().catch(()=>{});
function stop(){clearInterval(timer);clearInterval(mediaTimer);clearInterval(mailTimer);server.close(async()=>{await Promise.all([server.lazo.wa.media.stop(),server.lazo.mail.stop()]);server.lazo.store.close();process.exit(0);});setTimeout(()=>process.exit(1),25000).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
