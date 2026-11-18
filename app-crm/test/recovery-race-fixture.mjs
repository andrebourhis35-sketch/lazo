// Offline regression fixtures. All accounts, keys and HTTP traffic are synthetic/local.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { request } from 'node:http';
import { once } from 'node:events';
import { createServer } from '../src/server.js';
import { digest, now, vault } from '../src/core.js';

const oldPassword='Synthetic-Old-Password-2026',newPassword='Synthetic-New-Password-2026';
async function fixture(fetchImpl=async()=>{throw new Error('External requests are not allowed in this fixture');}) {
  const config={database:':memory:',origin:'http://127.0.0.1:3031',masterKey:randomBytes(32).toString('base64'),bootstrapHash:digest('fixture'),
    smtp:{host:'smtp.zoho.com',port:465,user:'fixture@example.test',password:'SYNTHETIC_ONLY'}};
  const server=createServer(config,{fetchImpl,mailTransportFactory:()=>({async sendMail(m){return {accepted:[m.to.address]};},close(){}})});
  const {store,auth}=server.lazo;
  const initial=await auth.bootstrap({token:'fixture',email:'owner@example.test',name:'Owner QA',company:'Company QA',password:oldPassword},'fixture');
  const owner=store.member(digest(initial.secret));
  async function resetData() {
    await auth.requestReset({email:'owner@example.test'},'fixture');
    const job=store.get("SELECT * FROM mail_jobs WHERE kind='reset' ORDER BY created DESC LIMIT 1");
    const body=vault(config.masterKey).open(job.payload,'mail:'+job.id).body;
    return {token:body.match(/#reset=([\w-]+)/)[1],password:newPassword,confirmPassword:newPassword};
  }
  async function close() {
    await Promise.all([server.lazo.mail.stop(),server.lazo.wa.media.stop()]);
    if(server.listening){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    store.close();
  }
  return {server,store,auth,owner,initial,config,resetData,close};
}

async function loginCase() {
  const f=await fixture();
  try {
    const data=await f.resetData();
    const [reset,login]=await Promise.allSettled([f.auth.resetPassword(data,'fixture'),
      f.auth.login({email:'owner@example.test',password:oldPassword},'fixture')]);
    assert.equal(reset.status,'fulfilled');
    assert.equal(login.status,'rejected');
    assert.equal(f.store.get('SELECT COUNT(*) AS n FROM sessions').n,0);
  } finally {await f.close();}
}

async function inviteCase() {
  const f=await fixture();
  try {
    const company=randomUUID(),inviter=randomUUID();
    f.store.run('INSERT INTO companies VALUES(?,?,?)',company,'Inviting company QA',now());f.store.ensureWorkspace(company);
    const password=f.store.get('SELECT password FROM users WHERE id=?',f.owner.user_id).password;
    f.store.run('INSERT INTO users VALUES(?,?,?,?,?)',inviter,'inviter@example.test','Inviter QA',password,now());
    f.store.run("INSERT INTO memberships VALUES(?,?,'owner')",company,inviter);
    const active=f.store.session(inviter,company),actor=f.store.member(digest(active.secret));
    const invitation=f.auth.invite(actor,{email:'owner@example.test',role:'agent'});
    const token=new URL(invitation.url).hash.slice('#invite='.length);
    const data=await f.resetData();
    const [reset,accept]=await Promise.allSettled([f.auth.resetPassword(data,'fixture'),
      f.auth.acceptInvite({token,password:oldPassword},null)]);
    assert.equal(reset.status,'fulfilled');assert.equal(accept.status,'rejected');
    assert.equal(f.store.get('SELECT 1 FROM memberships WHERE company_id=? AND user_id=?',company,f.owner.user_id),undefined);
    assert.equal(f.auth.inviteInfo(token).used,0);
    await assert.rejects(f.auth.acceptInvite({token},f.owner));
    assert.equal(f.auth.inviteInfo(token).used,0);
  } finally {await f.close();}
}

async function bodyCase(route,makeBody,check) {
  const f=await fixture();let pending;
  try {
    const data=await f.resetData(),body=JSON.stringify(makeBody(f));
    f.server.listen(0,'127.0.0.1');await once(f.server,'listening');
    const entered=once(f.server,'request');
    const response=new Promise((resolve,reject)=>{
      pending=request(`http://127.0.0.1:${f.server.address().port}/api/crm${route}`,{method:'POST',headers:{
        Origin:f.config.origin,'X-Lazo-Client':'1','Content-Type':'application/json','Content-Length':Buffer.byteLength(body),
        Cookie:'lazo_dev_session='+f.initial.secret,'X-CSRF-Token':f.initial.csrf,
        'X-Lazo-Company':f.owner.company_id,'X-Lazo-User':f.owner.user_id,Connection:'close'}},res=>{
          res.resume();res.on('end',()=>resolve({status:res.statusCode,cookie:res.headers['set-cookie']}));
        });
      pending.on('error',reject);pending.write(body.slice(0,5));
    });
    await entered;
    await f.auth.resetPassword(data,'fixture');
    pending.end(body.slice(5));
    const result=await response;assert.equal(result.status,401);assert.equal(result.cookie,undefined);
    check(f);
  } finally {pending?.destroy();await f.close();}
}

async function connectionCase() {
  let finishCheck,checkStarted;
  const started=new Promise(resolve=>{checkStarted=resolve;});
  const check=new Promise(resolve=>{finishCheck=resolve;});
  const f=await fixture(async()=>{checkStarted();await check;return Response.json({data:[{id:'10001'}]});});
  try {
    const original={phoneId:'10001',wabaId:'20001',graphVersion:'v25.0',accessToken:'SYNTHETIC_OLD_TOKEN',appSecret:'SYNTHETIC_SECRET',verifyToken:'SYNTHETIC_VERIFY'};
    f.server.lazo.wa.saveRaw(f.owner.company_id,original);
    const data=await f.resetData();
    f.server.listen(0,'127.0.0.1');await once(f.server,'listening');
    const pending=fetch(`http://127.0.0.1:${f.server.address().port}/api/crm/whatsapp`,{method:'PUT',headers:{
      Origin:f.config.origin,'X-Lazo-Client':'1','Content-Type':'application/json',
      Cookie:'lazo_dev_session='+f.initial.secret,'X-CSRF-Token':f.initial.csrf,
      'X-Lazo-Company':f.owner.company_id,'X-Lazo-User':f.owner.user_id},body:JSON.stringify({...original,accessToken:'SYNTHETIC_NEW_TOKEN'})});
    await started;await f.auth.resetPassword(data,'fixture');finishCheck();
    const response=await pending;assert.equal(response.status,401);await response.json();
    const stored=f.store.get('SELECT config FROM connections WHERE company_id=?',f.owner.company_id);
    assert.equal(vault(f.config.masterKey).open(stored.config,f.owner.company_id).accessToken,original.accessToken);
  } finally {finishCheck?.();await f.close();}
}

const mode=process.argv[2];
if(mode==='login')await loginCase();
else if(mode==='invitation')await inviteCase();
else if(mode==='connection')await connectionCase();
else if(mode==='body') {
  await bodyCase('/companies/switch',f=>({companyId:f.auth.newCompany(f.owner,{name:'Second QA'}).id}),
    f=>assert.equal(f.store.get('SELECT COUNT(*) AS n FROM sessions').n,0));
  await bodyCase('/contacts',()=>({name:'Synthetic contact',phone:'51900000001'}),
    f=>assert.equal(f.store.get('SELECT COUNT(*) AS n FROM contacts').n,0));
} else throw new Error('Unknown test mode');
console.log(JSON.stringify({ok:true,mode}));
