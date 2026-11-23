import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash,createHmac} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from '../src/server.js';
import {openStore} from '../src/store.js';
import {digest,now,vault} from '../src/core.js';
import {mediaFilename} from '../src/media.js';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const voice=Buffer.alloc(47);
voice.write('OggS');voice[26]=1;voice[27]=19;voice.write('OpusHead',28);

test('additive migration preserves the existing database and seeds company stages only once',()=>{
  const dir=mkdtempSync(join(tmpdir(),'lazo-migration-')),path=join(dir,'legacy.sqlite');
  try {
    const old=new DatabaseSync(path);
    old.exec("CREATE TABLE companies(id TEXT PRIMARY KEY,name TEXT NOT NULL,created INTEGER NOT NULL);INSERT INTO companies VALUES('legacy','Legacy company',1);CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,name TEXT,password TEXT,created INTEGER);CREATE TABLE contacts(id TEXT PRIMARY KEY,company_id TEXT,name TEXT,phone TEXT,email TEXT DEFAULT '',location TEXT DEFAULT '',stage TEXT,owner_id TEXT,note TEXT DEFAULT '',resolved INTEGER DEFAULT 0,unread INTEGER DEFAULT 0,last_inbound INTEGER DEFAULT 0,created INTEGER,updated INTEGER);INSERT INTO contacts(id,company_id,name,phone,stage,note,created,updated) VALUES('old-contact','legacy','Legacy contact','51900000001','Propuesta enviada','Keep this note',1,1);CREATE TABLE messages(id TEXT PRIMARY KEY,company_id TEXT,contact_id TEXT,direction TEXT,body TEXT,type TEXT,status TEXT,wa_id TEXT,client_id TEXT,error_code TEXT,created INTEGER,updated INTEGER);INSERT INTO messages VALUES('old-message','legacy','old-contact','in','Keep this message','text','received',NULL,NULL,NULL,1,1)");
    old.close();
    let store=openStore(path);
    assert.equal(store.contact('legacy','old-contact').note,'Keep this note');
    assert.equal(store.contact('legacy','old-contact').tags,'[]');
    assert.equal(store.get("SELECT body,attachment_id FROM messages WHERE id='old-message'").body,'Keep this message');
    assert.equal(store.all("SELECT * FROM pipeline_stages WHERE company_id='legacy'").length,4);
    assert.ok(store.get("SELECT analytics_since FROM workspace_settings WHERE company_id='legacy'").analytics_since>1);
    store.close();store=openStore(path);
    assert.equal(store.all("SELECT * FROM pipeline_stages WHERE company_id='legacy'").length,4);
    assert.equal(store.get('PRAGMA integrity_check').integrity_check,'ok');store.close();
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('daily workflow: private files, organization, shared replies, custom sales stages and real statistics',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'lazo-daily-')),assets=new Map([['30001',{bytes:png,mime:'image/png'}],['30002',{bytes:pdf,mime:'application/pdf'}],['30003',{bytes:png,mime:'image/png'}],['30004',{bytes:voice,mime:'audio/ogg; codecs=opus'}]]);
  let uploads=0,sends=0,forbiddenRequests=0,mode='normal',delayUpload=false,transcriptions=0;
  const metaCalls=[];
  const fakeFetch=async(url,options={})=>{
    const u=new URL(url);metaCalls.push({host:u.hostname,path:u.pathname,method:options.method||'GET'});
    if(u.href==='https://api.openai.com/v1/audio/transcriptions'){
      transcriptions++;
      assert.equal(options.body.get('file').name,'nota-de-voz.ogg');
      assert.deepEqual(Buffer.from(await options.body.get('file').arrayBuffer()),voice);
      await new Promise(resolve=>setTimeout(resolve,30));
      return Response.json({text:'Hola, quiero consultar por mi pedido.'});
    }
    if(u.hostname==='attacker.example'){forbiddenRequests++;throw new Error('Must never leak authorization');}
    if(u.pathname.endsWith('/phone_numbers'))return Response.json({data:[{id:'10001'}]});
    if(u.pathname.endsWith('/message_templates'))return Response.json({data:[]});
    if(u.pathname.endsWith('/media')&&options.method==='POST') {
      uploads++;if(delayUpload)await new Promise(resolve=>setTimeout(resolve,60));
      const file=options.body.get('file');assert.equal(options.body.get('messaging_product'),'whatsapp');
      const id=String(40000+uploads);assets.set(id,{bytes:Buffer.from(await file.arrayBuffer()),mime:file.type});
      return Response.json({id});
    }
    if(u.pathname.endsWith('/messages')&&options.method==='POST'){sends++;return Response.json({messages:[{id:'wamid.daily.'+sends}]});}
    if(u.hostname==='lookaside.fbsbx.com') {const a=assets.get(u.searchParams.get('id'));return new Response(a.bytes,{headers:{'Content-Type':a.mime}});}
    const id=u.pathname.split('/').at(-1),a=assets.get(id);
    if(a) {
      assert.equal(u.searchParams.get('phone_number_id'),'10001');
      return Response.json({id,url:mode==='ssrf'?'https://attacker.example/leak':'https://lookaside.fbsbx.com/whatsapp_business/attachments/?id='+id,mime_type:a.mime,file_size:mode==='oversize'?20*1024*1024:a.bytes.length,sha256:mode==='nohash'?undefined:mode==='badhash'?'invalid':createHash('sha256').update(a.bytes).digest('hex')});
    }
    return Response.json({success:true});
  };
  const key=randomBytes(32).toString('base64'),config={database:join(dir,'db.sqlite'),origin:'http://127.0.0.1:3031',secureCookies:false,masterKey:key,bootstrapHash:digest('daily-setup'),testRecipient:'51900000001'};
  const server=createServer(config,{fetchImpl:fakeFetch});server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port,{store,wa}=server.lazo;
  const owner={},agent={},nobody={};let company,otherCompany,contact,firstImage,secondPdf,replyId;
  const password='Local-QA-password-1837';
  async function api(c,path,method='GET',data,binary=false) {
    const form=data instanceof FormData;
    const response=await fetch(base+'/api/crm'+path,{method,headers:{Origin:config.origin,'X-Lazo-Client':'1',...(!form?{'Content-Type':'application/json'}:{}),...(c.cookie?{Cookie:c.cookie}:{}),...(c.csrf?{'X-CSRF-Token':c.csrf}:{}),'X-Lazo-Company':c.company||'','X-Lazo-User':c.user||''},body:data===undefined?undefined:form?data:JSON.stringify(data)});
    if(response.headers.get('set-cookie'))c.cookie=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,data:binary&&response.ok?Buffer.from(await response.arrayBuffer()):await response.json(),headers:response.headers};
  }
  async function session(c) {const r=await api(c,'/session');assert.equal(r.status,200);c.company=r.data.company.id;c.user=r.data.user.id;c.csrf=r.data.csrf;return r.data;}
  async function change(companyId) {assert.equal((await api(owner,'/companies/switch','POST',{companyId})).status,200);await session(owner);}
  function event(messages){return {object:'whatsapp_business_account',entry:[{id:'20001',changes:[{field:'messages',value:{metadata:{phone_number_id:'10001'},messages}}]}]};}
  async function webhook(value,secret='daily-secret') {
    const raw=Buffer.from(JSON.stringify(value)),signature='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
    const r=await fetch(base+'/webhooks/whatsapp',{method:'POST',headers:{'X-Hub-Signature-256':signature},body:raw});return r.status;
  }
  function uploadBody(bytes=png,mime='image/png',clientId=randomUUID(),caption='Test attachment') {
    const form=new FormData();form.set('file',new Blob([bytes],{type:mime}),mime==='application/pdf'?'test.pdf':'test.png');form.set('clientId',clientId);form.set('caption',caption);return form;
  }
  try {
    assert.equal((await api(owner,'/bootstrap','POST',{token:'daily-setup',name:'Owner',company:'Company A',email:'owner@example.com',password})).status,200);await session(owner);company=owner.company;
    contact=(await api(owner,'/contacts','POST',{name:'Test contact',phone:'51900000001'})).data;
    const invite=(await api(owner,'/invitations','POST',{email:'agent@example.com',role:'agent'})).data.url.split('invite=')[1];
    assert.equal((await api(agent,'/invitations/accept','POST',{token:invite,name:'Agent',password})).status,200);await session(agent);
    assert.equal((await api(owner,'/whatsapp','PUT',{accessToken:'PRIVATE_TOKEN',appSecret:'daily-secret',phoneId:'10001',wabaId:'20001',graphVersion:'v25.0'})).status,200);
    await t.test('tags persist, normalize duplicates and reject malformed input',async()=>{
      const r=await api(owner,'/contacts/'+contact.id,'PATCH',{tags:['Interesado','interesado','Mayorista'],ownerId:agent.user});
      assert.equal(r.status,200);assert.deepEqual(JSON.parse(r.data.tags),['Interesado','Mayorista']);
      assert.equal((await api(owner,'/contacts/'+contact.id,'PATCH',{tags:'not-an-array'})).status,400);
      assert.equal((await api(owner,'/contacts/'+contact.id,'PATCH',{tags:['bad,tag']})).status,400);
      assert.equal((await api(owner,'/contacts/'+contact.id,'PATCH',{tags:Array(9).fill('x')})).status,400);
    });
    await t.test('quick replies are shared, scoped and editable only by administrators',async()=>{
      let r=await api(owner,'/quick-replies','POST',{title:'Saludo',shortcut:'saludo',body:'Hola <cliente>, ¿cómo te ayudo?'});assert.equal(r.status,201);replyId=r.data.replies[0].id;
      assert.equal((await api(agent,'/quick-replies')).data.replies[0].body,'Hola <cliente>, ¿cómo te ayudo?');
      assert.equal((await api(agent,'/quick-replies','POST',{title:'X',shortcut:'x',body:'X'})).status,403);
      assert.equal((await api(agent,'/quick-replies/'+replyId,'DELETE',{})).status,403);
      assert.equal((await api(owner,'/quick-replies','POST',{title:'Duplicate',shortcut:'saludo',body:'X'})).status,409);
      assert.equal((await api(owner,'/quick-replies/'+replyId,'PATCH',{title:'Bienvenida',shortcut:'saludo',body:'Hola, bienvenido.'})).status,200);
    });
    await t.test('custom stages preserve contacts through rename and order; occupied stages are protected',async()=>{
      let r=await api(owner,'/pipeline/stages','POST',{name:'Seguimiento'});assert.equal(r.status,201);const custom=r.data.stages.find(p=>p.name==='Seguimiento');
      assert.equal((await api(agent,'/pipeline/stages','POST',{name:'Denied'})).status,403);
      await api(owner,'/contacts/'+contact.id,'PATCH',{stage:'Seguimiento'});
      assert.equal((await api(owner,'/pipeline/stages/'+custom.id,'DELETE',{})).status,409);
      r=await api(owner,'/pipeline/stages/'+custom.id,'PATCH',{name:'Cierre & revisión'});assert.equal(r.status,200);
      assert.equal((await api(owner,'/contacts')).data.contacts[0].stage,'Cierre & revisión');
      const ids=r.data.stages.map(p=>p.id).reverse();assert.equal((await api(owner,'/pipeline/order','PUT',{ids})).status,200);
      assert.equal((await api(owner,'/pipeline')).data.stages[0].id,ids[0]);
      assert.equal((await api(owner,'/pipeline/order','PUT',{ids:[ids[0],ids[0]]})).status,400);
      assert.equal((await api(owner,'/pipeline/stages/'+custom.id,'PATCH',{isWon:true})).status,200);
      assert.equal((await api(owner,'/pipeline')).data.stages.filter(s=>s.is_won).length,1);
      const fresh=(await api(owner,'/contacts','POST',{name:'Second contact',phone:'51900000002'})).data;
      assert.notEqual(fresh.stage,'Cierre & revisión');
    });
    await t.test('signed image and PDF webhooks are cached encrypted and retries do not duplicate assets',async()=>{
      const payload=event([{id:'wamid.in.image',from:'51900000001',timestamp:String(Math.floor(now()/1000)),type:'image',image:{id:'30001',mime_type:'image/png',sha256:createHash('sha256').update(png).digest('base64'),caption:'Imagen recibida'}},{id:'wamid.in.pdf',from:'51900000001',timestamp:String(Math.floor(now()/1000)),type:'document',document:{id:'30002',mime_type:'application/pdf',filename:'../../Unsafe.pdf',caption:'PDF recibido'}}]);
      assert.equal(await webhook(payload,'wrong'),403);assert.equal(store.get('SELECT count(*) AS n FROM media_assets').n,0);
      assert.equal(await webhook(payload),200);await wa.media.warm();assert.equal(await webhook(payload),200);
      const messages=(await api(owner,'/contacts/'+contact.id+'/messages')).data.messages;
      firstImage=messages.find(m=>m.wa_id==='wamid.in.image');secondPdf=messages.find(m=>m.wa_id==='wamid.in.pdf');
      assert.equal(store.get('SELECT count(*) AS n FROM media_assets').n,2);
      for(const row of store.all('SELECT * FROM media_assets')) {assert.equal(row.state,'ready');assert.equal(Buffer.from(row.content).includes(row.mime==='image/png'?png:pdf),false);}
      assert.equal(firstImage.attachment.state,'ready');
      assert.equal((await api(owner,'/messages/'+firstImage.id+'/attachment','GET',undefined,true)).data.equals(png),true);
      const download=await api(agent,'/messages/'+secondPdf.id+'/attachment','GET',undefined,true);assert.equal(download.status,200);assert.ok(download.data.equals(pdf));assert.equal(download.headers.get('x-content-type-options'),'nosniff');assert.ok(download.headers.get('content-disposition').startsWith('attachment;'));
      assert.equal((await api(nobody,'/messages/'+firstImage.id+'/attachment')).status,401);
      assert.equal(JSON.stringify(messages).includes('PRIVATE_TOKEN'),false);
    });
    await t.test('file upload uses WhatsApp media IDs and concurrent repeats send only one message',async()=>{
      delayUpload=true;const clientId=randomUUID(),beforeUploads=uploads,beforeSends=sends;
      const results=await Promise.all([api(owner,'/contacts/'+contact.id+'/attachments','POST',uploadBody(png,'image/png',clientId)),api(owner,'/contacts/'+contact.id+'/attachments','POST',uploadBody(png,'image/png',clientId))]);delayUpload=false;
      assert.ok(results.every(r=>r.status===200));assert.equal(uploads,beforeUploads+1);assert.equal(sends,beforeSends+1);
      const sent=(await api(owner,'/contacts/'+contact.id+'/messages')).data.messages.find(m=>m.client_id===clientId);
      assert.ok(sent.attachment);assert.equal(sent.status,'accepted');
      assert.ok((await api(owner,'/messages/'+sent.id+'/attachment','GET',undefined,true)).data.equals(png));
      assert.equal((await api(owner,'/contacts/'+contact.id+'/attachments','POST',uploadBody(pdf,'application/pdf'))).status,200);
    });
    await t.test('MIME spoofing, oversize, closed service window and non-test destinations are rejected',async()=>{
      const before=uploads;
      assert.equal((await api(owner,'/contacts/'+contact.id+'/attachments','POST',uploadBody(Buffer.from('<html>not a PDF</html>'),'application/pdf'))).status,415);
      assert.equal((await api(owner,'/contacts/'+contact.id+'/attachments','POST',uploadBody(Buffer.alloc(10*1024*1024+1),'application/pdf'))).status,413);
      assert.equal((await api(owner,'/contacts/'+contact.id+'/attachments','POST',uploadBody(png,'image/png',randomUUID(),'x'.repeat(1025)))).status,400);
      store.run('UPDATE contacts SET last_inbound=0 WHERE id=?',contact.id);
      assert.equal((await api(owner,'/contacts/'+contact.id+'/attachments','POST',uploadBody())).status,400);
      store.run('UPDATE contacts SET last_inbound=? WHERE id=?',now(),contact.id);
      const other=store.get('SELECT id FROM contacts WHERE company_id=? AND phone=?',company,'51900000002');
      assert.equal((await api(owner,'/contacts/'+other.id+'/attachments','POST',uploadBody())).status,403);
      assert.equal(uploads,before);
      assert.equal(mediaFilename('evil\r\n/path.pdf','application/pdf').includes('\r'),false);
      assert.doesNotThrow(()=>encodeURIComponent(mediaFilename('x'.repeat(119)+'😀.pdf','application/pdf')));
      assert.doesNotThrow(()=>encodeURIComponent(mediaFilename('\ud800.pdf','application/pdf')));
      assert.throws(()=>vault(key).openBytes(store.get("SELECT content FROM media_assets WHERE state='ready' LIMIT 1").content,'wrong-company'));
    });
    await t.test('untrusted media redirects/URLs are blocked without forwarding credentials',async()=>{
      mode='ssrf';
      assert.equal(await webhook(event([{id:'wamid.in.ssrf',from:'51900000001',timestamp:String(Math.floor(now()/1000)),type:'image',image:{id:'30003',mime_type:'image/png'}}])),200);
      await wa.media.warm();
      const m=store.get("SELECT id FROM messages WHERE wa_id='wamid.in.ssrf'");
      const r=await api(owner,'/messages/'+m.id+'/attachment');
      assert.equal(r.status,502);assert.equal(forbiddenRequests,0);assert.equal(JSON.stringify(r.data).includes('PRIVATE_TOKEN'),false);
      store.run("UPDATE media_assets SET state='unavailable',size=0,attempts=3 WHERE id=(SELECT attachment_id FROM messages WHERE id=?)",m.id);
      mode='normal';
    });
    await t.test('missing integrity hashes and oversized provider metadata never produce a cached file',async()=>{
      for(const invalid of ['nohash','badhash','oversize']) {
        mode=invalid;const waId='wamid.invalid.'+invalid;
        assert.equal(await webhook(event([{id:waId,from:'51900000001',timestamp:String(Math.floor(now()/1000)),type:'image',image:{id:'30003',mime_type:'image/png'}}])),200);
        await wa.media.warm();
        const m=store.get('SELECT id,attachment_id FROM messages WHERE wa_id=?',waId);
        assert.equal((await api(owner,'/messages/'+m.id+'/attachment')).status,invalid==='oversize'?413:502);
        assert.equal(store.get('SELECT content FROM media_assets WHERE id=?',m.attachment_id).content,null);
        store.run("UPDATE media_assets SET state='unavailable',size=0,attempts=3 WHERE id=?",m.attachment_id);
      }
      mode='normal';
    });
    await t.test('files, replies, stages and statistics do not leak to another company',async()=>{
      otherCompany=(await api(owner,'/companies','POST',{name:'Company B'})).data.id;await change(otherCompany);
      const before=metaCalls.length;
      assert.equal((await api(owner,'/messages/'+firstImage.id+'/attachment')).status,404);assert.equal(metaCalls.length,before);
      assert.equal((await api(owner,'/quick-replies')).data.replies.length,0);
      assert.equal((await api(owner,'/quick-replies/'+replyId,'PATCH',{title:'Intrusion',shortcut:'x',body:'X'})).status,404);
      const foreign=store.get('SELECT id FROM pipeline_stages WHERE company_id=?',company);
      assert.equal((await api(owner,'/pipeline/stages/'+foreign.id,'PATCH',{name:'Intrusion'})).status,404);
      const statistics=(await api(owner,'/statistics?days=30')).data;assert.equal(statistics.metrics.incoming,0);assert.equal(statistics.metrics.outgoing,0);assert.ok(statistics.stages.every(s=>s.count===0));
      await change(company);
      assert.equal((await api(owner,'/quick-replies/'+replyId,'DELETE',{})).status,200);
      assert.equal(store.get('SELECT deleted FROM quick_replies WHERE id=?',replyId).deleted,1);
    });
    await t.test('voice webhook downloads Ogg Opus and saves one encrypted on-demand transcription',async()=>{
      const payload=event([{id:'wamid.in.voice',from:'51900000001',timestamp:String(Math.floor(now()/1000)),type:'audio',
        audio:{id:'30004',mime_type:'audio/ogg; codecs=opus',voice:true}}]);
      assert.equal(await webhook(payload),200);
      assert.equal(await webhook(payload),200);
      await wa.media.warm();
      const getVoice=async()=>(await api(owner,'/contacts/'+contact.id+'/messages')).data.messages.find(m=>m.wa_id==='wamid.in.voice');
      const message=await getVoice(),audioPath='/messages/'+message.id,transcriptPath=audioPath+'/transcription';
      assert.equal(message.body,'Nota de voz');
      assert.equal(message.attachment.mime,'audio/ogg');
      assert.equal(message.attachment.state,'ready');
      assert.equal(message.transcript,null);
      assert.equal((await api(owner,audioPath+'/attachment','GET',undefined,true)).data.equals(voice),true);
      assert.equal((await api(owner,transcriptPath,'POST',{})).status,409);
      assert.equal(transcriptions,0);
      assert.equal((await api(owner,'/flow-ai','POST',{enabled:true,apiKey:'sk-voice-synthetic-key'})).status,200);
      const results=await Promise.all([api(owner,transcriptPath,'POST',{}),api(agent,transcriptPath,'POST',{})]);
      const text='Hola, quiero consultar por mi pedido.';
      assert.ok(results.every(result=>result.status===200&&result.data.transcript===text));
      assert.equal((await getVoice()).transcript,text);
      assert.equal((await api(owner,transcriptPath,'POST',{})).data.transcript,text);
      assert.equal(transcriptions,1);
      assert.equal(store.get('SELECT transcript FROM voice_transcripts').transcript.includes(text),false);
      await change(otherCompany);
      assert.equal((await api(owner,transcriptPath,'POST',{})).status,404);
      await change(company);
    });
    await t.test('statistics use persisted messages, group customer turns and record actual sales transitions',async()=>{
      await change(otherCompany);
      const c=(await api(owner,'/contacts','POST',{name:'Metrics contact',phone:'51900000003'})).data;
      const when=now()-600000;
      const message=(direction,body,time,status)=>store.run('INSERT INTO messages(id,company_id,contact_id,direction,body,type,status,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',randomUUID(),otherCompany,c.id,direction,body,'text',status,time,time);
      message('in','First customer turn',when,'received');message('in','More context',when+20000,'received');message('out','Answer',when+90000,'delivered');message('in','New question',when+120000,'received');message('out','Failed reply',when+180000,'failed');
      const won=(await api(owner,'/pipeline')).data.stages.find(p=>p.is_won);
      await api(owner,'/contacts/'+c.id,'PATCH',{stage:won.name});await api(owner,'/contacts/'+c.id,'PATCH',{stage:won.name,note:'No second sale'});
      const r=await api(owner,'/statistics?days=7');assert.equal(r.status,200);
      assert.equal(r.data.metrics.incoming,3);assert.equal(r.data.metrics.outgoing,1);assert.equal(r.data.metrics.delivered,1);assert.equal(r.data.metrics.failed,1);assert.equal(r.data.metrics.averageResponseMs,90000);assert.equal(r.data.metrics.answeredTurns,1);assert.equal(r.data.metrics.registeredSales,1);
      assert.equal(r.data.daily.length,7);assert.equal(r.data.daily.reduce((n,d)=>n+d.incoming,0),3);assert.equal(r.data.team[0].won,1);
      assert.equal((await api(owner,'/statistics?days=3')).status,400);
      await change(company);
    });
    await t.test('per-company media quota is enforced before storing or transmitting bytes',async()=>{
      const smallConfig={...config,mediaCompanyLimit:1,mediaTotalLimit:1},limited=createServer(smallConfig,{store,fetchImpl:fakeFetch});
      const before=uploads;
      assert.throws(()=>limited.lazo.wa.media.saveUpload(company,{bytes:png,mime:'image/png',filename:'quota.png'}),/espacio/);
      assert.equal(uploads,before);await limited.lazo.wa.media.stop();
    });
    assert.equal(store.get('PRAGMA integrity_check').integrity_check,'ok');
  } finally {await new Promise(resolve=>server.close(resolve));await wa.media.stop();store.close();rmSync(dir,{recursive:true,force:true});}
});
