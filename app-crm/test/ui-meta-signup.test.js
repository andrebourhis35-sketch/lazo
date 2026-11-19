import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/meta-signup.js',import.meta.url),'utf8').replaceAll('export function','function');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('SDK bootstrap load waits for fbAsyncInit and initializes only once',async()=>{
  let script,initialized=0,done=false;const timers=new Map();
  const ctx=vm.createContext({window:{},settings:{appId:'123456',graphVersion:'v27.0'},
    document:{createElement:()=>({remove(){}}),head:{append:node=>{script=node;}}},
    setTimeout:fn=>{timers.set(1,fn);return 1;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(source,ctx);const loading=vm.runInContext('loadSdk(settings)',ctx).then(value=>{done=true;return value;});
  const provisional={__buffer:{calls:[]},init(){initialized++;},login(...args){this.__buffer.calls.push(args);}};
  ctx.window.FB=provisional;
  script.onload();await tick();assert.equal(done,false,'Bootstrap load alone is not SDK readiness');
  assert.equal(initialized,0,'The provisional SDK must not be initialized or retained');
  ctx.window.FB={init(){initialized++;},login(){}};const ready=ctx.window.fbAsyncInit;
  ready();assert.equal(await loading,ctx.window.FB);ready();script.onload();
  assert.equal(initialized,1);assert.equal(timers.size,0);
  assert.notEqual(await loading,provisional);
});
test('SDK load timeout is bounded and a new attempt can recover',async()=>{
  const scripts=[],timers=new Map();let timer=0;
  const ctx=vm.createContext({window:{},settings:{appId:'123456',graphVersion:'v27.0'},
    document:{createElement:()=>({removed:false,remove(){this.removed=true;}}),head:{append:node=>scripts.push(node)}},
    setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(source,ctx);const first=vm.runInContext('loadSdk(settings)',ctx);const failed=assert.rejects(first,/demasiado/);
  const stale=ctx.window.fbAsyncInit;timers.get(1)();await failed;assert.equal(scripts[0].removed,true);
  const second=vm.runInContext('loadSdk(settings)',ctx);ctx.window.FB={init(){},login(){}};
  stale();ctx.window.fbAsyncInit();assert.equal(await second,ctx.window.FB);assert.equal(scripts.length,2);
});
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
