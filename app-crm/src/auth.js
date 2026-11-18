import { randomUUID, randomInt } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { now, token, digest, requireThat, email, text, passwordHash, passwordMatches } from './core.js';

export function authentication(store, config, mail) {
  let hashing = 0;
  async function hashJob(fn) {
    requireThat(hashing<2,'Hay otros accesos en proceso. Intenta de nuevo en unos segundos.',429);
    hashing++;try { return await fn(); } finally { hashing--; }
  }
  function bootstrapAvailable() {return !store.get("SELECT value FROM meta WHERE key='bootstrapped'");}
  function identity(s) {
    return { user:{id:s.user_id,name:s.name,email:s.email,role:s.role},company:{id:s.company_id,name:s.company_name},csrf:s.csrf,
      companies:store.all('SELECT c.id,c.name,m.role FROM companies c JOIN memberships m ON m.company_id=c.id WHERE m.user_id=?',s.user_id) };
  }
  async function bootstrap(data,ip) {
    store.limit('bootstrap:'+ip,10,60*60*1000);
    requireThat(bootstrapAvailable(),'La plataforma ya tiene administrador.',409);
    requireThat(config.bootstrapHash && typeof data.token==='string' && digest(data.token)===config.bootstrapHash,'Enlace de activación no válido.',403);
    const mail=email(data.email),name=text(data.name,80,true),company=text(data.company,100,true);
    const hash=await hashJob(()=>passwordHash(data.password));
    const user=randomUUID(),workspace=randomUUID();
    store.tx(()=>{
      requireThat(bootstrapAvailable(),'La plataforma ya tiene administrador.',409);
      store.run('INSERT INTO companies(id,name,created) VALUES(?,?,?)',workspace,company,now());
      store.ensureWorkspace(workspace);
      store.run('INSERT INTO users(id,email,name,password,created) VALUES(?,?,?,?,?)',user,mail,name,hash,now());
      store.run("INSERT INTO memberships VALUES(?,?,'owner')",workspace,user);
      store.run("INSERT INTO meta VALUES('bootstrapped','1')");
      store.audit(workspace,user,'owner.activated');
    });
    return store.session(user,workspace);
  }
  async function login(data,ip) {
    const mail=email(data.email);
    store.limit('login-ip:'+ip,30,15*60000);
    store.limit('login-email:'+digest(mail),10,15*60000);
    const user=store.get('SELECT * FROM users WHERE email=?',mail);
    const matches=await hashJob(()=>passwordMatches(data.password,user?.password));
    requireThat(matches && user,'Correo o contraseña incorrectos.',401);
    const member=store.get('SELECT company_id FROM memberships WHERE user_id=? ORDER BY company_id LIMIT 1',user.id);
    requireThat(member,'Esta cuenta no tiene acceso a ninguna empresa.',403);
    store.run('DELETE FROM limits WHERE key=?','login-email:'+digest(mail));
    const session=store.session(user.id,member.company_id,{passwordHash:user.password});
    store.audit(member.company_id,user.id,'login');return session;
  }
  function invite(s,data) {
    requireThat(['owner','admin'].includes(s.role),'Solo los administradores pueden invitar usuarios.',403);
    const mail=email(data.email);requireThat(['admin','agent'].includes(data.role),'Rol no válido.');
    if (s.role==='admin') requireThat(data.role==='agent','Solo el propietario puede invitar administradores.',403);
    const existing=store.get('SELECT id FROM users WHERE email=?',mail);
    requireThat(!existing || !store.get('SELECT 1 FROM memberships WHERE company_id=? AND user_id=?',s.company_id,existing.id),'Ya pertenece a la empresa.',409);
    requireThat(data.sendEmail===undefined || typeof data.sendEmail==='boolean','Opción de correo no válida.');
    const sendEmail = data.sendEmail===true;
    requireThat(!sendEmail || mailerAvailable(),'El correo de LAZO todavía no está configurado. Puedes crear el enlace privado.',503);
    const secret=token(),expires=now()+48*60*60*1000,url=`${config.origin}/app/#invite=${secret}`;
    let emailJobId=null;
    store.tx(()=>{
      store.run('UPDATE invites SET used=1 WHERE company_id=? AND email=? AND used=0',s.company_id,mail);
      store.run("UPDATE mail_jobs SET state='expired',payload='',updated=? WHERE company_id=? AND recipient=? AND kind='invite' AND state='queued'",now(),s.company_id,mail);
      store.run('INSERT INTO invites(hash,company_id,email,role,expires) VALUES(?,?,?,?,?)',digest(secret),s.company_id,mail,data.role,expires);
      if(sendEmail)emailJobId=queueInvite(s,mail,url,digest(secret),expires);
      store.audit(s.company_id,s.user_id,'invite.created');
    });
    return {url,email:mail,expiresInHours:48,emailQueued:sendEmail,emailJobId};
  }
  // Keep the mail service separate from the normalized email variable used above.
  function mailerAvailable() {return Boolean(mail?.available);}
  function queueInvite(s,recipient,url,proof,expires) {
    return mail.enqueue({kind:'invite',recipient,subject:'Invitación a LAZO',company:s.company_id,user:s.user_id,proof,expires,
      body:`Te han invitado a ${s.company_name} en LAZO.\n\nAbre este enlace privado para unirte:\n${url}\n\nEl enlace es de un solo uso y caduca en 48 horas. Si no esperabas esta invitación, puedes ignorarla.`});
  }
  async function requestReset(data,ip) {
    const started=now(),address=email(data.email),targetTime=400+randomInt(100);
    store.limit('reset-ip:'+digest(ip),20,3600000);
    store.limit('reset-email:'+digest(address),3,3600000);
    const user=store.get('SELECT id FROM users WHERE email=?',address);
    if(user && mailerAvailable()) {
      const secret=token(),expires=now()+15*60000;
      try {store.tx(()=>{
        store.run('INSERT INTO password_resets VALUES(?,?,?,0,?)',digest(secret),user.id,expires,now());
        mail.enqueue({kind:'reset',recipient:address,user:user.id,proof:digest(secret),expires,
          subject:'Recupera tu acceso a LAZO',body:`Recibimos una solicitud para recuperar tu acceso a LAZO.\n\nAbre este enlace privado:\n${config.origin}/app/#reset=${secret}\n\nEs de un solo uso y caduca en 15 minutos. Si no lo solicitaste, ignora este correo; tu contraseña sigue igual.`});
      });} catch {console.warn('LAZO: no se pudo preparar el correo de recuperación.');}
    }
    await delay(Math.max(0,targetTime-(now()-started)));
    return {ok:true,message:'Si existe una cuenta con ese correo, recibirás un enlace para recuperar el acceso. Si no llega, contacta al administrador de LAZO.'};
  }
  async function resetPassword(data,ip) {
    store.limit('reset-finish:'+digest(ip),12,15*60000);
    requireThat(typeof data.token==='string' && /^[\w-]{43}$/.test(data.token),'El enlace ha caducado o ya fue utilizado.',400);
    const proof=digest(data.token);
    const lookup=()=>store.get('SELECT r.*,u.email FROM password_resets r JOIN users u ON u.id=r.user_id WHERE r.hash=? AND r.used=0 AND r.expires>?',proof,now());
    requireThat(lookup(),'El enlace ha caducado o ya fue utilizado.',400);
    requireThat(data.password===data.confirmPassword,'Las contraseñas no coinciden.');
    const hash=await hashJob(()=>passwordHash(data.password));
    let changed;
    store.tx(()=>{
      const row=lookup();requireThat(row,'El enlace ha caducado o ya fue utilizado.',400);
      store.run('UPDATE users SET password=? WHERE id=?',hash,row.user_id);
      store.run('UPDATE password_resets SET used=1 WHERE user_id=?',row.user_id);
      store.run('DELETE FROM sessions WHERE user_id=?',row.user_id);
      store.run("UPDATE mail_jobs SET state='expired',payload='',updated=? WHERE user_id=? AND kind='reset' AND state='queued'",now(),row.user_id);
      store.audit(null,row.user_id,'password.reset');
      changed=row;
    });
    if(mailerAvailable())try {mail.enqueue({kind:'password-changed',recipient:changed.email,user:changed.user_id,expires:now()+86400000,
      subject:'Tu contraseña de LAZO se actualizó',body:'Tu contraseña de LAZO se actualizó y las sesiones anteriores se cerraron. Si no fuiste tú, solicita recuperar el acceso y contacta al administrador de LAZO.'});}
    catch {console.warn('LAZO: no se pudo preparar la notificación de contraseña.');}
    return {ok:true};
  }
  function inviteInfo(secret) {
    requireThat(typeof secret==='string' && secret.length<200,'Invitación no válida.');
    const row=store.get('SELECT i.*,c.name AS company_name FROM invites i JOIN companies c ON c.id=i.company_id WHERE i.hash=? AND i.used=0 AND i.expires>?',digest(secret),now());
    requireThat(row,'La invitación ha caducado o ya fue utilizada.',404);
    return row;
  }
  async function acceptInvite(data,session) {
    const invitation=inviteInfo(data.token);
    const existing=store.get('SELECT * FROM users WHERE email=?',invitation.email);
    let userId=existing?.id,hash,name,credentialProof={};
    if (existing) {
      const bySession=session?.user_id===existing.id;
      const verified=bySession||await hashJob(()=>passwordMatches(data.password,existing.password));
      requireThat(verified,'Inicia sesión con la cuenta invitada para aceptar.',403);
      credentialProof=bySession?{parentHash:session.hash}:{passwordHash:existing.password};
    }
    else {
      name=text(data.name,80,true);hash=await hashJob(()=>passwordHash(data.password));userId=randomUUID();
    }
    return store.tx(()=>{
      const fresh=inviteInfo(data.token);
      if(existing)store.assertCredential(userId,credentialProof);
      if (!existing) store.run('INSERT INTO users(id,email,name,password,created) VALUES(?,?,?,?,?)',userId,fresh.email,name,hash,now());
      store.run('INSERT INTO memberships VALUES(?,?,?) ON CONFLICT(company_id,user_id) DO NOTHING',fresh.company_id,userId,fresh.role);
      store.run('UPDATE invites SET used=1 WHERE hash=?',fresh.hash);
      store.audit(fresh.company_id,userId,'invite.accepted');
      return store.session(userId,fresh.company_id,credentialProof);
    });
  }
  function newCompany(s,data) {
    requireThat(s.role==='owner','Solo el propietario puede crear otra empresa.',403);
    const company=randomUUID(),name=text(data.name,100,true);
    store.tx(()=>{store.run('INSERT INTO companies VALUES(?,?,?)',company,name,now());store.ensureWorkspace(company);store.run("INSERT INTO memberships VALUES(?,?,'owner')",company,s.user_id);store.audit(company,s.user_id,'company.created');});
    return {id:company,name};
  }
  return {bootstrapAvailable,identity,bootstrap,login,invite,inviteInfo,acceptInvite,newCompany,requestReset,resetPassword};
}
