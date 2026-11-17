import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

// Exercise the real browser send callback with a deferred API and a replaced
// composer. The regression occurs between UI renders, not inside the API.
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('async(data,form)=>{',source.indexOf("bind($('send-form')"));
const finish=source.indexOf('\n  });\n}',start)+4;
assert.ok(start>=0&&finish>start,'Browser send callback must be available for the regression');
const callback=source.slice(start,finish),syncStart=source.indexOf('function syncComposer(){');
const sync=source.slice(syncStart,source.indexOf('\n',syncStart));
function fixture() {
  let resolveSend;
  const pending=new Promise(resolve=>{resolveSend=resolve;});
  const submit={disabled:false,textContent:'Enviar'},form={inert:false,querySelector:()=>submit};
  const nodes={message:{value:'Original draft'},'attachment-file':{value:''},'selected-file':{},'send-form':form};
  const drafts=new Map([['A','Original draft']]),fileDrafts=new Map(),sendKeys=new Map(),sendsInFlight=new Map();
  const context=vm.createContext({crypto:{randomUUID},current:()=>true,sceneCurrent:()=>true,c:{id:'A'},sendingKey:'1:A',
    drafts,fileDrafts,sendKeys,sendsInFlight,templates:[],messages:[],$:id=>nodes[id],notice(){},showFile(){},statusNames:{accepted:'Accepted'},renderMessages(){},
    api:async(path,options={})=>options.method==='POST'?pending:{messages:[]}});
  vm.runInContext(sync,context);
  return {handle:vm.runInContext('('+callback+')',context),resolveSend,submit,form,nodes,drafts,fileDrafts,sendKeys,sendsInFlight,synchronize:()=>vm.runInContext('syncComposer()',context)};
}
for(const replaceAttempt of [false,true])test('late completion preserves a newer draft'+(replaceAttempt?' and its newer send key':''),async()=>{
  const f=fixture(),request=f.handle({type:'text',text:'Original draft'},f.form);
  f.synchronize();assert.equal(f.form.inert,true);assert.equal(f.submit.disabled,true);
  // A -> B -> A has mounted a new composer while the first request is pending.
  f.nodes.message={value:'New draft after navigation'};f.drafts.set('A','New draft after navigation');
  if(replaceAttempt)f.sendKeys.set('A',{key:'Later request',id:'later-id'});
  f.resolveSend({status:'accepted'});await request;
  assert.equal(f.nodes.message.value,'New draft after navigation');assert.equal(f.drafts.get('A'),'New draft after navigation');
  if(replaceAttempt)assert.equal(f.sendKeys.get('A').id,'later-id');
  assert.equal(f.sendsInFlight.size,0);assert.equal(f.form.inert,false);
});
test('a late accepted result does not clear a file selected for a later draft',async()=>{
  const f=fixture(),request=f.handle({type:'text',text:'Original draft'},f.form);
  f.fileDrafts.set('A',{key:'new-file',file:{name:'later.pdf'}});
  f.resolveSend({status:'accepted'});await request;
  assert.equal(f.fileDrafts.get('A').key,'new-file');assert.equal(f.nodes.message.value,'Original draft');
});
test('completion during a loading render clears only the sent maps and does not throw',async()=>{
  const f=fixture(),request=f.handle({type:'text',text:'Original draft'},f.form);
  delete f.nodes.message;delete f.nodes['attachment-file'];delete f.nodes['send-form'];
  f.resolveSend({status:'accepted'});await assert.doesNotReject(request);
  assert.equal(f.drafts.has('A'),false);assert.equal(f.sendKeys.has('A'),false);
});
