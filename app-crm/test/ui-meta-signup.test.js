import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/meta-signup.js',import.meta.url),'utf8').replaceAll('export function','function');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
  const button={textContent:'Conectar con Meta'},status={},pin={reset(){},hidden:true},nodes={'#meta-connect':button,'#meta-state':status,'#meta-pin-form':pin};
  const listeners=new Map(),calls=[];let callback,exchangeDone,current=true,saved=0;
  const FB={init(){},login(fn){callback=fn;}};
  const ctx=vm.createContext({root:{querySelector:key=>nodes[key]},
    window:{FB,addEventListener:(event,fn)=>listeners.set(event,fn),removeEventListener:(event,fn)=>{if(listeners.get(event)===fn)listeners.delete(event);}},
    document:{createElement:()=>({remove(){}}),head:{append:script=>script.onload()}},
    setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},
    options:{isCurrent:()=>current,notice(){},onSaved:()=>{saved++;},api:async(path,options)=>{
      calls.push({path,body:options?.body});
      if(path.endsWith('/exchange'))return new Promise(resolve=>{exchangeDone=resolve;});
      if(path.endsWith('/complete'))return {connected:true};
      return {available:true,appId:'123456',configId:'654321',graphVersion:'v27.0',attempt:'test-attempt'};
    }}});
  vm.runInContext(source+'\nmountMetaSignup(root,options);',ctx);
  const emit=(event='FINISH')=>listeners.get('message')?.({origin:'https://www.facebook.com',data:JSON.stringify({type:'WA_EMBEDDED_SIGNUP',event,data:{phone_number_id:'22222',waba_id:'44444'}})});
  return {button,calls,emit,callback:()=>callback,resolve:()=>exchangeDone({authorized:true}),saved:()=>saved,leave:()=>{current=false;}};
}
for(const codeFirst of [true,false])test('Meta code is exchanged immediately and completes only after asset event: '+(codeFirst?'code first':'assets first'),async()=>{
  const f=fixture();await tick();assert.equal(f.button.disabled,false);
  f.button.onclick();assert.equal(typeof f.callback(),'function','FB.login must start in the click');
  if(!codeFirst)f.emit();
  f.callback()({authResponse:{code:'private-code'}});
  assert.equal(f.calls.filter(c=>c.path.endsWith('/exchange')).length,1);
  assert.equal(f.calls.filter(c=>c.path.endsWith('/complete')).length,0);
  f.resolve();await tick();
  if(codeFirst){assert.equal(f.saved(),0);f.emit();}
  await tick();assert.equal(f.saved(),1);
  assert.equal(f.calls.filter(c=>c.path.endsWith('/complete')).length,1);
});
test('coexistence finish and a detached view cannot exchange credentials or finish onboarding',async()=>{
  const f=fixture();await tick();f.button.onclick();f.emit('FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING');
  f.callback()({authResponse:{code:'private-code'}});await tick();
  assert.equal(f.calls.some(c=>c.path.endsWith('/exchange')),false);assert.equal(f.saved(),0);
  const g=fixture();await tick();g.button.onclick();g.leave();g.callback()({authResponse:{code:'private-code'}});g.emit();await tick();
  assert.equal(g.calls.some(c=>c.path.endsWith('/exchange')),false);assert.equal(g.saved(),0);
});

test('a callback from a cancelled popup cannot authorize a later login attempt',async()=>{
  const f=fixture();await tick();f.button.onclick();const old=f.callback();
  f.emit('CANCEL');f.button.onclick();await tick();f.button.onclick();
  old({authResponse:{code:'old-private-code'}});await tick();
  assert.equal(f.calls.filter(c=>c.path.endsWith('/exchange')).length,0);
  f.callback()({authResponse:{code:'new-private-code'}});f.resolve();await tick();f.emit();await tick();
  assert.equal(f.calls.filter(c=>c.path.endsWith('/exchange')).length,1);assert.equal(f.saved(),1);
});
