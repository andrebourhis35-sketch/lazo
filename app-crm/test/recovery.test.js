import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { request } from 'node:http';
import { createServer } from '../src/server.js';
import { digest, now } from '../src/core.js';
import { smtpOptions } from '../src/mail.js';

const smtp={host:'smtp.zoho.com',port:465,user:'mailer@example.test',password:'SYNTHETIC_SMTP_SECRET'};
test('SMTP accepts only Zoho TLS endpoints and one strict mailbox',()=>{
  const options=smtpOptions(smtp);
  assert.equal(options.secure,true);assert.equal(options.requireTLS,true);
  assert.equal(options.tls.rejectUnauthorized,true);assert.equal(options.disableUrlAccess,true);
  for(const bad of [{...smtp,host:'127.0.0.1'},{...smtp,port:25},{...smtp,user:'a,b@example.test'},{...smtp,password:'bad\r\nvalue'}])
    assert.throws(()=>smtpOptions(bad));
});

test('password recovery and invitations protect tokens, sessions and delivery state',async t=>{
  const sent=[];let mode='ok',deliveries=0;
  const config={database:':memory:',origin:'http://127.0.0.1:3031',secureCookies:false,
    masterKey:randomBytes(32).toString('base64'),bootstrapHash:digest('fixture-activation'),smtp};
  const server=createServer(config,{mailTransportFactory:()=>({
    async sendMail(message){deliveries++;if(mode==='unknown')throw new Error('PRIVATE_PROVIDER_DETAILS');
      sent.push(message);return {accepted:[message.to.address]};},close(){}
  })});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}/api/crm`,store=server.lazo.store;
  t.after(async()=>{await server.lazo.mail.stop();await new Promise(resolve=>server.close(resolve));store.close();});
  const client=()=>({cookie:'',csrf:'',company:'',user:''});
  const owner=client(),otherSession=client(),anonymous=client();
  async function api(c,path,method='GET',body,extra={}) {
    const response=await fetch(base+path,{method,headers:{Origin:config.origin,'Content-Type':'application/json',
      'X-Lazo-Client':'1','X-Lazo-User':c.user,'X-Lazo-Company':c.company,...(c.cookie?{Cookie:c.cookie}:{}),
      ...(c.csrf?{'X-CSRF-Token':c.csrf}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
    const cookie=response.headers.get('set-cookie');if(cookie)c.cookie=cookie.split(';')[0];
    return {status:response.status,data:await response.json()};
  }
  async function identity(c){const r=await api(c,'/session');if(r.status===200){c.csrf=r.data.csrf;c.company=r.data.company.id;c.user=r.data.user.id;}return r;}
  const password='Temporary-QA-Password-2026',changedPassword='New-Temporary-QA-Password-2026';
  assert.equal((await api(owner,'/bootstrap','POST',{token:'fixture-activation',email:'owner@example.test',
    name:'Owner QA',company:'Company QA',password})).status,200);
  await identity(owner);
  let secret;
  await t.test('existing and unknown accounts receive the same response; queued body is encrypted',async()=>{
    const known=await api(anonymous,'/password/forgot','POST',{email:'owner@example.test'});
    const unknown=await api(anonymous,'/password/forgot','POST',{email:'absent@example.test'});
    assert.equal(known.status,202);assert.deepEqual(known,unknown);
    await server.lazo.mail.flush();
    secret=sent.find(m=>m.subject==='Recupera tu acceso a LAZO').text.match(/#reset=([\w-]+)/)[1];
    const row=store.get('SELECT * FROM password_resets');assert.equal(row.hash,digest(secret));
    assert.equal(JSON.stringify(store.all('SELECT * FROM mail_jobs')).includes(secret),false);
    assert.equal(store.get('SELECT state FROM mail_jobs').state,'accepted');
    const session=await identity(owner);assert.equal(session.data.emailEnabled,true);
    assert.equal(JSON.stringify(session.data).includes(smtp.password),false);
  });
  await t.test('foreign origins and Host poisoning cannot issue or use recovery tokens',async()=>{
    assert.equal((await api(anonymous,'/password/forgot','POST',{email:'owner@example.test'},{Origin:'https://attacker.invalid'})).status,403);
    assert.equal((await api(anonymous,'/password/reset','POST',{token:secret,password:changedPassword,confirmPassword:changedPassword},{Origin:'https://attacker.invalid'})).status,403);
    const poisoned=await new Promise((resolve,reject)=>{
      const req=request(base+'/password/forgot',{method:'POST',headers:{Host:'attacker.invalid',Origin:config.origin,
        'X-Lazo-Client':'1','Content-Type':'application/json'}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});
      req.on('error',reject);req.end(JSON.stringify({email:'owner@example.test'}));
    });
    assert.equal(poisoned,421);
  });
  await t.test('racing uses consume one token and revoke every session; no automatic login',async()=>{
    assert.equal((await api(otherSession,'/login','POST',{email:'owner@example.test',password})).status,200);await identity(otherSession);
    assert.equal((await api(anonymous,'/password/reset','POST',{token:secret,password:changedPassword,confirmPassword:'different'})).status,400);
    const body={token:secret,password:changedPassword,confirmPassword:changedPassword};
    const results=await Promise.all([api(anonymous,'/password/reset','POST',body),api(anonymous,'/password/reset','POST',body)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
    assert.equal((await api(owner,'/session')).status,401);assert.equal((await api(otherSession,'/session')).status,401);
    assert.equal((await api(anonymous,'/session')).status,401);
    assert.equal((await api(anonymous,'/password/reset','POST',body)).status,400);
    assert.equal((await api(owner,'/login','POST',{email:'owner@example.test',password})).status,401);
    assert.equal((await api(owner,'/login','POST',{email:'owner@example.test',password:changedPassword})).status,200);await identity(owner);
    await server.lazo.mail.flush();assert.ok(sent.some(m=>m.subject==='Tu contraseña de LAZO se actualizó'));
  });
  await t.test('expired tokens cannot change a password',async()=>{
    assert.equal((await api(anonymous,'/password/forgot','POST',{email:'owner@example.test'})).status,202);await server.lazo.mail.flush();
    const recent=sent.filter(m=>m.subject==='Recupera tu acceso a LAZO').at(-1).text.match(/#reset=([\w-]+)/)[1];
    store.run('UPDATE password_resets SET expires=? WHERE hash=?',now()-1,digest(recent));
    assert.equal((await api(anonymous,'/password/reset','POST',{token:recent,password,confirmPassword:password})).status,400);
  });
  await t.test('ambiguous SMTP failures are not retried or exposed, and requests are rate limited',async()=>{
    mode='unknown';
    const response=await api(anonymous,'/password/forgot','POST',{email:'owner@example.test'});
    assert.equal(response.status,202);await server.lazo.mail.flush();const attempts=deliveries;
    assert.ok(store.get("SELECT 1 FROM mail_jobs WHERE state='unknown' AND payload=''") );
    await server.lazo.mail.flush();assert.equal(deliveries,attempts);
    assert.equal(JSON.stringify(response).includes('PRIVATE_PROVIDER_DETAILS'),false);
    assert.equal((await api(anonymous,'/password/forgot','POST',{email:'owner@example.test'})).status,429);
    mode='ok';
  });
  await t.test('email invitations retain single-use and role controls and expire superseded links',async()=>{
    mode='ok';
    const first=await api(owner,'/invitations','POST',{email:'invitee@example.test',role:'agent',sendEmail:true});
    assert.equal(first.status,201);assert.equal(first.data.emailQueued,true);await server.lazo.mail.flush();
    assert.ok(sent.some(m=>m.to.address==='invitee@example.test'&&m.text.includes(first.data.url)));
    assert.equal((await api(owner,'/invitations/email/'+first.data.emailJobId)).data.state,'accepted');
    const otherCompany=(await api(owner,'/companies','POST',{name:'Separate company QA'})).data.id;
    const separate=client();await api(separate,'/login','POST',{email:'owner@example.test',password:changedPassword});await identity(separate);
    await api(separate,'/companies/switch','POST',{companyId:otherCompany});await identity(separate);
    assert.equal((await api(separate,'/invitations/email/'+first.data.emailJobId)).status,404);
    const firstToken=new URL(first.data.url).hash.slice('#invite='.length);
    const second=await api(owner,'/invitations','POST',{email:'invitee@example.test',role:'agent',sendEmail:true});
    assert.equal(second.status,201);assert.notEqual(second.data.url,first.data.url);
    assert.equal((await api(anonymous,'/invitations/info','POST',{token:firstToken})).status,404);
    const member=client(),secondToken=new URL(second.data.url).hash.slice('#invite='.length);
    assert.equal((await api(member,'/invitations/accept','POST',{token:secondToken,name:'Invitee',password})).status,200);await identity(member);
    assert.equal((await api(member,'/invitations','POST',{email:'third@example.test',role:'admin',sendEmail:true})).status,403);
    assert.equal((await api(member,'/invitations/email/'+first.data.emailJobId)).status,403);
    assert.equal((await api(anonymous,'/invitations/accept','POST',{token:secondToken,name:'Invitee',password})).status,404);
  });
  await t.test('recovery queue capacity never discloses whether an account exists',async()=>{
    store.run("DELETE FROM limits WHERE key LIKE 'reset-%'");
    for(let i=0;i<300;i++)store.run("INSERT INTO mail_jobs VALUES(?,?,?,?,?,?,?,'queued',?,?,?)",randomUUID(),'invalid',null,null,null,'fixture@example.test','',now()+60000,now(),now());
    const response=await api(anonymous,'/password/forgot','POST',{email:'owner@example.test'});
    const absent=await api(anonymous,'/password/forgot','POST',{email:'absent@example.test'});
    assert.equal(response.status,202);assert.deepEqual(response,absent);
  });
});

test('without SMTP, recovery stays generic and email invitations cannot invalidate an existing link',async t=>{
  const config={database:':memory:',origin:'http://127.0.0.1:3031',masterKey:randomBytes(32).toString('base64'),bootstrapHash:digest('fixture')};
  const server=createServer(config);const auth=server.lazo.auth,store=server.lazo.store;
  t.after(()=>store.close());
  const session=await auth.bootstrap({token:'fixture',email:'owner@example.test',name:'Owner',company:'Company',password:'Temporary-QA-Password-2026'},'fixture');
  const owner=store.member(digest(session.secret));
  const first=auth.invite(owner,{email:'guest@example.test',role:'agent'});
  assert.throws(()=>auth.invite(owner,{email:'guest@example.test',role:'agent',sendEmail:true}),/todavía no/);
  assert.ok(auth.inviteInfo(new URL(first.url).hash.slice('#invite='.length)));
  assert.deepEqual(await auth.requestReset({email:'owner@example.test'},'fixture'),await auth.requestReset({email:'absent@example.test'},'fixture'));
  assert.equal(store.get('SELECT COUNT(*) AS n FROM password_resets').n,0);
});
