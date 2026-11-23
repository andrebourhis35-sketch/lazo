import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHmac} from 'node:crypto';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from '../src/server.js';
import {buttonWelcomeFlow,chainedWelcomeFlow,createNode,simulateFlow} from '../src/flow-model.js';

function welcome(owner){
  const nodes=['trigger','message','tag','assign','end'].map((kind,i)=>createNode(kind,'n'+i,{x:i*300,y:100}));
  nodes[0].data.value='hola';nodes[1].data.value='Hola {{nombre}}, bienvenida a LAZO.';nodes[2].data.value='Interesado';nodes[3].data.value=owner;
  return {version:1,name:'Bienvenida',nodes,edges:nodes.slice(0,-1).map((n,i)=>({id:'e'+i,source:n.id,target:nodes[i+1].id,sourceHandle:'next'}))};
}
async function fixture(database=':memory:'){
  let calls=0,mode='ok',hold=null;
  const sent=[];
  const config={database,origin:'http://127.0.0.1:3031',masterKey:randomBytes(32).toString('base64'),secureCookies:false};
  const server=createServer(config,{fetchImpl:async(_,request)=>{sent.push(JSON.parse(request.body));calls++;if(hold)await hold;if(mode==='unknown')throw new Error('private upstream error');return Response.json({messages:[{id:'wamid.out.'+calls}]});}});
  const store=server.lazo.store,wa=server.lazo.wa,flows=server.lazo.flows;
  const company=randomUUID(),user=randomUUID(),other=randomUUID();
  store.run('INSERT INTO companies VALUES(?,?,?)',company,'Empresa A',Date.now());store.run('INSERT INTO companies VALUES(?,?,?)',other,'Empresa B',Date.now());
  store.run('INSERT INTO users VALUES(?,?,?,?,?)',user,'owner@example.test','Lucía','unused',Date.now());
  store.run('INSERT INTO memberships VALUES(?,?,?)',company,user,'owner');
  wa.saveRaw(company,{phoneId:'10001',wabaId:'20001',accessToken:'synthetic',appSecret:'synthetic-secret',testRecipient:'51900000001',graphVersion:'v25.0'},1);
  const session=store.session(user,company),graph=welcome(user);let seq=0;
  function receive(body='Hola',age=0,fields={}){const event={object:'whatsapp_business_account',entry:[{id:'20001',changes:[{field:'messages',value:{metadata:{phone_number_id:'10001'},contacts:[{wa_id:'51900000001',profile:{name:'Lucía'}}],messages:[{id:'wamid.in.'+(++seq),from:'51900000001',timestamp:String(Math.floor((Date.now()-age)/1000)),type:'text',text:{body},...fields}]}}]}]};const raw=Buffer.from(JSON.stringify(event));const signature='sha256='+createHmac('sha256','synthetic-secret').update(raw).digest('hex');wa.receive(raw,signature);return {raw,signature};}
  server.listen(0,'127.0.0.1');await once(server,'listening');
  async function api(path,method='GET',data,extra={}){const res=await fetch(`http://127.0.0.1:${server.address().port}/api/crm${path}`,{method,headers:{Origin:config.origin,'Content-Type':'application/json','X-Lazo-Client':'1',Cookie:'lazo_dev_session='+session.secret,'X-CSRF-Token':session.csrf,'X-Lazo-Company':company,'X-Lazo-User':user,...extra},body:data?JSON.stringify(data):undefined});return {status:res.status,body:await res.json()};}
  return {config,store,wa,flows,company,user,other,graph,receive,api,sent,get calls(){return calls;},setMode:v=>mode=v,hold:p=>hold=p,async close(){await flows.stop();await wa.media.stop();await server.lazo.mail.stop();await new Promise(r=>server.close(r));store.close();}};
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
    assert.throws(()=>f.flows.pause(f.other,id,f.user),/Flujo no encontrado/);
    assert.equal((await f.api('/flows/'+id+'/pause','POST',{})).body.active,false);
    f.store.run("UPDATE memberships SET role='agent' WHERE company_id=?",f.company);
    assert.equal((await f.api('/flows')).status,403);
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
test('real activation refuses unsupported waits, foreign assignments and missing test restrictions',async()=>{
  const f=await fixture();try{const graph=structuredClone(f.graph);graph.nodes[2].data={kind:'wait',label:'Espera',value:'30'};let flow=f.flows.save(f.company,null,{graph},f.user);assert.throws(()=>f.flows.publish(f.company,flow.id,{revision:1},f.user),/simulación/);
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
