import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';
import { email, now, requireThat, vault } from './core.js';

const hosts = new Set(['smtp.zoho.com','smtppro.zoho.com','smtp.zoho.eu','smtppro.zoho.eu',
  'smtp.zoho.in','smtppro.zoho.in','smtp.zoho.com.au','smtppro.zoho.com.au']);
function mailbox(value) {
  const address=email(value);
  requireThat(/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i.test(address),
    'Usa una dirección de correo sin nombres, listas o caracteres especiales.');
  return address;
}
export function smtpOptions(input) {
  requireThat(input && hosts.has(input.host),'Usa el servidor SMTP indicado por Zoho Mail.');
  requireThat([465,587].includes(Number(input.port)),'Usa el puerto seguro 465 o 587.');
  const user = mailbox(input.user);
  requireThat(typeof input.password === 'string' && input.password.length > 0 && input.password.length <= 512 &&
    !/[\x00-\x1f\x7f]/.test(input.password),'Revisa la contraseña de aplicación de Zoho.');
  return {host:input.host,port:Number(input.port),secure:Number(input.port)===465,requireTLS:true,
    auth:{user,pass:input.password},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true,servername:input.host},
    connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,
    disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false};
}

export function mailService(store, config, transportFactory = options => nodemailer.createTransport(options)) {
  const secrets = vault(config.masterKey);
  const smtp = config.smtp ? smtpOptions(config.smtp) : null;
  let running = null, stopped = false;
  // A process interruption is ambiguous; never automatically send the same email again.
  store.run("UPDATE mail_jobs SET state='unknown',payload='',updated=? WHERE state='sending'",now());
  function enqueue({kind,recipient,subject,body,expires,company=null,user=null,proof=null}) {
    requireThat(smtp,'El correo de LAZO todavía no está configurado.',503);
    requireThat(store.get("SELECT COUNT(*) AS n FROM mail_jobs WHERE state='queued'").n < 300,
      'Hay demasiados correos pendientes. Intenta más tarde.',429);
    const id = randomUUID();
    store.run('INSERT INTO mail_jobs(id,kind,company_id,user_id,proof,recipient,payload,state,expires,created,updated) VALUES(?,?,?,?,?,?,?,\'queued\',?,?,?)',
      id,kind,company,user,proof,mailbox(recipient),secrets.seal({subject,body},'mail:'+id),expires,now(),now());
    return id;
  }
  function valid(job) {
    if (job.kind==='reset') return !!store.get('SELECT 1 FROM password_resets WHERE hash=? AND used=0 AND expires>?',job.proof,now());
    if (job.kind==='invite') return !!store.get('SELECT 1 FROM invites WHERE hash=? AND company_id=? AND used=0 AND expires>?',job.proof,job.company_id,now());
    return job.kind==='password-changed';
  }
  async function drain() {
    if (!smtp || stopped) return;
    store.run("UPDATE mail_jobs SET state='expired',payload='',updated=? WHERE state='queued' AND expires<=?",now(),now());
    for (let n=0;n<5&&!stopped;n++) {
      const job = store.get("SELECT * FROM mail_jobs WHERE state='queued' ORDER BY created,id LIMIT 1");
      if (!job) break;
      if (!valid(job)) {store.run("UPDATE mail_jobs SET state='expired',payload='',updated=? WHERE id=?",now(),job.id);continue;}
      store.run("UPDATE mail_jobs SET state='sending',updated=? WHERE id=? AND state='queued'",now(),job.id);
      let transport, state = 'unknown';
      try {
        const data = secrets.open(job.payload,'mail:'+job.id);
        transport = transportFactory(smtp);
        const result = await transport.sendMail({from:{name:'LAZO',address:smtp.auth.user},to:{address:job.recipient},
          subject:data.subject,text:data.body,disableFileAccess:true,disableUrlAccess:true});
        state = result.accepted?.some(value=>String(value).toLowerCase()===job.recipient) ? 'accepted' : 'failed';
      } catch(error) {
        if (['EAUTH','EENVELOPE'].includes(error.code) || Number(error.responseCode)>=400) state='failed';
        // Do not store/log provider error objects, which may contain message text or credentials.
      } finally {
        try {transport?.close?.();} catch {}
        store.run("UPDATE mail_jobs SET state=?,payload='',updated=? WHERE id=?",state,now(),job.id);
      }
    }
  }
  function flush() {
    if (running) return running;
    running = drain().finally(()=>{running=null;});
    return running;
  }
  async function stop() {stopped=true;if(running)await running;}
  return {available:Boolean(smtp),enqueue,flush,stop};
}
