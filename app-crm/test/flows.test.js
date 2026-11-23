import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHmac} from 'node:crypto';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from '../src/server.js';
import {buttonWelcomeFlow,chainedWelcomeFlow,createNode,digitalSaleFlow,simulateFlow,validateFlow} from '../src/flow-model.js';

function welcome(owner){
  const nodes=['trigger','message','tag','assign','end'].map((kind,i)=>createNode(kind,'n'+i,{x:i*300,y:100}));
  nodes[0].data.value='hola';nodes[1].data.value='Hola {{nombre}}, bienvenida a LAZO.';nodes[2].data.value='Interesado';nodes[3].data.value=owner;
  return {version:1,name:'Bienvenida',nodes,edges:nodes.slice(0,-1).map((n,i)=>({id:'e'+i,source:n.id,target:nodes[i+1].id,sourceHandle:'next'}))};
}

test('catalog offers are scoped, preserve the order price and deliver only after manual confirmation',async()=>{
  const f=await fixture();
  try{
    const offer={product:'ebook-prueba',name:'Ebook de prueba',plan:'Premium',market:'Perú',
      price:'20.00',currency:'PEN',bonuses:'Incluye dos bonos',instructions:'Paga por el canal de prueba.',
      link:'https://example.test/entrega',mode:'prepaid'};
    const created=await f.api('/sales-catalog','POST',offer);
    assert.equal(created.status,201);
    const id=created.body.offers[0].id;
    assert.equal((await f.api('/sales-catalog','POST',offer)).status,409);
    assert.equal((await f.api('/sales-catalog','POST',{...offer,market:'Ecuador',currency:'USD'})).status,201);
    f.receive('Información');
    const contact=f.store.get('SELECT id FROM contacts').id;
    const path='/contacts/'+contact+'/orders';
    const send={action:'offer',offerId:id,requestId:randomUUID()};
    assert.equal((await f.api(path,'POST',send)).status,200);
    assert.equal((await f.api(path,'POST',send)).status,200);
    assert.equal(f.sent.length,1);
    assert.match(f.sent[0].text.body,/dos bonos/);
    assert.doesNotMatch(f.sent[0].text.body,/example.test/);
    const order=(await f.api(path)).body.orders[0];
    assert.equal((await f.api('/sales-catalog/'+id,'PUT',{...offer,price:'25.00'})).status,200);
    assert.equal((await f.api(path,'POST',{action:'deliver',orderId:order.id})).status,409);
    assert.equal((await f.api(path,'POST',{orderId:order.id,amount:'25.00',reference:'TEST-123'})).status,400);
    assert.equal((await f.api('/sales-dashboard?queue=collect')).body.queues.collect,1);
    const proof=randomUUID(),stamp=Date.now();
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
    const mediaId=f.wa.media.saveUpload(f.company,{bytes:png,mime:'image/png',filename:'prueba.png'});
    f.store.run(`INSERT INTO messages(id,company_id,contact_id,direction,body,type,status,created,updated,attachment_id)
      VALUES(?,?,?,'in','Comprobante','image','received',?,?,?)`,proof,f.company,contact,stamp,stamp,mediaId);
    assert.equal(f.flows.sales.enqueue({id:proof,company_id:f.company,contact_id:contact,attachmentId:mediaId,type:'image',created:stamp}),true);
    assert.equal((await f.api('/sales-dashboard?queue=review')).body.recent[0].id,order.id);
    assert.equal((await f.api(path,'POST',{action:'read-proof',orderId:order.id})).status,409);
    assert.equal((await f.api('/flow-ai','POST',{enabled:true,apiKey:'sk-receipt-synthetic-only'})).status,200);
    f.aiOutcomes.push({amount:'21.00',currency:'PEN',reference:'TEST-123'});
    const read=await f.api(path,'POST',{action:'read-proof',orderId:order.id});
    assert.equal(read.body.receipt.amount,'21.00');
    assert.equal(f.aiInputs[0].store,false);
    const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
    const pdfId=f.wa.media.saveUpload(f.company,{bytes:pdf,mime:'application/pdf',filename:'prueba.pdf'});
    f.store.run("UPDATE messages SET type='document', attachment_id=? WHERE id=?",pdfId,proof);
    f.aiOutcomes.push({amount:'20.00',currency:'PEN',reference:'TEST-123'});
    assert.equal((await f.api(path,'POST',{action:'read-proof',orderId:order.id})).body.receipt.amount,'20.00');
    assert.equal(f.aiInputs[1].input[0].content[0].type,'input_file');
    assert.equal(f.aiInputs[1].input[0].content[0].file_data,'data:application/pdf;base64,'+pdf.toString('base64'));
    assert.equal((await f.api(path)).body.orders[0].confirmed_at,null);
    assert.equal((await f.api(path,'POST',{orderId:order.id,amount:'20.00',reference:'TEST-123'})).body.manual,true);
    assert.equal((await f.api('/sales-dashboard?queue=deliver')).body.recent[0].id,order.id);
    assert.equal((await f.api(path,'POST',{action:'deliver',orderId:order.id})).status,200);
    assert.equal((await f.api(path,'POST',{action:'deliver',orderId:order.id})).status,200);
    assert.equal(f.sent.length,2);
    assert.match(f.sent[1].text.body,/example\.test\/entrega/);
    assert.equal((await f.api('/sales-catalog/'+id,'DELETE',{})).status,200);
    assert.equal((await f.api(path)).body.orders[0].cents,2000);
    f.store.run("UPDATE memberships SET role='agent' WHERE company_id=?",f.company);
    assert.equal((await f.api('/sales-catalog')).status,403);
    assert.equal((await f.api(path,'POST',send)).status,403);
  }finally{await f.close();}
});
async function fixture(database=':memory:'){
  let calls=0,mode='ok',hold=null;
  const sent=[],sendPaths=[],aiInputs=[],aiOutcomes=[];
  const config={database,origin:'http://127.0.0.1:3031',masterKey:randomBytes(32).toString('base64'),secureCookies:false};
  const server=createServer(config,{fetchImpl:async(url,request)=>{
    if(url.endsWith('/10001?fields=id,display_phone_number'))return Response.json({id:'10001',display_phone_number:'+1 555 0100'});
    if(url==='https://api.openai.com/v1/responses') {
      aiInputs.push(JSON.parse(request.body));
      const next=aiOutcomes.shift();
      if(!next)return new Response(null,{status:503});
      return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(next)}]}]});
    }
    sendPaths.push(new URL(url).pathname);sent.push(JSON.parse(request.body));calls++;if(hold)await hold;if(mode==='unknown')throw new Error('private upstream error');return Response.json({messages:[{id:'wamid.out.'+calls}]});}});
  const store=server.lazo.store,wa=server.lazo.wa,flows=server.lazo.flows;
  const company=randomUUID(),user=randomUUID(),other=randomUUID();
  store.run('INSERT INTO companies VALUES(?,?,?)',company,'Empresa A',Date.now());store.run('INSERT INTO companies VALUES(?,?,?)',other,'Empresa B',Date.now());
  store.run('INSERT INTO users VALUES(?,?,?,?,?)',user,'owner@example.test','Lucía','unused',Date.now());
  store.run('INSERT INTO memberships VALUES(?,?,?)',company,user,'owner');
  wa.saveRaw(company,{phoneId:'10001',wabaId:'20001',accessToken:'synthetic',appSecret:'synthetic-secret',testRecipient:'51900000001',graphVersion:'v25.0'},1);
  const session=store.session(user,company),graph=welcome(user);let seq=0;
  function receive(body='Hola',age=0,fields={},phoneId='10001'){const event={object:'whatsapp_business_account',entry:[{id:'20001',changes:[{field:'messages',value:{metadata:{phone_number_id:phoneId},contacts:[{wa_id:'51900000001',profile:{name:'Lucía'}}],messages:[{id:'wamid.in.'+(++seq),from:'51900000001',timestamp:String(Math.floor((Date.now()-age)/1000)),type:'text',text:{body},...fields}]}}]}]};const raw=Buffer.from(JSON.stringify(event));const signature='sha256='+createHmac('sha256','synthetic-secret').update(raw).digest('hex');wa.receive(raw,signature);return {raw,signature};}
  server.listen(0,'127.0.0.1');await once(server,'listening');
  async function api(path,method='GET',data,extra={}){const res=await fetch(`http://127.0.0.1:${server.address().port}/api/crm${path}`,{method,headers:{Origin:config.origin,'Content-Type':'application/json','X-Lazo-Client':'1',Cookie:'lazo_dev_session='+session.secret,'X-CSRF-Token':session.csrf,'X-Lazo-Company':company,'X-Lazo-User':user,...extra},body:data?JSON.stringify(data):undefined});return {status:res.status,body:await res.json()};}
  return {config,store,wa,flows,company,user,other,graph,receive,api,sent,sendPaths,aiInputs,aiOutcomes,get calls(){return calls;},setMode:v=>mode=v,hold:p=>hold=p,async close(){await flows.stop();await wa.media.stop();await server.lazo.mail.stop();await new Promise(r=>server.close(r));store.close();}};
}

test('flows API: tenant, roles, CSRF, draft CAS, published snapshot and pause',async()=>{
  const f=await fixture();try{
    assert.equal((await f.api('/flows','POST',{graph:f.graph},{'X-CSRF-Token':'bad'})).status,403);
    const created=await f.api('/flows','POST',{graph:f.graph});assert.equal(created.status,201);const id=created.body.id;
    assert.equal((await f.api('/flows/'+id+'/activate','POST',{revision:1})).status,200);
    const changed=structuredClone(f.graph);changed.nodes[1].data.value='Borrador nuevo';
    assert.equal((await f.api('/flows/'+id,'PUT',{graph:changed,revision:1})).status,200);
    assert.equal((await f.api('/flows/'+id,'PUT',{graph:changed,revision:1})).status,409);
    assert.equal(JSON.parse(f.store.get('SELECT published FROM flows WHERE id=?',id).published).nodes[1].data.value,f.graph.nodes[1].data.value);
    assert.deepEqual((await f.api('/flow-workspaces')).body.workspaces.map(row=>row.id),[f.company]);
    assert.deepEqual((await f.api('/flow-number')).body,{number:'+1 555 0100',canActivate:true});
    assert.throws(()=>f.flows.pause(f.other,id,f.user),/Flujo no encontrado/);
    assert.equal((await f.api('/flows/'+id+'/pause','POST',{})).body.active,false);
    f.store.run("UPDATE memberships SET role='agent' WHERE company_id=?",f.company);
    assert.equal((await f.api('/flows')).status,403);
    assert.equal((await f.api('/flow-workspaces')).status,403);
    assert.equal((await f.api('/flow-number')).status,403);
  }finally{await f.close();}
});
test('signed input atomically queues once and executes welcome, tag and assignment',async()=>{
  const f=await fixture();try{const flow=f.flows.save(f.company,null,{graph:f.graph},f.user);f.flows.publish(f.company,flow.id,{revision:1},f.user);
    const event=f.receive();f.wa.receive(event.raw,event.signature);assert.equal(f.store.get('SELECT count(*) n FROM flow_runs').n,1);
    await Promise.all([f.flows.flush(),f.flows.flush()]);assert.equal(f.calls,1);assert.equal(f.flows.runs(f.company,flow.id)[0].state,'done');
    const contact=f.store.get('SELECT * FROM contacts');assert.equal(contact.owner_id,f.user);assert.deepEqual(JSON.parse(contact.tags),['Interesado']);assert.match(f.store.get("SELECT body FROM messages WHERE direction='out'").body,/Hola Lucía/);
  }finally{await f.close();}
});
test('pause/reactivate cancels stale batches and in-flight subsequent actions',async()=>{
  const f=await fixture();try{const flow=f.flows.save(f.company,null,{graph:f.graph},f.user);f.flows.publish(f.company,flow.id,{revision:1},f.user);f.receive();
    let release;f.hold(new Promise(r=>release=r));const pending=f.flows.flush();
    f.flows.pause(f.company,flow.id,f.user);f.flows.publish(f.company,flow.id,{revision:1},f.user);release();await pending;
    assert.equal(f.calls,1);assert.equal(f.flows.runs(f.company,flow.id)[0].state,'cancelled');assert.deepEqual(JSON.parse(f.store.get('SELECT tags FROM contacts').tags),[]);
  }finally{await f.close();}
});
test('opt-out cancels a queued welcome; unrelated and stale input do not trigger',async()=>{
  const f=await fixture();try{const flow=f.flows.save(f.company,null,{graph:f.graph},f.user);f.flows.publish(f.company,flow.id,{revision:1},f.user);f.receive('Hola',10*60000);f.receive('Buenos días');assert.equal(f.store.get('SELECT count(*) n FROM flow_runs').n,0);f.receive('Hola');f.receive('baja');await f.flows.flush();assert.equal(f.calls,0);assert.equal(f.flows.runs(f.company,flow.id)[0].state,'cancelled');
  }finally{await f.close();}
});
test('ambiguous send and interrupted worker are not retried automatically',async()=>{
  const f=await fixture();try{const flow=f.flows.save(f.company,null,{graph:f.graph},f.user);f.flows.publish(f.company,flow.id,{revision:1},f.user);f.setMode('unknown');f.receive();await f.flows.flush();await f.flows.flush();assert.equal(f.calls,1);assert.equal(f.store.get("SELECT status FROM messages WHERE direction='out'").status,'unknown');assert.equal(f.flows.runs(f.company,flow.id)[0].state,'failed');f.store.run("UPDATE flow_runs SET state='running'");f.flows.recover();await f.flows.flush();assert.equal(f.calls,1);assert.equal(f.flows.runs(f.company,flow.id)[0].state,'interrupted');
  }finally{await f.close();}
});
test('real activation refuses waits beyond the live limit, foreign assignments and missing test restrictions',async()=>{
  const f=await fixture();try{const graph=structuredClone(f.graph);graph.nodes[2].data={kind:'wait',label:'Espera',value:'1381'};let flow=f.flows.save(f.company,null,{graph},f.user);assert.throws(()=>f.flows.publish(f.company,flow.id,{revision:1},f.user),/1380/);
    graph.nodes[2]=f.graph.nodes[2];graph.nodes[3].data.value=randomUUID();flow=f.flows.save(f.company,null,{graph},f.user);assert.throws(()=>f.flows.publish(f.company,flow.id,{revision:1},f.user),/asesor/);
    flow=f.flows.save(f.company,null,{graph:f.graph},f.user);f.wa.saveRaw(f.company,{phoneId:'10001',wabaId:'20001',appSecret:'secret',accessToken:'synthetic',graphVersion:'v25.0'},1);assert.throws(()=>f.flows.publish(f.company,flow.id,{revision:1},f.user),/prueba/);
  }finally{await f.close();}
});
test('tag capacity is checked before sending the welcome',async()=>{
  const f=await fixture();try{const flow=f.flows.save(f.company,null,{graph:f.graph},f.user);f.flows.publish(f.company,flow.id,{revision:1},f.user);f.receive();const contact=f.store.get('SELECT id FROM contacts');f.store.updateContact(f.company,contact.id,{tags:['A','Á','B','C','D','E','F','G']},f.user);await f.flows.flush();assert.equal(f.calls,0);assert.equal(f.flows.runs(f.company,flow.id)[0].state,'failed');}finally{await f.close();}
});
test('a cancelled row already in a worker batch cannot be reclaimed after reactivation',async()=>{
  const f=await fixture();try{const flow=f.flows.save(f.company,null,{graph:f.graph},f.user);f.flows.publish(f.company,flow.id,{revision:1},f.user);f.receive();f.store.run('UPDATE flow_runs SET created=?',Date.now()-61000);f.receive();assert.equal(f.store.get('SELECT count(*) n FROM flow_runs').n,2);let release;f.hold(new Promise(r=>release=r));const pending=f.flows.flush();f.flows.pause(f.company,flow.id,f.user);f.flows.publish(f.company,flow.id,{revision:1},f.user);release();await pending;assert.equal(f.calls,1);assert.ok(f.flows.runs(f.company,flow.id).every(r=>r.state==='cancelled'));}finally{await f.close();}
});
test('draft, active version and pending input survive reopening the database',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'lazo-flows-'));let second;
  const f=await fixture(join(dir,'test.sqlite'));
  try{const flow=f.flows.save(f.company,null,{graph:f.graph},f.user);f.flows.publish(f.company,flow.id,{revision:1},f.user);f.receive();await f.close();let sends=0;second=createServer(f.config,{fetchImpl:async()=>{sends++;return Response.json({messages:[{id:'wamid.reopened'}]});}});second.lazo.flows.recover();assert.equal(second.lazo.flows.list(f.company)[0].active,true);await second.lazo.flows.flush();assert.equal(sends,1);assert.equal(second.lazo.flows.runs(f.company,flow.id)[0].state,'done');}
  finally{if(second){await second.lazo.flows.stop();await second.lazo.wa.media.stop();await second.lazo.mail.stop();second.lazo.store.close();}rmSync(dir,{recursive:true,force:true});}
});


test('welcome buttons resume only the selected branch for the original menu', async () => {
  for (const [count, index] of [[2,0],[2,1],[3,2]]) {
    const f=await fixture();
    try {
      const graph=buttonWelcomeFlow();
      if(count===2) {
        graph.nodes[1].data.choices.pop();
        graph.nodes=graph.nodes.filter(node=>node.id!=='pedido');
        graph.edges=graph.edges.filter(edge=>edge.source!=='pedido'&&edge.target!=='pedido');
      }
      const flow=f.flows.save(f.company,null,{graph},f.user);
      f.flows.publish(f.company,flow.id,{revision:1},f.user);
      f.receive();
      await f.flows.flush();
      assert.equal(f.flows.runs(f.company,flow.id)[0].state,'waiting');
      const menu=f.sent[0].interactive;
      assert.equal(menu.type,'button');
      assert.equal(menu.action.buttons.length,count);
      assert.match(menu.body.text,/Hola Lucía/);
      const reply=menu.action.buttons[index].reply;
      const fields={type:'interactive',interactive:{type:'button_reply',button_reply:reply}};
      f.receive('',0,{...fields,context:{id:'different-menu'}});
      await f.flows.flush();
      assert.equal(f.calls,1);
      const event=f.receive('',0,{...fields,context:{id:'wamid.out.1'}});
      f.wa.receive(event.raw,event.signature);
      f.receive('',0,{...fields,context:{id:'wamid.out.1'}});
      await f.flows.flush();
      assert.equal(f.calls,2);
      assert.equal(f.sent[1].text.body,graph.nodes[2+index].data.value);
      assert.equal(f.flows.runs(f.company,flow.id)[0].state,'done');
      const simulation=simulateFlow(graph,{answer:reply.title});
      assert.deepEqual(simulation.errors,[]);
      assert.equal(simulation.steps[2].detail,f.sent[1].text.body);
    } finally { await f.close(); }
  }
});


test('chained menus can return and reject a tap from an older menu', async () => {
  const f=await fixture();
  try {
    const graph=chainedWelcomeFlow();
    const flow=f.flows.save(f.company,null,{graph},f.user);
    f.flows.publish(f.company,flow.id,{revision:1},f.user);
    const tap=(sendIndex,buttonIndex)=>f.receive('',0,{type:'interactive',
      context:{id:'wamid.out.'+(sendIndex+1)},
      interactive:{type:'button_reply',button_reply:f.sent[sendIndex].interactive.action.buttons[buttonIndex].reply}});
    f.receive();
    await f.flows.flush();
    tap(0,0);
    await f.flows.flush();
    tap(1,2);
    await f.flows.flush();
    assert.equal(f.calls,3);
    assert.equal(f.sent[2].interactive.body.text,f.sent[0].interactive.body.text);
    tap(0,1);
    await f.flows.flush();
    assert.equal(f.calls,3);
    tap(2,1);
    await f.flows.flush();
    assert.match(f.sent[3].text.body,/horarios|día/);
    assert.deepEqual(simulateFlow(graph,{answer:'Ver catálogo\nVolver\nConsultar horarios'}).errors,[]);
    const contact=f.store.get('SELECT id FROM contacts');
    const history=await f.api('/contacts/'+contact.id+'/automation');
    assert.equal(history.status,200);
    assert.ok(history.body.runs[0].steps.some(step=>step.detail==='Volvió al menú anterior'));
    assert.ok(history.body.runs[0].steps.some(step=>step.body===f.sent[3].text.body));
  } finally{await f.close();}
});

function linearGraph(kinds) {
  const nodes=kinds.map((kind,index)=>createNode(kind,'step-'+index,{x:index*300,y:100}));
  return {version:1,name:'Prueba',nodes,edges:nodes.slice(0,-1).map((node,index)=>({id:'edge-'+index,source:node.id,target:nodes[index+1].id,sourceHandle:'next'}))};
}

test('follow-up sends only at its deadline and cancels on reply, sale or takeover', async () => {
  for(const outcome of ['send','reply','sale','takeover','assignment']) {
    const f=await fixture();
    try {
      const graph=linearGraph(['trigger','reminder','message','end']);
      const flow=f.flows.save(f.company,null,{graph},f.user);
      f.flows.publish(f.company,flow.id,{revision:1},f.user);
      f.receive();
      await f.flows.flush();
      assert.equal(f.flows.runs(f.company,flow.id)[0].state,'scheduled');
      await f.flows.flush();
      assert.equal(f.calls,0);
      const contact=f.store.get('SELECT id FROM contacts');
      if(outcome==='reply')f.receive('Gracias');
      if(outcome==='sale')f.store.updateContact(f.company,contact.id,{stage:'Venta ganada'},f.user);
      if(outcome==='takeover')assert.equal((await f.api('/contacts/'+contact.id+'/automation','POST',{paused:true})).status,200);
      if(outcome==='assignment')f.store.updateContact(f.company,contact.id,{ownerId:''},f.user);
      f.store.run('UPDATE flow_runs SET due=?',Date.now()-1);
      await f.flows.flush();
      assert.equal(f.calls,outcome==='send'?1:0);
      assert.equal(f.flows.runs(f.company,flow.id)[0].state,outcome==='send'?'done':'cancelled');
    } finally{await f.close();}
  }
});

test('handoff assigns the chat and suppresses automation until the team resumes it', async () => {
  const f=await fixture();
  try {
    const graph=linearGraph(['trigger','message','handoff']);
    graph.nodes[2].data.value=f.user;
    const flow=f.flows.save(f.company,null,{graph},f.user);
    f.flows.publish(f.company,flow.id,{revision:1},f.user);
    f.receive();
    await f.flows.flush();
    const contact=f.store.get('SELECT id,owner_id,automation_paused FROM contacts');
    assert.equal(contact.owner_id,f.user);
    assert.equal(contact.automation_paused,1);
    f.store.run('UPDATE flow_runs SET created=?',Date.now()-61000);
    f.receive();
    await f.flows.flush();
    assert.equal(f.calls,1);
    assert.equal((await f.api('/contacts/'+contact.id+'/automation','POST',{paused:false})).status,200);
    f.receive();
    await f.flows.flush();
    assert.equal(f.calls,2);
  } finally{await f.close();}
});

test('global inbox lists only numbers and conversations accessible to the session user', async () => {
  const f=await fixture();
  try {
    f.receive();
    f.wa.saveRaw(f.other,{phoneId:'10002',wabaId:'20002',accessToken:'synthetic',appSecret:'synthetic-secret',testRecipient:'51900000001',graphVersion:'v25.0'},1);
    const contact=f.store.addContact(f.other,{name:'Contacto B',phone:'51900000002'},null);
    const stamp=Date.now();
    f.store.run("INSERT INTO messages(id,company_id,contact_id,direction,body,type,status,created,updated) VALUES(?,?,?,'in','Segundo número','text','received',?,?)",randomUUID(),f.other,contact.id,stamp,stamp);
    assert.equal((await f.api('/inbox-overview')).body.conversations.length,1);
    assert.equal((await f.api('/inbox-overview?company='+f.other)).status,403);
    f.store.run('INSERT INTO memberships VALUES(?,?,?)',f.other,f.user,'agent');
    assert.equal((await f.api('/inbox-overview')).body.conversations.length,2);
    const filtered=await f.api('/inbox-overview?company='+f.other);
    assert.deepEqual(filtered.body.conversations.map(c=>c.id),[contact.id]);
    assert.equal((await f.api('/contacts/'+contact.id+'/automation')).status,404);
  } finally{await f.close();}
});


test('fixed wait keeps its deadline after a reply and sends just once', async () => {
  const f=await fixture();
  try {
    const graph=linearGraph(['trigger','message','wait','message','end']);
    graph.nodes[2].data.value='20';
    graph.nodes[3].data.value='Te comparto la segunda parte.';
    const flow=f.flows.save(f.company,null,{graph},f.user);
    f.flows.publish(f.company,flow.id,{revision:1},f.user);
    f.receive();
    await f.flows.flush();
    let run=f.store.get('SELECT state,due,updated FROM flow_runs');
    assert.equal(run.state,'delayed');
    assert.ok(Math.abs(run.due-run.updated-20*60000)<1000);
    f.receive('Gracias por el mensaje');
    await f.flows.flush();
    assert.equal(f.calls,1);
    assert.equal(f.store.get('SELECT due FROM flow_runs').due,run.due);
    f.store.run('UPDATE flow_runs SET due=?',Date.now()-1);
    await f.flows.flush();
    await f.flows.flush();
    assert.equal(f.calls,2);
    assert.equal(f.sent[1].text.body,graph.nodes[3].data.value);
  } finally {await f.close();}
});

test('agent asks once, resumes from a reply and hands off if the provider fails', async () => {
  for(const succeeds of [true,false]) {
    const f=await fixture();
    try {
      const graph=linearGraph(['trigger','ai','end','handoff']);
      graph.nodes[1].data.value='La tienda abre a las 10.';
      graph.nodes[3].data.value=f.user;
      graph.edges[1].sourceHandle='answered';
      graph.edges[2]={id:'advisor',source:'step-1',target:'step-3',sourceHandle:'handoff'};
      const flow=f.flows.save(f.company,null,{graph},f.user);
      assert.throws(()=>f.flows.publish(f.company,flow.id,{revision:1},f.user),/Habilita Agente IA/);
      const apiKey='sk-synthetic-test-key-123456789';
      assert.deepEqual((await f.api('/flow-ai','POST',{apiKey,enabled:true})).body,{configured:true,enabled:true});
      assert.ok(!f.store.get('SELECT secret FROM flow_ai_settings').secret.includes(apiKey));
      assert.deepEqual((await f.api('/flow-ai')).body,{configured:true,enabled:true});
      f.flows.publish(f.company,flow.id,{revision:1},f.user);
      f.aiOutcomes.push({decision:'clarify',text:'¿Qué horario quieres consultar?'});
      f.receive('Hola, tengo una consulta');
      await f.flows.flush();
      assert.equal(f.flows.runs(f.company,flow.id)[0].state,'agent_wait');
      assert.equal(f.sent[0].text.body,'¿Qué horario quieres consultar?');
      if(succeeds)f.aiOutcomes.push({decision:'answer',text:'Abrimos a las 10.'});
      f.receive('A qué hora abren');
      await f.flows.flush();
      assert.equal(f.aiInputs.length,2);
      assert.equal(f.aiInputs[1].store,false);
      assert.deepEqual(JSON.parse(f.aiInputs[1].input[0].content),{
        knowledge:graph.nodes[1].data.value,message:'A qué hora abren',previousQuestion:'¿Qué horario quieres consultar?',
      });
      assert.equal(f.flows.runs(f.company,flow.id)[0].state,'done');
      assert.equal(f.store.get('SELECT automation_paused FROM contacts').automation_paused,succeeds?0:1);
      assert.equal(f.calls,succeeds?2:1);
      if(succeeds)assert.equal(f.sent[1].text.body,'Abrimos a las 10.');
    } finally {await f.close();}
  }
});


test('digital sale matches proof to the chosen plan and delivers at the right step', async () => {
  for(const mode of ['prepaid','postpaid']) {
    const f=await fixture();
    try {
      const graph=digitalSaleFlow(mode);
      graph.nodes.find(node=>node.id==='charge').data.value='Paga a la cuenta de la tienda.';
      graph.nodes.find(node=>node.id==='confirm').data.value='30';
      graph.nodes.find(node=>node.id==='basico').data.sale.link='https://example.test/basico';
      graph.nodes.find(node=>node.id==='premium').data.sale.link='https://example.test/premium';
      for(const node of graph.nodes.filter(node=>node.data.kind==='plan'))node.data.sale.product='ebook-demo';
      assert.deepEqual(validateFlow(graph),[]);
      const sim=simulateFlow(graph,{incoming:'quiero el ebook',answer:'Premium',paymentConfirmed:false});
      assert.equal(sim.paymentPending,true);
      assert.equal(sim.steps.some(step=>step.kind==='deliver'),mode==='postpaid');
      const flow=f.flows.save(f.company,null,{graph},f.user);
      f.flows.publish(f.company,flow.id,{revision:1},f.user);
      f.receive('quiero el ebook');
      await f.flows.flush();
      f.receive('',0,{type:'interactive',context:{id:'wamid.out.1'},interactive:{type:'button_reply',button_reply:f.sent[0].interactive.action.buttons[1].reply}});
      await f.flows.flush();
      const contact=f.store.get('SELECT id FROM contacts');
      const path='/contacts/'+contact.id+'/orders';
      let [order]=(await f.api(path)).body.orders;
      assert.equal(order.cents,2000);
      assert.equal(order.plan,'Premium');
      assert.equal(Boolean(order.delivery_id),mode==='postpaid');
      assert.ok(f.sent.some(message=>message.text?.body.includes('PEN 20.00')));
      f.receive('',0,{type:'image',image:{id:'1111',mime_type:'image/png'}});
      [order]=(await f.api(path)).body.orders;
      assert.ok(order.proof_id);
      assert.equal(order.confirmed_at,null);
      assert.equal(f.store.get('SELECT due FROM flow_runs').due,null);
      const payment={orderId:order.id,reference:'ABONO-123',amount:'20.00'};
      assert.equal((await f.api(path,'POST',{...payment,amount:'10.00'})).status,400);
      f.store.run("UPDATE memberships SET role='agent' WHERE company_id=?",f.company);
      assert.equal((await f.api(path,'POST',payment)).status,403);
      f.store.run("UPDATE memberships SET role='owner' WHERE company_id=?",f.company);
      assert.equal((await f.api(path,'POST',payment)).status,200);
      await f.flows.flush();
      assert.equal((await f.api(path,'POST',payment)).status,200);
      [order]=(await f.api(path)).body.orders;
      assert.ok(order.confirmed_at);
      assert.equal(order.reference,'ABONO-123');
      assert.equal(f.sent.filter(message=>message.text?.body.includes('https://example.test/premium')).length,1);
      assert.ok(order.delivery_id);
      assert.equal(order.flow_state,'done');
      const resend={action:'resend',orderId:order.id,requestId:randomUUID()};
      assert.equal((await f.api(path,'POST',resend)).status,200);
      assert.equal((await f.api(path,'POST',resend)).status,200);
      assert.equal(f.sent.filter(message=>message.text?.body.includes('https://example.test/premium')).length,2);
    } finally {await f.close();}
  }
});


test('sales dashboard keeps currencies separate and scopes period, geography, and workspace', async () => {
  const f=await fixture();
  try {
    const buyer=(company,name,phone)=>f.store.addContact(company,{name,phone},null);
    const peru=buyer(f.company,'Perú','51900000003');
    const panama=buyer(f.company,'Panamá','50760000000');
    const sharedPrefix=buyer(f.company,'Prefijo compartido','12025550123');
    const other=buyer(f.other,'Otra empresa','593990000000');
    const stamp=Date.now();
    function order(contact,currency,cents,{paid=false,proof=false,age=0}={}) {
      f.store.run("INSERT INTO flow_orders(id,company_id,contact_id,run_id,product,plan,cents,currency,link,mode,created,charged_at,confirmed_at,proof_id) VALUES(?,?,?,?,?,?,?,?,?,'prepaid',?,?,?,?)",
        randomUUID(),contact.company_id,contact.id,randomUUID(),'ebook','Básico',cents,currency,'https://example.test/ebook',
        stamp-age,stamp-age,paid?stamp-age:null,proof?randomUUID():null);
    }
    order(peru,'PEN',2000,{paid:true});
    order(peru,'PEN',1000,{proof:true});
    order(panama,'USD',400,{paid:true});
    order(sharedPrefix,'USD',500);
    order(peru,'PEN',9999,{paid:true,age:40*86400000});
    order(other,'USD',8000,{paid:true});
    const summary=(await f.api('/sales-dashboard')).body;
    assert.deepEqual(summary.currencies.map(row=>[row.currency,row.confirmed_cents,row.pending_cents,row.review_orders]),
      [['PEN',2000,1000,1],['USD',400,500,0]]);
    assert.deepEqual(new Set(summary.markets.map(row=>row.country)),new Set(['PER','PAN','unknown']));
    assert.equal(summary.recent.length,4);
    const filtered=(await f.api('/sales-dashboard?country=PAN&currency=USD&days=7')).body;
    assert.deepEqual(filtered.recent.map(row=>row.contact),['Panamá']);
    assert.equal(filtered.currencies[0].confirmed_cents,400);
    assert.equal((await f.api('/sales-dashboard?currency=CAD')).status,400);
  } finally {await f.close();}
});


test('a flow publishes to selected numbers only and draft changes preserve live routing',async()=>{
  const f=await fixture();
  try {
    for(const phoneId of ['10002','10003'])f.wa.saveRaw(f.company,{phoneId,wabaId:'20001',accessToken:'synthetic',
      appSecret:'synthetic-secret',testRecipient:'51900000001',graphVersion:'v25.0'},1);
    const {id}=f.flows.save(f.company,null,{graph:f.graph,phoneIds:['10001','10002']},f.user);
    assert.deepEqual(f.flows.publish(f.company,id,{revision:1},f.user).activePhoneIds,['10001','10002']);
    assert.throws(()=>f.flows.save(f.company,null,{graph:f.graph,phoneIds:['99999']},f.user),/números vinculados/);
    const conflict=f.flows.save(f.company,null,{graph:f.graph,phoneIds:['10002']},f.user);
    assert.throws(()=>f.flows.publish(f.company,conflict.id,{revision:1},f.user),{status:409});
    const draft=f.flows.save(f.company,id,{graph:f.graph,revision:1,phoneIds:['10003']},f.user);
    assert.deepEqual(draft.phoneIds,['10003']);
    assert.deepEqual(draft.activePhoneIds,['10001','10002']);
    for(const line of ['10001','10002','10003'])f.receive('Hola',0,{},line);
    await f.flows.flush();
    assert.deepEqual(f.sendPaths.sort(),['/v25.0/10001/messages','/v25.0/10002/messages']);
    const chats=(await f.api('/contacts')).body.contacts;
    assert.equal(chats.length,3);
    assert.equal(new Set(chats.map(chat=>chat.id)).size,3);
    assert.deepEqual(chats.filter(chat=>chat.phone_id==='10003').map(chat=>JSON.parse(chat.tags)),[[]]);
    f.flows.publish(f.company,id,{revision:2},f.user);
    f.receive('Hola',0,{},'10003');
    await f.flows.flush();
    assert.ok(f.sendPaths.includes('/v25.0/10003/messages'));
  }finally{await f.close();}
});
