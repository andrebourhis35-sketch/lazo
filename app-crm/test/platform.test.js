import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes,randomUUID,createHmac } from 'node:crypto';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createServer } from '../src/server.js';
import { digest,now } from '../src/core.js';
import { openStore } from '../src/store.js';
import { laterStatus } from '../src/whatsapp.js';

test('platform: accounts, tenant isolation, persistence and signed WhatsApp lifecycle',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'lazo-test-')),database=join(directory,'db.sqlite');
  let calls=0,mode='ok',beforeResponse=null,phoneGate=null;
  const fakeFetch=async(url,options)=>{
    const path=new URL(url).pathname;
    if(path.endsWith('/phone_numbers')){if(phoneGate){const gate=phoneGate;phoneGate=null;await gate();}return Response.json({data:[{id:'10001'}]});}
    if(path.endsWith('/message_templates'))return Response.json({data:[{name:'hello_world',language:'en_US',status:'APPROVED',components:[{type:'BODY',text:'Hello World'}]}]});
    if(path.endsWith('/messages')){
      calls++;if(mode==='timeout')throw new Error('Timeout with SECRET_SHOULD_NOT_LEAK');
      const id='wamid.out.'+calls;if(beforeResponse)beforeResponse(id);
      return Response.json({messages:[{id}]});
    }
    return Response.json({success:true});
  };
  const config={database,origin:'http://127.0.0.1:3031',secureCookies:false,masterKey:randomBytes(32).toString('base64'),bootstrapHash:digest('setup-token'),testRecipient:'51900000001'};
  const server=createServer(config,{fetchImpl:fakeFetch});server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`,store=server.lazo.store;
  function client(){return {cookie:'',csrf:'',company:'',user:''};}const owner=client(),outsider=client(),agent=client();
  async function api(c,path,method='GET',data,extra={}){
    const r=await fetch(base+'/api/crm'+path,{method,headers:{Origin:config.origin,'Content-Type':'application/json','X-Lazo-Client':'1',...(c.cookie?{Cookie:c.cookie}:{}),...(c.csrf?{'X-CSRF-Token':c.csrf}:{}),'X-Lazo-Company':c.company,'X-Lazo-User':c.user,...extra},body:data===undefined?undefined:JSON.stringify(data)});
    if(r.headers.get('set-cookie'))c.cookie=r.headers.get('set-cookie').split(';')[0];
    const result=await r.json();return {status:r.status,data:result,headers:r.headers};
  }
  async function session(c){const r=await api(c,'/session');assert.equal(r.status,200);c.csrf=r.data.csrf;c.company=r.data.company.id;c.user=r.data.user.id;return r.data;}
  const password='Correct-horse-test-317';let companyA,companyB,contact,invitation,agentId;
  try{
    await t.test('unauthenticated requests and foreign origins are rejected',async()=>{
      assert.equal((await api(owner,'/contacts')).status,401);
      assert.equal((await api(owner,'/bootstrap','POST',{}, {Origin:'https://attacker.test'})).status,403);
      assert.equal((await api(owner,'/bootstrap','POST',{token:'wrong'})).status,403);
    });
    await t.test('bootstrap consumes the private activation link once and hashes passwords',async()=>{
      const r=await api(owner,'/bootstrap','POST',{token:'setup-token',name:'Owner',company:'Company A',email:'owner@example.com',password});assert.equal(r.status,200);
      const s=await session(owner);companyA=s.company.id;
      assert.notEqual(store.get('SELECT password FROM users').password,password);
      assert.equal((await api(outsider,'/bootstrap','POST',{token:'setup-token',name:'Owner',company:'Other',email:'other@example.com',password})).status,409);
      assert.equal((await api(owner,'/contacts','POST',{name:'Client',phone:'51900000001'},{'X-CSRF-Token':''})).status,403);
    });
    await t.test('contacts persist; separate company cannot read or mutate their IDs',async()=>{
      contact=(await api(owner,'/contacts','POST',{name:'Client',phone:'51900000001'})).data;
      assert.ok(contact.id);
      assert.equal((await api(owner,'/contacts/'+contact.id,'PATCH',{note:'Persistent note',stage:'Propuesta enviada'})).status,200);
      companyB=(await api(owner,'/companies','POST',{name:'Company B'})).data.id;
      assert.equal((await api(owner,'/companies/switch','POST',{companyId:companyB})).status,200);
      assert.equal((await api(owner,'/contacts')).status,409);
      assert.equal((await api(owner,'/contacts','POST',{name:'Wrong context',phone:'51900000009'})).status,409);
      await session(owner);
      assert.equal((await api(owner,'/contacts')).data.contacts.length,0);
      for(const [suffix,method,data] of [['','PATCH',{note:'Intrusion'}],['/messages','GET'],['/messages','POST',{type:'text',clientId:randomUUID(),text:'x'}],['/read','POST',{}]])assert.equal((await api(owner,'/contacts/'+contact.id+suffix,method,data)).status,404);
      const otherConnection=await api(owner,'/whatsapp','GET');assert.equal(otherConnection.data.configured,false);
      await api(owner,'/companies/switch','POST',{companyId:companyA});await session(owner);
      assert.equal((await api(owner,'/contacts')).data.contacts[0].note,'Persistent note');
    });
    await t.test('invitation is single-use and an agent cannot escalate access',async()=>{
      invitation=(await api(owner,'/invitations','POST',{email:'agent@example.com',role:'agent'})).data.url.split('invite=')[1];
      assert.equal((await api(agent,'/invitations/accept','POST',{token:invitation,name:'Agent',password})).status,200);
      agentId=(await session(agent)).user.id;
      assert.equal((await api(outsider,'/invitations/accept','POST',{token:invitation,name:'Intruder',password})).status,404);
      for(const route of ['/invitations','/companies'])assert.equal((await api(agent,route,'POST',{email:'bad@example.com',role:'admin',name:'Other'})).status,403);
      assert.equal((await api(agent,'/whatsapp')).status,403);
    });
    const credentials={accessToken:'fake-access-token',appSecret:'fake-app-secret',wabaId:'20001',phoneId:'10001',graphVersion:'v25.0'};
    await t.test('connection checks ownership, encrypts secrets and prevents cross-company reuse',async()=>{
      assert.equal((await api(owner,'/whatsapp','PUT',credentials)).status,200);
      const row=store.get('SELECT * FROM connections WHERE company_id=?',companyA);assert.equal(row.config.includes('fake-access-token'),false);
      const safe=(await api(owner,'/whatsapp')).data;assert.equal(JSON.stringify(safe).includes('fake-access-token'),false);
      await api(owner,'/companies/switch','POST',{companyId:companyB});await session(owner);
      assert.equal((await api(owner,'/whatsapp','PUT',credentials)).status,409);
      await api(owner,'/companies/switch','POST',{companyId:companyA});await session(owner);
    });
    await t.test('another number or WABA cannot overwrite a company connection',async()=>{
      const before=store.get('SELECT * FROM connections WHERE company_id=?',companyA);
      for(const change of [{phoneId:'99999'},{wabaId:'99999'}]) {
        const r=await api(owner,'/whatsapp','PUT',{...credentials,...change});
        assert.equal(r.status,409);assert.match(r.data.error,/espacio de empresa separado/);
        assert.deepEqual(store.get('SELECT * FROM connections WHERE company_id=?',companyA),before);
      }
    });
    await t.test('token renewal preserves secrets and refuses a concurrent stale update',async()=>{
      let release,entered;const waiting=new Promise(resolve=>{entered=resolve;});
      phoneGate=()=>{entered();return new Promise(resolve=>{release=resolve;});};
      const stale=api(owner,'/whatsapp','PUT',{accessToken:'stale-fake-token'});await waiting;
      assert.equal((await api(owner,'/whatsapp','PUT',{accessToken:'renewed-fake-token'})).status,200);
      const renewed=store.get('SELECT * FROM connections WHERE company_id=?',companyA);
      release();assert.equal((await stale).status,409);
      assert.deepEqual(store.get('SELECT * FROM connections WHERE company_id=?',companyA),renewed);
      const safe=(await api(owner,'/whatsapp')).data;
      assert.equal(safe.phoneId,'10001');assert.equal(safe.hasAppSecret,true);
      assert.equal(JSON.stringify(safe).includes('fake-token'),false);
    });
    function event(value){return {object:'whatsapp_business_account',entry:[{id:'20001',changes:[{field:'messages',value:{metadata:{phone_number_id:'10001'},...value}}]}]};}
    function signed(value,secret='fake-app-secret'){
      const raw=Buffer.from(JSON.stringify(value));return {raw,signature:'sha256='+createHmac('sha256',secret).update(raw).digest('hex')};
    }
    async function postHook(value,secret){const {raw,signature}=signed(value,secret);const r=await fetch(base+'/webhooks/whatsapp',{method:'POST',headers:{'X-Hub-Signature-256':signature},body:raw});return r.status;}
    await t.test('invalid signatures cannot mutate data; inbound retries are idempotent',async()=>{
      const msg=event({messages:[{id:'wamid.in.1',from:'51900000001',timestamp:String(Math.floor(now()/1000)),type:'text',text:{body:'Hello from customer'}}]});
      assert.equal(await postHook(msg,'wrong'),403);assert.equal(store.get('SELECT COUNT(*) n FROM messages').n,0);
      assert.equal(await postHook(msg),200);assert.equal(await postHook(msg),200);
      assert.equal(store.get('SELECT COUNT(*) n FROM messages').n,1);assert.equal(store.contact(companyA,contact.id).unread,1);
      const verify=server.lazo.wa.safe(companyA).verifyToken;
      const result=await fetch(base+'/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token='+verify+'&hub.challenge=1234');assert.equal(await result.text(),'1234');
    });
    await t.test('text send, idempotency and out-of-order read receipts',async()=>{
      assert.equal(laterStatus('sent','failed'),'failed');assert.equal(laterStatus('failed','sent'),'failed');
      assert.equal(laterStatus('delivered','failed'),'delivered');
      const clientId=randomUUID();const payload={type:'text',text:'Reply',clientId};
      const first=(await api(owner,`/contacts/${contact.id}/messages`,'POST',payload)).data;assert.equal(first.status,'accepted');
      const callsBefore=calls;assert.equal((await api(owner,`/contacts/${contact.id}/messages`,'POST',payload)).data.id,first.id);assert.equal(calls,callsBefore);
      for(const status of ['read','delivered','sent'])assert.equal(await postHook(event({statuses:[{id:first.wa_id,status}]})),200);
      assert.equal(store.get('SELECT status FROM messages WHERE id=?',first.id).status,'read');
      beforeResponse=waId=>{const value=event({statuses:[{id:waId,status:'delivered'}]}),s=signed(value);server.lazo.wa.receive(s.raw,s.signature);};
      assert.equal((await api(owner,`/contacts/${contact.id}/messages`,'POST',{type:'text',text:'Second',clientId:randomUUID()})).data.status,'delivered');beforeResponse=null;
    });
    await t.test('text outside 24 hours is blocked; approved template works only for allowed test number',async()=>{
      store.run('UPDATE contacts SET last_inbound=0 WHERE id=?',contact.id);
      assert.equal((await api(owner,`/contacts/${contact.id}/messages`,'POST',{type:'text',text:'Outside window',clientId:randomUUID()})).status,400);
      assert.equal((await api(owner,`/contacts/${contact.id}/messages`,'POST',{type:'template',templateName:'hello_world',language:'en_US',clientId:randomUUID()})).data.status,'accepted');
      const other=(await api(owner,'/contacts','POST',{name:'Other',phone:'51900000002'})).data;
      assert.equal((await api(owner,`/contacts/${other.id}/messages`,'POST',{type:'template',templateName:'hello_world',language:'en_US',clientId:randomUUID()})).status,403);
    });
    await t.test('uncertain network send is recorded and never retried automatically',async()=>{
      mode='timeout';const clientId=randomUUID(),payload={type:'template',templateName:'hello_world',language:'en_US',clientId};
      const result=await api(owner,`/contacts/${contact.id}/messages`,'POST',payload);assert.equal(result.status,502);assert.equal(JSON.stringify(result.data).includes('SECRET_SHOULD_NOT_LEAK'),false);
      const count=calls;assert.equal((await api(owner,`/contacts/${contact.id}/messages`,'POST',payload)).data.status,'unknown');assert.equal(calls,count);mode='ok';
    });
    await t.test('membership revocation invalidates active sessions; expired sessions rejected',async()=>{
      assert.equal((await api(owner,'/members/'+agentId,'DELETE',{})).status,200);assert.equal((await api(agent,'/contacts')).status,401);
      const next=(await api(owner,'/invitations','POST',{email:'agent@example.com',role:'agent'})).data.url.split('invite=')[1];
      assert.equal((await api(outsider,'/invitations/accept','POST',{token:next,password:'incorrect-password'})).status,403);
      assert.equal((await api(outsider,'/invitations/accept','POST',{token:next,password})).status,200);
      await session(outsider);assert.equal((await api(outsider,'/contacts')).status,200);
      store.run('UPDATE sessions SET expires=0');assert.equal((await api(owner,'/session')).status,401);
    });
    await t.test('database survives reopening without storing passwords/tokens as plaintext',()=>{
      const second=openStore(database);assert.equal(second.contact(companyA,contact.id).note,'Persistent note');assert.ok(second.get('SELECT COUNT(*) n FROM messages').n>1);second.close();
    });
  }finally{await new Promise(resolve=>server.close(resolve));store.close();rmSync(directory,{recursive:true,force:true});}
});
