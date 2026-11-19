let sdk;
function loadSdk(settings){
  if(sdk)return sdk;
  const pending=new Promise((resolve,reject)=>{
    let settled=false,timer;
    const previous=window.fbAsyncInit;
    const script=document.createElement('script');script.src='https://connect.facebook.net/es_LA/sdk.js';script.async=true;
    script.crossOrigin='anonymous';
    function cleanup(){clearTimeout(timer);if(window.fbAsyncInit===ready)window.fbAsyncInit=previous;}
    function failed(message){if(settled)return;settled=true;cleanup();script.remove();sdk=null;reject(new Error(message));}
    function ready(){
      // Meta's bootstrap publishes a temporary FB whose login only queues calls.
      // The real SDK replaces that object before calling fbAsyncInit.
      if(settled||!window.FB||window.FB.__buffer)return;
      try{window.FB.init({appId:settings.appId,version:settings.graphVersion,autoLogAppEvents:false,xfbml:false});}
      catch{failed('Meta no pudo iniciar la conexión. Recarga la página e inténtalo de nuevo.');return;}
      settled=true;cleanup();resolve(window.FB);
    }
    // sdk.js is a bootstrap: its load event can precede the actual FB API.
    // Meta calls fbAsyncInit after its dependent SDK modules are ready.
    window.fbAsyncInit=ready;
    script.onload=ready;
    script.onerror=()=>failed('No se pudo cargar Meta. Revisa la conexión y el bloqueo de rastreadores.');
    timer=setTimeout(()=>failed('Meta tardó demasiado en cargar. Recarga la página e inténtalo de nuevo.'),25000);
    if(window.FB&&!window.FB.__buffer)ready();else document.head.append(script);
  });
  sdk=pending;
  pending.catch(()=>{if(sdk===pending)sdk=null;});
  return pending;
}
export function metaAssets(event){
  if(!['https://www.facebook.com','https://web.facebook.com'].includes(event.origin))return null;
  let data;try{data=typeof event.data==='string'&&event.data.length<12000?JSON.parse(event.data):null;}catch{return null;}
  if(data?.type!=='WA_EMBEDDED_SIGNUP')return null;
  return data;
}
export function mountMetaSignup(root,{api,isCurrent,onSaved,notice,connection}){
  root.innerHTML='<h2>Conecta tu WhatsApp con Meta</h2><p class="muted">Inicia sesión en Meta, elige tu negocio y autoriza la cuenta y el número que quieras usar en LAZO. Tus credenciales se gestionan automáticamente.</p><button class="send" id="meta-connect" type="button" disabled>Conectar con Meta</button><p class="muted" id="meta-state" role="status" aria-live="polite">Comprobando disponibilidad…</p><form id="meta-pin-form" hidden><label>PIN de verificación de dos pasos<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="new-password" required></label><p class="muted">Tu número necesita registrarse en Cloud API. Elige un PIN de seis dígitos y guárdalo en tu gestor de contraseñas. No lo envíes por chat.</p><button class="send" type="submit">Registrar este número y conectar</button></form><p class="muted">La disponibilidad de cuentas depende de los permisos y requisitos de Meta. El proceso no cambia el número que ya tiene este espacio ni habilita envíos comerciales por sí solo.</p>';
  const button=root.querySelector('#meta-connect'),status=root.querySelector('#meta-state'),pinForm=root.querySelector('#meta-pin-form');
  if(connection?.configured){const hint=document.createElement('p');hint.className='muted';hint.textContent='Este espacio ya tiene una conexión. Para añadir otro número, usa «Crear espacio para otra API» al final de esta página y conecta desde ese espacio nuevo.';button.before(hint);}
  let ticket,FB,assets,generation=0,authorized=false,completing=false,active=false,cleanup=()=>{};
  function fail(message){generation++;cleanup();active=false;completing=false;pinForm.inert=false;button.disabled=false;button.textContent='Volver a conectar con Meta';status.textContent=message;pinForm.hidden=true;}
  async function prepare(){
    const current=++generation;cleanup();active=false;completing=false;ticket=null;pinForm.hidden=true;pinForm.reset();
    button.disabled=true;
    try{
    const settings=await api('/whatsapp/signup');if(!isCurrent())return;
    if(current!==generation)return;
    if(!settings.available){status.textContent=settings.message;return;}
    const prepared=await api('/whatsapp/signup/start',{method:'POST',body:{}});if(!isCurrent()||current!==generation)return;
    const loaded=await loadSdk(prepared);if(!isCurrent()||current!==generation)return;ticket=prepared;FB=loaded;
    button.disabled=false;button.textContent='Conectar con Meta';status.textContent='Todo listo: pulsa «Conectar con Meta». Dispones de hasta 30 minutos para completar el alta.';
    }catch(error){if(isCurrent()&&current===generation)fail(error.message);}
  }
  async function complete(pin,expected=generation){
    const live=()=>isCurrent()&&expected===generation&&active;
    if(!live()||!assets||!authorized||completing)return;
    completing=true;pinForm.inert=true;status.textContent='Comprobando la cuenta autorizada y conectando…';
    try{
      const result=await api('/whatsapp/signup/complete',{method:'POST',body:{attempt:ticket.attempt,
        phoneId:assets.phone_number_id,wabaId:assets.waba_id,...(pin?{pin}:{})}});
      if(!live())return;
      cleanup();
      if(result.needsPin){pinForm.hidden=false;status.textContent='Meta autorizó la cuenta. Falta registrar el número con tu PIN.';return;}
      active=false;pinForm.reset();notice('Meta autorizó la cuenta y confirmó la suscripción. Comprueba ahora un mensaje entrante real.');await onSaved();
    }catch(error){if(live())fail(error.message);}finally{if(expected===generation){completing=false;pinForm.inert=false;}}
  }
  pinForm.onsubmit=event=>{event.preventDefault();void complete(new FormData(pinForm).get('pin'));};
  button.onclick=()=>{
    if(!isCurrent())return;
    // Refresh a consumed/failed ticket, then require a fresh user click to avoid popup blocking.
    if(!ticket||ticket.expiresAt<=Date.now()||active===false&&button.textContent.startsWith('Volver')){
      ticket=null;void prepare();return;
    }
    const launched=++generation,launchTicket=ticket;
    const live=()=>isCurrent()&&active&&launched===generation;
    active=true;assets=null;authorized=false;button.disabled=true;status.textContent='Completa la autorización en la ventana de Meta…';
    const listener=event=>{
      if(!live())return;
      const result=metaAssets(event);if(!result)return;
      if(result.event==='CANCEL'||result.event==='ERROR'){fail('La autorización no se completó. Puedes volver a conectar con Meta.');return;}
      if(result.event==='FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'){fail('La conexión del WhatsApp Business del celular se habilitará en otra fase. Elige un número de Cloud API.');return;}
      if(!['FINISH','FINISH_GRANT_ONLY_API_ACCESS'].includes(result.event))return;
      if(!/^\d{1,50}$/.test(result.data?.phone_number_id||'')||!/^\d{1,50}$/.test(result.data?.waba_id||''))return;
      assets=result.data;void complete(undefined,launched);
    };
    const interval=setInterval(()=>{if(launched===generation&&!isCurrent()){cleanup();active=false;}},1000);
    const remaining=Math.max(0,(launchTicket.expiresAt||Date.now()+30*60*1000)-Date.now());
    const timeout=setTimeout(()=>{if(launched!==generation)return;if(isCurrent())fail('El intento de conexión venció. Vuelve a conectar con Meta para completar el alta.');else cleanup();},remaining);
    cleanup=()=>{window.removeEventListener('message',listener);clearInterval(interval);clearTimeout(timeout);};
    window.addEventListener('message',listener);
    // FB.login is called synchronously in the click, after loading SDK and ticket.
    try{FB.login(response=>{
      if(!live())return;
      const code=response?.authResponse?.code;
      if(typeof code!=='string'||!code){fail('Meta no devolvió autorización. Puedes volver a intentarlo.');return;}
      // Exchange immediately: Meta codes expire after 30 seconds. Do not wait for asset events.
      void api('/whatsapp/signup/exchange',{method:'POST',body:{attempt:launchTicket.attempt,code}})
        .then(()=>{if(!live())return;authorized=true;void complete(undefined,launched);})
        .catch(error=>{if(live())fail(error.message);});
    },{config_id:launchTicket.configId,response_type:'code',override_default_response_type:true,extras:{setup:{}}});}
    catch{fail('No se pudo abrir la ventana de Meta. Permite las ventanas emergentes e inténtalo de nuevo.');}
  };
  void prepare();
}
