import {createHmac} from 'node:crypto';
import {digest,HttpError,now,requireThat,text,token,vault} from './core.js';

// Short-lived, session-bound handshakes. Restarting invalidates incomplete logins.
// Neither authorization codes nor business tokens are returned to the browser.
export function embeddedSignup(store,config,wa,fetchImpl=fetch){
  const provider=config.metaSignup||{},attempts=new Map(),phoneLocks=new Set(),secrets=vault(config.masterKey);
  const ready=()=>/^\d{5,50}$/.test(provider.appId||'')&&/^\d{5,50}$/.test(provider.configId||'')&&
    /^v\d+\.\d+$/.test(provider.graphVersion||'')&&Boolean(provider.appSecret)&&wa.providerWebhookReady(provider.appSecret);
  function settings(){
    return ready()?{available:true,appId:provider.appId,configId:provider.configId,graphVersion:provider.graphVersion}:
      {available:false,message:'LAZO todavía debe terminar la configuración de inicio de sesión empresarial en Meta. No necesitas copiar tokens ni secretos.'};
  }
  function start(s){
    requireThat(ready(),'La configuración empresarial de Meta de LAZO está pendiente.',409);
    for(const [key,item] of attempts)if(item.expires<now()||(item.company===s.company_id&&item.user===s.user_id))attempts.delete(key);
    requireThat(attempts.size<100,'Hay demasiadas conexiones en curso. Inténtalo más tarde.',429);
    const attempt=token(),expiresAt=now()+30*60*1000;
    attempts.set(digest(attempt),{company:s.company_id,user:s.user_id,session:s.hash,
      expires:expiresAt,phase:'new',busy:false});
    return {...settings(),attempt,expiresAt};
  }
  function context(s,value,ensureSession){
    const key=digest(text(value,100,true)),item=attempts.get(key);
    requireThat(item&&item.expires>now()&&item.company===s.company_id&&item.user===s.user_id&&item.session===s.hash,
      'La autorización caducó o pertenece a otro espacio. Vuelve a conectar con Meta.',409);
    const ensure=()=>{
      ensureSession();
      requireThat(attempts.get(key)===item&&item.expires>now(),
        'La conexión cambió durante la autorización. Recarga Conexiones.',409);
    };
    ensure();return {key,item,ensure};
  }
  async function request(path,{accessToken,query={},body}={}){
    const url=new URL(`https://graph.facebook.com/${provider.graphVersion}/${path}`);
    for(const [key,value] of Object.entries(query))url.searchParams.set(key,value);
    if(accessToken)url.searchParams.set('appsecret_proof',createHmac('sha256',provider.appSecret).update(accessToken).digest('hex'));
    let response,data;
    try{
      response=await fetchImpl(url.href,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',
        ...(accessToken?{Authorization:`Bearer ${accessToken}`}:{})},body:body?JSON.stringify(body):undefined,
        redirect:'error',signal:AbortSignal.timeout(15000)});
      data=await response.json();
    }catch{throw new HttpError(502,'No se pudo confirmar la operación con Meta. Vuelve a autorizar y revisa el estado del número en Meta.');}
    requireThat(response.ok&&!data?.error,'Meta no autorizó la conexión. Revisa los permisos de LAZO y vuelve a iniciar sesión.',502);
    return data;
  }
  async function exchange(s,data,ensureSession){
    const {key,item,ensure}=context(s,data.attempt,ensureSession);
    requireThat(item.phase==='new'&&!item.busy,'Este código de autorización ya se procesó. Vuelve a conectar con Meta.',409);
    const code=text(data.code,4096,true);item.phase='exchanging';item.busy=true;
    try{
      const result=await request('oauth/access_token',{query:{client_id:provider.appId,client_secret:provider.appSecret,code}});
      const accessToken=text(result.access_token,4096,true);ensure();
      const checked=await request('debug_token',{accessToken:`${provider.appId}|${provider.appSecret}`,query:{input_token:accessToken}});ensure();
      requireThat(checked.data?.is_valid&&String(checked.data.app_id)===provider.appId,
        'Meta devolvió una autorización que no corresponde a LAZO.',403);
      const scopes=checked.data.scopes||[];
      requireThat(['whatsapp_business_management','whatsapp_business_messaging'].every(scope=>scopes.includes(scope)),
        'Debes autorizar la administración de WhatsApp y la mensajería para conectar LAZO.',403);
      requireThat(!checked.data.expires_at||checked.data.expires_at*1000>now(),'La autorización de Meta ha caducado.',403);
      item.secret=secrets.seal({accessToken},key);item.phase='authorized';return {authorized:true};
    }catch(error){attempts.delete(key);throw error;}finally{item.busy=false;}
  }
  async function complete(s,data,ensureSession){
    const {key,item,ensure}=context(s,data.attempt,ensureSession);
    requireThat(item.phase==='authorized'&&!item.busy,'Vuelve a autorizar la conexión con Meta.',409);
    const phoneId=text(data.phoneId,50,true),wabaId=text(data.wabaId,50,true);
    requireThat(/^\d+$/.test(phoneId)&&/^\d+$/.test(wabaId),'Meta no devolvió un número y una cuenta válidos.');
    requireThat(!item.phoneId||(item.phoneId===phoneId&&item.wabaId===wabaId),'El número cambió durante el alta. Vuelve a conectar con Meta.',409);
    const {accessToken}=secrets.open(item.secret,key);
    requireThat(!phoneLocks.has(phoneId),'Hay otra conexión de este número en curso. Espera antes de reintentar.',409);
    phoneLocks.add(phoneId);item.busy=true;
    const existing=()=>store.get('SELECT company_id,config FROM connections WHERE phone_id=?',phoneId);
    const original=existing()?.config;
    const ensureAssets=()=>{
      ensure();
      const current=existing();
      requireThat(!current||current.company_id===item.company,'Ese número ya está conectado a otro espacio de LAZO.',409);
      requireThat(current?.config===original,'Este número cambió durante la autorización. Recarga Conexiones.',409);
    };
    try{
      ensureAssets();
      const phones=await request(`${wabaId}/phone_numbers`,{accessToken,query:{fields:'id',limit:'100'}});ensureAssets();
      requireThat(phones.data?.some(phone=>phone.id===phoneId),'El número no pertenece a la cuenta que autorizaste.',403);
      const phone=await request(phoneId,{accessToken,query:{fields:'id,platform_type,status'}});ensureAssets();
      requireThat(phone.id===phoneId&&['CLOUD_API','NOT_APPLICABLE'].includes(phone.platform_type),
        'Este tipo de número necesita una incorporación diferente en Meta. No se ha migrado ni sustituido la conexión.',409);
      item.phoneId=phoneId;item.wabaId=wabaId;
      requireThat(['CONNECTED','PENDING'].includes(phone.status),'El número no está conectado o pendiente de registro. Revisa su estado en WhatsApp Manager.',409);
      if(phone.status!=='CONNECTED'){
        if(!data.pin)return {needsPin:true};
        const pin=text(data.pin,6,true);requireThat(/^\d{6}$/.test(pin),'Elige un PIN de verificación de dos pasos de seis dígitos.');
        ensureAssets();
        // A registration with an uncertain result must never be blindly retried.
        item.phase='registering';
        const registered=await request(`${phoneId}/register`,{accessToken,body:{messaging_product:'whatsapp',pin}});ensure();
        requireThat(registered.success===true,'Meta no confirmó el registro del número.',502);item.phase='authorized';
      }
      requireThat(wa.providerWebhookReady(provider.appSecret),'Falta verificar el webhook de LAZO en Meta.',409);
      ensureAssets();
      await wa.connect(item.company,{phoneId,wabaId,accessToken,appSecret:provider.appSecret,graphVersion:provider.graphVersion},item.user,ensureAssets,true);
      attempts.delete(key);return {connected:true,connection:wa.safe(item.company,phoneId)};
    }catch(error){if(item.phase==='registering')attempts.delete(key);throw error;}finally{item.busy=false;phoneLocks.delete(phoneId);}
  }
  return {settings,start,exchange,complete};
}
