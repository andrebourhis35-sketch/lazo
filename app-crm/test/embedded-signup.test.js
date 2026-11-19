import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {openStore} from '../src/store.js';
import {whatsapp} from '../src/whatsapp.js';
import {embeddedSignup} from '../src/embedded-signup.js';
import {HttpError} from '../src/core.js';
import {metaAssets} from '../public/meta-signup.js';

function fixture(){
  const store=openStore(':memory:'),calls=[];
  for(const id of ['provider','a','b']){
    store.run('INSERT INTO companies(id,name,created) VALUES(?,?,?)',id,id,Date.now());
    store.run('INSERT INTO users(id,email,name,password,created) VALUES(?,?,?,?,?)',id,id+'@example.test',id,'fake-hash',Date.now());
    store.run("INSERT INTO memberships(company_id,user_id,role) VALUES(?,?,'owner')",id,id);
  }
  const config={origin:'https://lazo.example.test',masterKey:randomBytes(32).toString('base64'),testRecipient:'51900000001',
    metaSignup:{appId:'1542490610948026',configId:'12345678',graphVersion:'v27.0',appSecret:'provider-secret'}};
  const state={status:'CONNECTED',platform:'CLOUD_API',wrongApp:false,missingScope:false,registerTimeout:false,afterPhone:null};
  const fetchImpl=async(url,options)=>{
    const path=new URL(url).pathname;calls.push({path,method:options.method});
    if(path.endsWith('/oauth/access_token'))return Response.json({access_token:'business-token-private'});
    if(path.endsWith('/debug_token'))return Response.json({data:{is_valid:true,app_id:state.wrongApp?'11111111':config.metaSignup.appId,
      scopes:state.missingScope?[]:['whatsapp_business_management','whatsapp_business_messaging']}});
    if(path.endsWith('/phone_numbers'))return Response.json({data:[{id:'22222'}]});
    if(path.endsWith('/22222')){if(state.afterPhone)await state.afterPhone();return Response.json({id:'22222',platform_type:state.platform,status:state.status});}
    if(path.endsWith('/register')&&state.registerTimeout)throw new Error('Provider error with private body');
    return Response.json({success:true});
  };
  const wa=whatsapp(store,config,fetchImpl);
  wa.saveRaw('provider',{phoneId:'11111',wabaId:'33333',accessToken:'provider-token',appSecret:config.metaSignup.appSecret,
    graphVersion:'v27.0',verifyToken:'provider-verification',testRecipient:config.testRecipient},1);
  const signup=embeddedSignup(store,config,wa,fetchImpl),s={company_id:'a',user_id:'a',hash:'session-a'};
  const ensure=()=>{};
  const authorize=async()=>{const ticket=signup.start(s);await signup.exchange(s,{attempt:ticket.attempt,code:'code-private'},ensure);return ticket.attempt;};
  return {store,wa,signup,s,ensure,state,calls,authorize,config};
}
test('Embedded Signup saves a scoped business token, inherits verified provider webhook and subscribes without registering an existing connected number',async()=>{
  const f=fixture();try{
    const attempt=await f.authorize();const result=await f.signup.complete(f.s,{attempt,phoneId:'22222',wabaId:'44444'},f.ensure);
    assert.equal(result.connected,true);assert.equal(result.connection.webhookVerified,true);assert.equal(result.connection.testOnly,true);
    assert.equal(JSON.stringify(result).includes('business-token-private'),false);
    assert.equal(JSON.stringify(result).includes('provider-secret'),false);
    assert.equal(f.store.get('SELECT config FROM connections WHERE company_id=?','a').config.includes('business-token-private'),false);
    assert.equal(f.calls.some(c=>c.path.endsWith('/register')),false);
    assert.equal(f.calls.filter(c=>c.path.endsWith('/subscribed_apps')).length,1);
    await assert.rejects(f.signup.complete(f.s,{attempt,phoneId:'22222',wabaId:'44444'},f.ensure),{status:409});
  }finally{f.store.close();}
});
test('Embedded Signup refuses a foreign session, foreign company, replayed code and missing provider configuration',async()=>{
  const f=fixture();try{
    const attempt=f.signup.start(f.s).attempt;
    for(const s of [{...f.s,hash:'other-session'},{...f.s,company_id:'b'}])
      await assert.rejects(f.signup.exchange(s,{attempt,code:'code'},f.ensure),{status:409});
    await f.signup.exchange(f.s,{attempt,code:'code'},f.ensure);
    await assert.rejects(f.signup.exchange(f.s,{attempt,code:'code'},f.ensure),{status:409});
    f.config.metaSignup.configId='';assert.equal(f.signup.settings().available,false);
    assert.throws(()=>f.signup.start(f.s),{status:409});
  }finally{f.store.close();}
});
test('wrong app, missing scopes and session revocation never save a connection',async()=>{
  for(const mode of ['wrongApp','missingScope','revoked']){
    const f=fixture();try{
      f.state[mode]=true;const attempt=f.signup.start(f.s).attempt;
      const ensure=mode==='revoked'?()=>{throw new HttpError(401,'Session revoked');}:f.ensure;
      await assert.rejects(f.signup.exchange(f.s,{attempt,code:'code'},ensure));
      assert.equal(f.wa.safe('a').configured,false);
    }finally{f.store.close();}
  }
});
test('another company number and a connection changed during authorization are protected before side effects',async()=>{
  const f=fixture();try{
    const attempt=await f.authorize();
    f.wa.saveRaw('b',{phoneId:'22222',wabaId:'44444',accessToken:'other-private',appSecret:'other',graphVersion:'v27.0',verifyToken:'v'},0);
    await assert.rejects(f.signup.complete(f.s,{attempt,phoneId:'22222',wabaId:'44444',pin:'123456'},f.ensure),{status:409});
    assert.equal(f.calls.some(c=>c.method==='POST'),false);assert.equal(f.wa.safe('a').configured,false);
    f.store.run('DELETE FROM connections WHERE company_id=?','b');
    f.state.afterPhone=()=>f.wa.saveRaw('a',{phoneId:'99999',wabaId:'88888',accessToken:'new',appSecret:'other',graphVersion:'v27.0',verifyToken:'v'},0);
    await assert.rejects(f.signup.complete(f.s,{attempt,phoneId:'22222',wabaId:'44444'},f.ensure),{status:409});
    assert.equal(f.wa.safe('a').phoneId,'99999');assert.equal(f.calls.some(c=>c.method==='POST'),false);
  }finally{f.store.close();}
});
test('a CLOUD_API number still pending requires a PIN; ambiguous registration cannot be retried',async()=>{
  const f=fixture();try{
    f.state.status='PENDING';const attempt=await f.authorize();
    assert.deepEqual(await f.signup.complete(f.s,{attempt,phoneId:'22222',wabaId:'44444'},f.ensure),{needsPin:true});
    assert.equal(f.wa.safe('a').configured,false);
    f.state.registerTimeout=true;
    await assert.rejects(f.signup.complete(f.s,{attempt,phoneId:'22222',wabaId:'44444',pin:'123456'},f.ensure),{status:502});
    await assert.rejects(f.signup.complete(f.s,{attempt,phoneId:'22222',wabaId:'44444',pin:'123456'},f.ensure),{status:409});
    assert.equal(f.calls.filter(c=>c.path.endsWith('/register')).length,1);assert.equal(f.wa.safe('a').configured,false);
  }finally{f.store.close();}
});
test('only exact Meta HTTPS origins and bounded JSON session messages are accepted',()=>{
  const data=JSON.stringify({type:'WA_EMBEDDED_SIGNUP',event:'FINISH',data:{phone_number_id:'22222',waba_id:'44444'}});
  assert.equal(metaAssets({origin:'https://www.facebook.com',data}).event,'FINISH');
  for(const origin of ['https://evilfacebook.com','https://www.facebook.com.evil.test','http://www.facebook.com','https://lazo.example.test'])
    assert.equal(metaAssets({origin,data}),null);
  assert.equal(metaAssets({origin:'https://www.facebook.com',data:'invalid'}),null);
});

test('two companies cannot register the same phone concurrently',async()=>{
  const f=fixture();try{
    f.state.status='PENDING';const attempt=await f.authorize();
    const other={company_id:'b',user_id:'b',hash:'session-b'},second=f.signup.start(other).attempt;
    await f.signup.exchange(other,{attempt:second,code:'second-code'},f.ensure);
    let entered,release;const started=new Promise(resolve=>{entered=resolve;});
    f.state.afterPhone=()=>{entered();return new Promise(resolve=>{release=resolve;});};
    const first=f.signup.complete(f.s,{attempt,phoneId:'22222',wabaId:'44444',pin:'123456'},f.ensure);await started;
    await assert.rejects(f.signup.complete(other,{attempt:second,phoneId:'22222',wabaId:'44444',pin:'654321'},f.ensure),{status:409});
    release();assert.equal((await first).connected,true);
    assert.equal(f.calls.filter(c=>c.path.endsWith('/register')).length,1);assert.equal(f.wa.safe('b').configured,false);
  }finally{f.store.close();}
});

test('human onboarding remains valid after twenty minutes but expires after thirty',async t=>{
  let clock=Date.now();t.mock.method(Date,'now',()=>clock);
  const f=fixture();try{
    const ticket=f.signup.start(f.s);assert.equal(ticket.expiresAt,clock+30*60*1000);
    clock+=20*60*1000;
    assert.equal((await f.signup.exchange(f.s,{attempt:ticket.attempt,code:'fresh-code-from-meta'},f.ensure)).authorized,true);
    const result=await f.signup.complete(f.s,{attempt:ticket.attempt,phoneId:'22222',wabaId:'44444'},f.ensure);
    assert.equal(result.connected,true);
    const expired=f.signup.start(f.s);clock+=30*60*1000+1;
    await assert.rejects(f.signup.exchange(f.s,{attempt:expired.attempt,code:'expired-attempt'},f.ensure),{status:409});
  }finally{f.store.close();}
});
