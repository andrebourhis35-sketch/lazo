import { mountMetaSignup } from './meta-signup.js?v=20261119-signup-time';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=value=>value?new Intl.DateTimeFormat('es-PE',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'Sin eventos todavía';

export function mountConnections(root,{connection:c,api,notice,isCurrent,onSaved,onCreateCompany,canCreate}) {
  root.innerHTML=`<div class="crm-intro"><div><span class="eyebrow">WHATSAPP CLOUD API</span><h2>Conecta tu número con LAZO</h2><p class="muted">Una conexión activa por empresa. Elige la empresa en el menú lateral antes de guardar.</p></div></div>
  <div class="settings-grid">
    <section class="settings-card" id="meta-signup"></section>
    <details class="settings-card"><summary>Conexión manual avanzada</summary><h2>Credenciales de Meta</h2>
      <p class="muted">${c.configured?'API guardada. Puedes renovar sus credenciales; los identificadores pertenecen a esta conexión.':'Introduce las credenciales de una API que ya tengas configurada en Meta.'}</p>
      <form id="wa-connect" autocomplete="off">
        <label>Identificador del número (Phone Number ID)<input name="phoneId" inputmode="numeric" pattern="[0-9]+" maxlength="50" value="${esc(c.phoneId)}" ${c.configured?'readonly':''} required></label>
        <label>Cuenta de WhatsApp Business (WABA ID)<input name="wabaId" inputmode="numeric" pattern="[0-9]+" maxlength="50" value="${esc(c.wabaId)}" ${c.configured?'readonly':''} required></label>
        <label>Versión de Graph API<input name="graphVersion" pattern="v[0-9]+[.][0-9]+" maxlength="12" value="${esc(c.graphVersion)}" placeholder="La que aparece en tu panel de Meta, por ejemplo v25.0" required></label>
        <label>Token de acceso<input name="accessToken" type="password" autocomplete="new-password" maxlength="4096" ${c.configured?'':'required'} placeholder="${c.configured?'Guardado · vacío conserva el actual':'Pega el token únicamente aquí'}"></label>
        <label>Secreto de la app de Meta<input name="appSecret" type="password" autocomplete="new-password" maxlength="256" ${c.hasAppSecret?'':'required'} placeholder="${c.hasAppSecret?'Guardado · vacío conserva el actual':'Necesario para validar los mensajes entrantes'}"></label>
        <p class="muted">Encontrarás los identificadores y el token en Meta Developers → tu app → WhatsApp → Configuración de la API. El secreto está en Configuración de la app → Básica. Se guardan cifrados en el servidor.</p>
        <button class="send" type="submit">Comprobar con Meta y guardar</button>
        <p id="wa-result" role="status" aria-live="polite" class="muted"></p>
      </form>
      <p class="muted">Esto comprueba el acceso a la cuenta y al número. No envía mensajes, no registra ni migra el número desde otro proveedor.</p>
    </details>
    <section class="settings-card"><h2>Recepción y estado</h2>
      ${c.configured?`<dl><dt>Acceso a la cuenta comprobado</dt><dd>${when(c.checkedAt)}</dd><dt>URL verificada por Meta</dt><dd>${c.webhookVerified?'Sí':'Pendiente'}</dd><dt>Secreto de la app</dt><dd>${c.hasAppSecret?'Guardado':'Pendiente'}</dd><dt>Último evento recibido</dt><dd>${when(c.webhookAt)}</dd></dl>
      <p class="muted">${c.testOnly?'Modo de prueba: los envíos siguen limitados al destinatario autorizado.':'El envío depende de los permisos de Meta y de la ventana de atención.'}</p>
      <label>URL de devolución de llamada<input readonly value="${esc(c.callbackUrl)}"></label>
      <label>Token de verificación<input id="wa-verify" type="password" readonly value="${esc(c.verifyToken)}"></label>
      <button class="secondary" id="wa-reveal" type="button">Mostrar token de verificación</button>
      <ol><li>En Meta, abre WhatsApp → Configuración y guarda esta URL y el token de verificación.</li><li>Suscríbete al campo <strong>messages</strong>.</li><li>Vuelve aquí y vincula la app a la cuenta.</li></ol>
      <button class="secondary" id="wa-subscribe" type="button">Vincular app a esta cuenta</button>
      <p id="wa-subscribe-result" class="muted" role="status" aria-live="polite"></p>
      <p class="muted">Después, envía un mensaje desde tu WhatsApp al número conectado y comprueba que aparece en Conversaciones. Una comprobación de credenciales no acredita la entrega de mensajes.</p>`:'<p class="muted">Guarda primero las credenciales para obtener la URL y el token de verificación. Después podrás configurar la recepción en Meta.</p>'}
    </section>
    <section class="settings-card"><h2>¿Quieres conectar otro número?</h2><p class="muted">Por ahora, cada número necesita un espacio de empresa separado, con contactos, equipo y flujos propios. La bandeja con varios números llegará en otra fase. El espacio actual conserva su cuenta de prueba y sus automatizaciones.</p>
      ${canCreate?'<form id="wa-company"><label>Nombre del nuevo espacio<input name="name" maxlength="100" placeholder="Por ejemplo: Tienda · WhatsApp comercial" required></label><button type="submit" class="secondary">Crear espacio para otra API</button></form>':'<p class="muted">El propietario puede crear otro espacio desde su cuenta.</p>'}
      <p class="muted">La conexión mediante WhatsApp Business en el celular se implementará con el proceso oficial de Meta. El enlace por QR todavía no está disponible.</p>
    </section>
  </div>`;
  const meta=root.querySelector('#meta-signup');
  if(meta)mountMetaSignup(meta,{api,notice,isCurrent,onSaved,connection:c});
  const form=root.querySelector('#wa-connect');
  form.onsubmit=async event=>{
    event.preventDefault();if(!isCurrent())return;
    const button=form.querySelector('button'),result=root.querySelector('#wa-result');
    button.disabled=true;form.inert=true;result.textContent='Comprobando el acceso con Meta…';
    try {
      const data=Object.fromEntries(new FormData(form));
      for(const key of Object.keys(data))data[key]=data[key].trim();
      await api('/whatsapp',{method:'PUT',body:data});
      // Never retain credential fields after a successful save, even if the view changed.
      form.elements.accessToken.value='';form.elements.appSecret.value='';
      if(!isCurrent())return;
      notice('Credenciales comprobadas con Meta y guardadas. Revisa el estado de recepción.');await onSaved();
    } catch(error){if(isCurrent()){result.textContent=error.message;notice(error.message,true);}}
    finally{button.disabled=false;form.inert=false;}
  };
  const reveal=root.querySelector('#wa-reveal');
  if(reveal)reveal.onclick=()=>{const field=root.querySelector('#wa-verify');field.type=field.type==='password'?'text':'password';reveal.textContent=field.type==='password'?'Mostrar token de verificación':'Ocultar token de verificación';};
  const subscribe=root.querySelector('#wa-subscribe');
  if(subscribe)subscribe.onclick=async()=>{
    if(!isCurrent())return;subscribe.disabled=true;
    const result=root.querySelector('#wa-subscribe-result');result.textContent='Vinculando…';
    try {await api('/whatsapp/subscribe',{method:'POST',body:{}});if(isCurrent())result.textContent='Meta confirmó la suscripción de la app a la cuenta. Comprueba ahora un mensaje entrante real.';}
    catch(error){if(isCurrent())result.textContent=error.message;}
    finally{subscribe.disabled=false;}
  };
  const company=root.querySelector('#wa-company');
  if(company)company.onsubmit=async event=>{
    event.preventDefault();if(!isCurrent())return;const button=company.querySelector('button');button.disabled=true;
    try {await onCreateCompany(new FormData(company).get('name'));}
    catch(error){if(isCurrent())notice(error.message,true);}
    finally{button.disabled=false;}
  };
}
