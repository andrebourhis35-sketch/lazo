import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the actual screen loader with deferred network responses: older
// renders must never replace credential fields in the current screen.
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const loader=app.slice(app.indexOf('let connectionGeneration=0;'),app.indexOf('async function settings(){'));
function deferred(){let resolve;return {promise:new Promise(r=>{resolve=r;}),resolve:value=>resolve(value)};}
test('a stale connections load cannot overwrite a later visit or refresh',async()=>{
  const first=deferred(),second=deferred();let request=0;const mounted=[];
  const node={innerHTML:''};
  const ctx=vm.createContext({workspaceEpoch:1,session:{company:{id:'a'},user:{role:'owner'}},view:'connections',
    $:()=>node,api:()=>++request===1?first.promise:second.promise,
    mountConnections:(_root,options)=>mounted.push(options),notice:()=>{}});
  vm.runInContext(loader,ctx);
  const old=vm.runInContext('connectionsView()',ctx);
  vm.runInContext("view='contacts'",ctx);
  vm.runInContext("view='connections'",ctx);
  const current=vm.runInContext('connectionsView()',ctx);
  second.resolve({phoneId:'current'});await current;
  first.resolve({phoneId:'stale'});await old;
  assert.equal(mounted.length,1);assert.equal(mounted[0].connection.phoneId,'current');
  assert.equal(mounted[0].isCurrent(),true);
  // A newer refresh also invalidates callbacks held by the previous form.
  await vm.runInContext('connectionsView()',ctx);
  assert.equal(mounted[0].isCurrent(),false);assert.equal(mounted[1].isCurrent(),true);
});

const moduleSource=readFileSync(new URL('../public/connections-ui.js',import.meta.url),'utf8').replace('export function','function');
test('a saved form from an old visit clears its secrets without remounting the new screen',async()=>{
  const pending=deferred();let current=true,remounts=0;
  const submit={},result={},form={elements:{accessToken:{value:'private-token'},appSecret:{value:'private-secret'}},querySelector:()=>submit};
  const nodes={'#wa-connect':form,'#wa-result':result};
  const root={querySelector:key=>nodes[key]};
  const ctx=vm.createContext({FormData:class{*[Symbol.iterator](){yield ['accessToken','private-token'];}},
    root,options:{connection:{configured:false},api:()=>pending.promise,notice:()=>{},
      isCurrent:()=>current,onSaved:()=>{remounts++;},canCreate:false}});
  vm.runInContext(moduleSource+'\nmountConnections(root,options);',ctx);
  const saving=form.onsubmit({preventDefault(){}});assert.equal(form.inert,true);
  current=false;pending.resolve({configured:true});await saving;
  assert.equal(form.elements.accessToken.value,'');assert.equal(form.elements.appSecret.value,'');
  assert.equal(remounts,0);assert.equal(form.inert,false);
});
