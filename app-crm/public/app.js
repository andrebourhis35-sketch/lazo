import { mountConnections } from './connections-ui.js?v=20261119-sdk-full';
import { mountManagement, replyPicker, renderStatistics } from './work-ui.js?v=20261117';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let stages=[],pipelineStages=[],quickReplies=[],statsDays=30;
const roles={owner:'Propietario',admin:'Administrador',agent:'Asesor'};
const labels={conversations:'Conversaciones',contacts:'Contactos',sales:'Ventas',statistics:'Estadísticas',connections:'Conexiones',settings:'Ajustes'};
const statusNames={queued:'En proceso',accepted:'Aceptado por Meta',sent:'Enviado',delivered:'Entregado',read:'Leído',received:'Recibido',failed:'Rechazado por Meta',unknown:'Envío no confirmado; revisa antes de repetir'};
let session=null,contacts=[],members=[],active=null,view=new URLSearchParams(location.search).get('view')==='connections'?'connections':'conversations',messages=[],templates=[],csrf='',authMode='login';
const fragment=new URLSearchParams(location.hash.slice(1));
let setupToken=fragment.get('setup')||'',inviteToken=fragment.get('invite')||'';
let resetToken=fragment.get('reset')||'';
if(location.hash)history.replaceState(null,'',location.pathname+location.search);
const drafts=new Map(),sendKeys=new Map();let polling=false,noticeTimer,workspaceEpoch=0;
const fileDrafts=new Map(),mediaUrls=new Map(),sendsInFlight=new Map();let chatGeneration=0;
let inboxFilters={status:'all',owner:'',tag:''};
function clearWorkspaceView(){fileDrafts.clear();for(const url of mediaUrls.values())URL.revokeObjectURL(url);mediaUrls.clear();inboxFilters={status:'all',owner:'',tag:''};document.querySelectorAll('dialog').forEach(d=>d.close());}
function contactTags(c){try{return JSON.parse(c.tags||'[]');}catch{return [];}}
function setPipeline(list){pipelineStages=list;stages=list.map(s=>s.name);}
function requestHeaders(){return {'X-Lazo-Client':'1',...(csrf?{'X-CSRF-Token':csrf}:{}),...(session?{'X-Lazo-Company':session.company.id,'X-Lazo-User':session.user.id}:{})};}
function notice(message,error=false){$('notice').textContent=message;$('notice').className=error?'error':'';$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,9000);}
async function api(path,{method='GET',body,binary=false}={}) {
  const form=body instanceof FormData;
  const response=await fetch('/api/crm'+path,{method,credentials:'same-origin',headers:{...(!form?{'Content-Type':'application/json'}:{}),...requestHeaders()},body:body===undefined?undefined:form?body:JSON.stringify(body)});
  if(binary&&response.ok)return response.blob();
  let data;try{data=await response.json();}catch{throw new Error('No se pudo leer la respuesta del servidor.');}
  if(!response.ok){const err=new Error(data.error||'No se pudo completar la acción.');err.status=response.status;err.code=data.code;if(data.code==='CONTEXT_CHANGED')contextChanged();throw err;}return data;
}
function contextChanged(){if(document.querySelector('.context-changed'))return;workspaceEpoch++;const overlay=document.createElement('div');overlay.className='context-changed';overlay.innerHTML='<section><h2>Tu sesión cambió en otra pestaña</h2><p>Recarga para confirmar la empresa y la cuenta con la que estás trabajando.</p><button class="send" id="reload-context">Recargar mi espacio</button></section>';$('root').inert=true;document.body.append(overlay);$('reload-context').onclick=()=>location.reload();}
function bind(form,fn){form.addEventListener('submit',async e=>{e.preventDefault();const submit=e.submitter;if(submit)submit.disabled=true;try{await fn(Object.fromEntries(new FormData(form)),form);}catch(error){notice(error.message,true);}finally{if(submit)submit.disabled=false;}});}
function initials(name){return name.trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();}
function options(values,selected){return values.map(v=>`<option value="${esc(v.id??v)}"${(v.id??v)===selected?' selected':''}>${esc(v.name??v)}</option>`).join('');}
function ownerName(id){return members.find(m=>m.id===id)?.name||'Sin asignar';}
function brand(){return '<a class="brand" href="/app/"><img src="/app/marca.svg" alt="">lazo<span>workspace</span></a>';}
function fmt(t){return new Intl.DateTimeFormat('es-PE',{dateStyle:'short',timeStyle:'short'}).format(new Date(t));}
async function loginScreen(mode='login') {
  authMode=mode;let info=null;
  if(inviteToken) {try{info=await api('/invitations/info',{method:'POST',body:{token:inviteToken}});mode=info.existing?'invite-existing':'invite';}catch(e){notice(e.message,true);inviteToken='';}}
  else if(setupToken)mode='setup';
  $('root').innerHTML=`<main class="auth-layout"><section class="auth-story">${brand()}<span class="eyebrow">CONECTA CONVERSACIONES. IMPULSA VENTAS.</span><h1>Todo tu equipo.<br>Cada conversación.<br>Un mismo espacio.</h1><p>Organiza tus contactos y acompaña cada oportunidad, desde el primer mensaje hasta la venta.</p><a href="/interfaz/">Explorar la demostración ↗</a></section><section class="auth-panel"><div class="auth-card"><span class="eyebrow">TU ESPACIO DE TRABAJO</span><h2>${mode==='setup'?'Activa tu plataforma':mode.startsWith('invite')?'Únete a tu equipo':'Te damos la bienvenida'}</h2><p class="muted">${mode==='setup'?'Crea la primera empresa y tu cuenta de propietario.':info?`Invitación a ${esc(info.company)} para ${esc(info.email)}.`:'Inicia sesión para acceder a tu empresa.'}</p><form id="auth-form">
  ${mode==='setup'?'<label>Empresa<input name="company" maxlength="100" required value="La Boutique du Monde"></label>':''}
  ${mode==='setup'||mode==='invite'?'<label>Tu nombre<input name="name" maxlength="80" autocomplete="name" required></label>':''}
  ${mode!=='invite'?`<label>Correo electrónico<input name="email" type="email" autocomplete="username" required value="${esc(info?.email||'')}"></label>`:''}
  <label>Contraseña<input name="password" type="password" autocomplete="${mode==='setup'||mode==='invite'?'new-password':'current-password'}" minlength="12" maxlength="128" required></label>
  <p class="muted">${mode==='setup'||mode==='invite'?'Usa al menos 12 caracteres. Tu contraseña se guarda protegida.':'Usa la contraseña de tu cuenta de LAZO.'}</p><button class="send" type="submit">${mode==='setup'?'Activar mi plataforma':mode==='invite'?'Crear mi cuenta':'Entrar'}</button></form><p class="muted">Acceso privado · Tus datos pertenecen a tu empresa.</p></div></section></main>`;
  bind($('auth-form'),async data=>{
    if(mode==='setup'){await api('/bootstrap',{method:'POST',body:{...data,token:setupToken}});setupToken='';}
    else if(mode==='invite'){await api('/invitations/accept',{method:'POST',body:{...data,token:inviteToken}});inviteToken='';}
    else if(mode==='invite-existing'){await api('/invitations/accept',{method:'POST',body:{token:inviteToken,password:data.password}});inviteToken='';}
    else {await api('/login',{method:'POST',body:data});}
    await startWorkspace();
  });
  if(mode==='login') {
    const recover=document.createElement('button');recover.type='button';recover.className='recovery-link';
    recover.textContent='Olvidé mi contraseña';recover.onclick=()=>passwordScreen('forgot');$('auth-form').after(recover);
  }
}
function passwordScreen(mode) {
  const reset=mode==='reset';
  $('root').innerHTML=`<main class="auth-layout"><section class="auth-story">${brand()}<span class="eyebrow">TU ESPACIO, CONTIGO.</span><h1>Vuelve a conectar<br>con tu equipo.</h1><p>Recupera tu acceso a LAZO desde el correo de tu cuenta.</p></section><section class="auth-panel"><div class="auth-card"><span class="eyebrow">ACCESO A TU CUENTA</span><h2>${reset?'Crea una nueva contraseña':'Recupera tu acceso'}</h2><p class="muted">${reset?'El enlace es de un solo uso. Se cerrarán las sesiones anteriores.':'Introduce el correo que usas para entrar a LAZO.'}</p><form id="recovery-form">${reset?'<label>Nueva contraseña<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><label>Repite la nueva contraseña<input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><p class="muted">Usa entre 12 y 128 caracteres.</p>':'<label>Correo electrónico<input name="email" type="email" autocomplete="username" required></label>'}<button class="send" type="submit">${reset?'Guardar nueva contraseña':'Solicitar enlace'}</button></form><button type="button" id="back-login" class="recovery-link">Volver a iniciar sesión</button></div></section></main>`;
  $('back-login').onclick=()=>{resetToken='';loginScreen().catch(e=>notice(e.message,true));};
  bind($('recovery-form'),async(data,form)=>{
    if(reset) {
      if(data.password!==data.confirmPassword)throw new Error('Las contraseñas no coinciden.');
      await api('/password/reset',{method:'POST',body:{...data,token:resetToken}});
      resetToken='';session=null;csrf='';workspaceEpoch++;clearWorkspaceView();drafts.clear();sendKeys.clear();
      await loginScreen();notice('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
    } else {
      const result=await api('/password/forgot',{method:'POST',body:data});
      form.replaceChildren();const status=document.createElement('p');status.className='recovery-status';status.setAttribute('role','status');status.textContent=result.message;form.append(status);
    }
  });
}
async function loadSession(){session=await api('/session');csrf=session.csrf;}
async function startWorkspace(){clearWorkspaceView();workspaceEpoch++;await loadSession();if(inviteToken){await api('/invitations/accept',{method:'POST',body:{token:inviteToken}});inviteToken='';await loadSession();}const epoch=workspaceEpoch;const loaded=await Promise.all([api('/contacts').then(d=>d.contacts),api('/members').then(d=>d.members),api('/pipeline').then(d=>d.stages),api('/quick-replies').then(d=>d.replies)]);if(epoch!==workspaceEpoch)return;[contacts,members,pipelineStages,quickReplies]=loaded;setPipeline(pipelineStages);active=contacts.find(c=>c.id===active)?.id||contacts[0]?.id||null;shell();await showView(view);}
function shell(){
  $('root').innerHTML=`<div class="app"><aside class="sidebar">${brand()}<label class="workspace-picker"><span class="sr-only">Empresa activa</span><select id="workspace">${options(session.companies,session.company.id)}</select></label><span class="nav-label">TU ESPACIO DE TRABAJO</span><nav>${Object.entries(labels).filter(([key])=>key!=='connections'||session.user.role!=='agent').map(([key,label])=>`<button data-view="${key}" aria-label="${label}"><span aria-hidden="true">${({conversations:'◫',contacts:'♙',sales:'▥',statistics:'▤',connections:'↔',settings:'⚙'})[key]}</span>${label}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="demo-card"><span class="dot"></span>Datos guardados en tu empresa<p>Contactos, notas y conversaciones sincronizados con el servidor.<br>Isotipo provisional.</p></div><div class="user"><span class="avatar">${esc(initials(session.user.name))}</span><div>${esc(session.user.name)}<small>${roles[session.user.role]}</small></div></div><button id="logout" class="secondary">Cerrar sesión</button></div></aside><main><header class="topbar"><div><span class="breadcrumb">${esc(session.company.name)} <span>/</span> Tu espacio de trabajo</span><h1 id="view-title"></h1></div><div class="top-actions"><span id="sync-label" class="muted">Guardado en el servidor</span><button id="refresh" class="secondary">Actualizar</button><button id="logout-mobile" class="secondary mobile-logout">Salir</button></div></header><div id="view"></div></main></div>`;
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view).catch(e=>notice(e.message,true))));
  const logout=async()=>{try{await api('/logout',{method:'POST',body:{}});}catch{}workspaceEpoch++;clearWorkspaceView();drafts.clear();sendKeys.clear();session=null;csrf='';contacts=[];messages=[];await loginScreen();};
  $('logout').onclick=logout;$('logout-mobile').onclick=logout;
  $('refresh').onclick=()=>refresh(true).catch(e=>notice(e.message,true));
  $('workspace').onchange=async e=>{$('root').inert=true;workspaceEpoch++;drafts.clear();sendKeys.clear();messages=[];try{await api('/companies/switch',{method:'POST',body:{companyId:e.target.value}});active=null;await startWorkspace();}catch(e){notice(e.message,true);}finally{$('root').inert=false;}};
}
async function showView(next){if(next==='connections'&&session.user.role==='agent')next='conversations';view=next;document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});$('view-title').textContent=labels[view];document.title=`lazo · ${labels[view]}`;if(view==='conversations')await inbox();else if(view==='settings')await settings();else if(view==='connections')await connectionsView();else if(view==='statistics')await statisticsView();else renderCRM();}
async function statisticsView(){const epoch=workspaceEpoch,company=session.company.id;$('view').onclick=null;$('view').onchange=null;$('view').innerHTML='<p class="empty">Cargando estadísticas…</p>';const data=await api('/statistics?days='+statsDays);if(epoch!==workspaceEpoch||session?.company.id!==company||view!=='statistics')return;renderStatistics($('view'),data,days=>{statsDays=days;statisticsView().catch(e=>notice(e.message,true));});}
function renderCRM(){
  const won=contacts.filter(c=>pipelineStages.some(p=>p.name===c.stage&&p.is_won)).length;
  $('view').innerHTML=`<div class="crm-intro"><div><span class="eyebrow">${view==='sales'?'CADA CONVERSACIÓN, UN PASO MÁS':'RELACIONES QUE CRECEN'}</span><h2>${view==='sales'?'Tu proceso comercial, a la vista':'Conoce mejor a tus clientes'}</h2><p class="muted">${esc(session.company.name)} · ${view==='sales'?'Sigue el avance de tus oportunidades.':'Una agenda conectada con tu bandeja de entrada.'}</p></div><button id="new-contact" class="send">+ Nuevo contacto</button></div><div class="metric-grid">${[[contacts.length,'Contactos'],[contacts.length-won,'Oportunidades abiertas'],[won,'Ventas ganadas']].map(([n,l])=>`<article class="metric"><strong>${n}</strong><span>${l}</span></article>`).join('')}</div>${view==='contacts'?`<section class="contact-table-panel"><div class="section-heading"><h2>Todos los contactos</h2><label class="search"><span>⌕</span><input id="contacts-search" placeholder="Buscar nombre, correo o teléfono" aria-label="Buscar contactos"></label></div><div class="table-scroll"><table><thead><tr><th>Contacto</th><th>Teléfono</th><th>Responsable</th><th>Etapa</th><th>Conversación</th></tr></thead><tbody id="contact-rows"></tbody></table></div></section>`:`<div class="pipeline">${stages.map((stage,i)=>`<section class="pipeline-column"><div class="column-heading"><h2><span class="stage-dot step-${i}"></span>${esc(stage)}</h2><span class="column-count">${contacts.filter(c=>c.stage===stage).length}</span></div><div class="pipeline-cards">${contacts.filter(c=>c.stage===stage).map(c=>`<article class="opportunity"><h3>${esc(c.name)}</h3><p class="muted">${esc(c.phone)}</p><p class="opportunity-owner">Responsable <strong>${esc(ownerName(c.owner_id))}</strong></p><label>Etapa<select data-stage="${c.id}" aria-label="Etapa de ${esc(c.name)}">${options(stages,c.stage)}</select></label><button class="open-chat" data-chat="${c.id}">Ver conversación ↗</button></article>`).join('')||'<p class="column-empty">Sin oportunidades en esta etapa.</p>'}</div></section>`).join('')}</div>`}<p class="muted">${contacts.length>=1000?'Se muestran hasta 1.000 contactos.':''}</p>`;
  $('new-contact').onclick=newContact;
  if(view==='contacts'){$('contacts-search').oninput=e=>contactRows(e.target.value);contactRows('');}
  $('view').onclick=e=>{const b=e.target.closest('[data-chat]');if(b)openChat(b.dataset.chat).catch(e=>notice(e.message,true));};
  $('view').onchange=async e=>{if(e.target.dataset.stage)try{await updateContact(e.target.dataset.stage,{stage:e.target.value});renderCRM();notice('Etapa guardada.');}catch(e){notice(e.message,true);}};
}
function contactRows(term){const found=contacts.filter(c=>`${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(term.trim().toLowerCase()));$('contact-rows').innerHTML=found.map(c=>`<tr><td><div class="contact-identity"><span class="avatar">${esc(initials(c.name))}</span><div><strong>${esc(c.name)}</strong><small>${esc(c.email||'Sin correo')}</small></div></div></td><td>${esc(c.phone)}</td><td>${esc(ownerName(c.owner_id))}</td><td><span class="table-stage">${esc(c.stage)}</span></td><td><button class="open-chat" data-chat="${c.id}" aria-label="Ver conversación de ${esc(c.name)}">Ver conversación ↗</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">No hay contactos con esa búsqueda.</td></tr>';}
function newContact(){
  const dialog=document.createElement('dialog');dialog.innerHTML=`<form><div class="section-heading"><h2>Nuevo contacto</h2><button type="button" class="icon close" aria-label="Cerrar">×</button></div><label>Nombre<input name="name" maxlength="80" required></label><label>Teléfono internacional<input name="phone" inputmode="tel" placeholder="51…" required></label><label>Correo (opcional)<input name="email" type="email" maxlength="254"></label><label>Ciudad (opcional)<input name="location" maxlength="100"></label><label>Responsable<select name="ownerId">${options(members,session.user.id)}</select></label><div class="dialog-actions"><button class="send" type="submit">Crear contacto</button></div></form>`;document.body.append(dialog);dialog.querySelector('.close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());bind(dialog.querySelector('form'),async data=>{const c=await api('/contacts',{method:'POST',body:data});contacts.unshift(c);dialog.close();await openChat(c.id);notice('Contacto guardado en tu empresa.');});dialog.showModal();
}
async function updateContact(id,data){const result=await api('/contacts/'+id,{method:'PATCH',body:data});contacts=contacts.map(c=>c.id===id?{...c,...result}:c);return result;}
async function openChat(id){active=id;await showView('conversations');document.querySelector('.app').classList.add('chat-open');}
async function inbox(){
  $('view').onclick=null;$('view').onchange=null;
  const tags=[...new Set(contacts.flatMap(contactTags).concat(inboxFilters.tag?[inboxFilters.tag]:[]))].sort((a,b)=>a.localeCompare(b,'es'));
  $('view').innerHTML=`<section class="inbox"><aside class="list-panel"><div class="list-title"><h2>Bandeja <span id="count"></span></h2><button class="icon" id="new-chat" aria-label="Nuevo contacto">+</button></div><label class="search"><span>⌕</span><input id="search" placeholder="Nombre, teléfono o mensaje" aria-label="Buscar una conversación"></label><div class="inbox-filters"><label>Estado<select id="filter-status"><option value="all">Todas</option><option value="pending">Pendientes</option><option value="resolved">Resueltas</option><option value="unread">Sin leer</option></select></label><label>Responsable<select id="filter-owner"><option value="">Todo el equipo</option><option value="mine">Asignadas a mí</option><option value="unassigned">Sin asignar</option>${members.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></label><label>Etiqueta<select id="filter-tag"><option value="">Todas las etiquetas</option>${tags.map(tag=>`<option value="${esc(tag)}">${esc(tag)}</option>`).join('')}</select></label><button id="clear-filters" type="button" class="filter-clear">Limpiar filtros</button></div><div id="conversations" class="conversations"></div></aside><section class="chat-panel" id="chat-panel"></section><aside class="details" id="details"></aside></section>`;
  $('new-chat').onclick=newContact;$('search').oninput=renderList;
  for(const [id,key] of [['filter-status','status'],['filter-owner','owner'],['filter-tag','tag']]){$(id).value=inboxFilters[key];$(id).onchange=e=>{inboxFilters[key]=e.target.value;renderList();};}
  $('clear-filters').onclick=()=>{inboxFilters={status:'all',owner:'',tag:''};$('search').value='';for(const id of ['filter-status','filter-owner','filter-tag'])$(id).value=id==='filter-status'?'all':'';renderList();};
  renderList();await renderChat();
}
function renderList(){
  if(!$('conversations'))return;
  const term=$('search')?.value?.toLowerCase()||'';
  const found=contacts.filter(c=>{
    const match=(c.name+' '+c.phone+' '+(c.last_message||'')+' '+contactTags(c).join(' ')).toLowerCase().includes(term);
    const status=inboxFilters.status;
    const owner=inboxFilters.owner;
    return match&&(status==='all'||status==='pending'&&!c.resolved||status==='resolved'&&c.resolved||status==='unread'&&c.unread>0)&&
      (!owner||owner==='mine'&&c.owner_id===session.user.id||owner==='unassigned'&&!c.owner_id||c.owner_id===owner)&&
      (!inboxFilters.tag||contactTags(c).includes(inboxFilters.tag));
  });
  $('count').textContent=found.length;
  $('conversations').innerHTML=found.map(c=>`<button class="conversation ${active===c.id?'selected':''}" data-id="${c.id}" aria-label="Conversación de ${esc(c.name)}"><span class="avatar">${esc(initials(c.name))}</span><span class="summary"><strong>${esc(c.name)}</strong><p>${esc(c.last_message||'Sin mensajes')}</p><small>${c.resolved?'Resuelta':esc(c.stage)} · ${esc(ownerName(c.owner_id))}</small><span class="contact-tags">${contactTags(c).slice(0,3).map(tag=>`<span>${esc(tag)}</span>`).join('')}</span></span>${c.unread?`<span class="unread-badge">${c.unread}</span>`:''}</button>`).join('')||'<p class="empty">No hay conversaciones con estos filtros.</p>';
  $('conversations').onclick=e=>{const b=e.target.closest('[data-id]');if(b){if(active)drafts.set(active,$('message')?.value||'');active=b.dataset.id;renderList();renderChat().then(()=>document.querySelector('.app').classList.add('chat-open')).catch(e=>notice(e.message,true));}};
}
async function renderChat(){
  const generation=++chatGeneration;
  const c=contacts.find(c=>c.id===active);
  if(!c){$('chat-panel').innerHTML='<div class="empty"><h2>Comienza una conversación</h2><p>Elige un contacto de tu bandeja.</p></div>';$('details').innerHTML='';return;}
  const company=session.company.id,epoch=workspaceEpoch;
  const sceneCurrent=()=>view==='conversations'&&active===c.id&&session?.company.id===company&&workspaceEpoch===epoch;
  const current=()=>sceneCurrent()&&generation===chatGeneration;
  const sendingKey=epoch+':'+c.id;
  $('chat-panel').innerHTML='<p class="empty">Cargando conversación…</p>';$('details').innerHTML='';
  const [loaded,pipeline]=await Promise.all([api('/contacts/'+c.id+'/messages'),api('/pipeline')]);if(!current())return;
  setPipeline(pipeline.stages);
  await api('/contacts/'+c.id+'/read',{method:'POST',body:{}});if(!current())return;
  messages=loaded.messages;c.unread=0;renderList();
  $('chat-panel').innerHTML=`<header class="chat-header"><button id="back" class="icon mobile-only" aria-label="Volver a conversaciones">←</button><span class="avatar">${esc(initials(c.name))}</span><div class="chat-person"><h2>${esc(c.name)}</h2><span>WhatsApp · ${esc(c.phone)}</span></div><button id="show-details" class="icon" aria-label="Mostrar ficha del cliente">☷</button></header><div class="chat-toolbar"><span class="channel">WhatsApp</span><span class="stage" id="chat-stage">${esc(c.stage)}</span><button id="resolve" class="secondary">${c.resolved?'Reabrir':'Resolver'}</button></div><div class="messages" id="messages" role="log" aria-label="Mensajes"></div><div class="composer-area"><form id="send-form"><div class="send-options"><label>Tipo<select name="type" id="send-type"><option value="text">Texto o archivo</option><option value="template">Plantilla aprobada</option></select></label><label id="template-label" hidden>Plantilla<select id="template" name="template"></select></label><button type="button" id="quick-reply" class="secondary">Respuestas rápidas</button></div><div id="parameters"></div><label class="sr-only" for="message">Escribe tu respuesta</label><textarea id="message" name="text" maxlength="4000" rows="2" placeholder="Escribe tu respuesta…"></textarea><div id="file-composer"><input id="attachment-file" type="file" accept="image/jpeg,image/png,application/pdf" hidden><div class="attachment-controls"><button type="button" id="attach-file" class="secondary">Adjuntar imagen o PDF</button><span class="muted">JPG/PNG: 5 MB · PDF: 10 MB</span></div><div id="selected-file" class="selected-file" hidden><span></span><button type="button" class="icon" aria-label="Quitar archivo">×</button></div></div><div class="composer-bottom"><span>Texto y archivos: hasta 24 h desde el último mensaje del contacto.</span><button class="send" type="submit">Enviar</button></div></form><p class="status">Últimos 100 mensajes · Los estados provienen de Meta.</p></div>`;
  $('details').innerHTML=`<div class="details-heading"><h2>Información del cliente</h2></div><div class="profile"><span class="avatar">${esc(initials(c.name))}</span><h3>${esc(c.name)}</h3><span class="profile-label">${esc(c.phone)}</span></div><section class="detail-section"><h3>Datos del contacto</h3><p>${esc(c.email||'Sin correo')}</p><p>${esc(c.location||'Sin ubicación')}</p></section><form id="details-form"><label>Etapa del embudo<select name="stage" aria-label="Etapa del embudo">${options(stages,c.stage)}</select></label><label>Responsable<select name="ownerId"><option value="" ${!c.owner_id?'selected':''}>Sin asignar</option>${options(members,c.owner_id)}</select></label><label>Etiquetas<input name="tags" maxlength="247" placeholder="Interesado, Mayorista" value="${esc(contactTags(c).join(', '))}"><small>Hasta 8 etiquetas, separadas por comas.</small></label><label>Nota interna<textarea name="note" maxlength="4000" rows="4">${esc(c.note)}</textarea></label><button class="secondary" type="submit">Guardar cambios</button></form>`;
  $('message').value=drafts.get(c.id)||'';$('message').oninput=e=>drafts.set(c.id,e.target.value);
  function showFile(){const selected=fileDrafts.get(c.id);$('selected-file').hidden=!selected;$('selected-file').querySelector('span').textContent=selected?selected.file.name+' · '+(selected.file.size/1024/1024).toFixed(2)+' MB':'';$('message').maxLength=selected?1024:4000;}
  $('attach-file').onclick=()=>$('attachment-file').click();
  $('attachment-file').onchange=e=>{const file=e.target.files[0];if(!file)return;const max=file.type==='application/pdf'?10:5;if(!['image/jpeg','image/png','application/pdf'].includes(file.type)||file.size>max*1024*1024){notice('Elige JPG/PNG de hasta 5 MB o PDF de hasta 10 MB.',true);e.target.value='';return;}fileDrafts.set(c.id,{file,key:crypto.randomUUID()});showFile();};
  $('selected-file').querySelector('button').onclick=()=>{fileDrafts.delete(c.id);$('attachment-file').value='';showFile();};showFile();
  $('back').onclick=()=>document.querySelector('.app').classList.remove('chat-open');$('show-details').onclick=()=>document.querySelector('.inbox').classList.toggle('show-details');
  $('resolve').onclick=async()=>{try{const latest=contacts.find(p=>p.id===c.id);await updateContact(c.id,{resolved:!latest.resolved});if(current())await renderChat();}catch(e){notice(e.message,true);}};
  bind($('details-form'),async data=>{if(!current())return;const tags=data.tags.split(',').map(t=>t.trim()).filter(Boolean);await updateContact(c.id,{...data,tags});if(!current())return;$('chat-stage').textContent=data.stage;renderList();const select=$('filter-tag');for(const tag of tags)if(![...select.options].some(o=>o.value===tag))select.add(new Option(tag,tag));notice('Ficha guardada en el servidor.');});
  $('quick-reply').onclick=async()=>{try{const data=await api('/quick-replies');if(!current())return;quickReplies=data.replies;replyPicker(quickReplies,body=>{if(!current())return;const box=$('message');if(box.value.length+body.length>box.maxLength){notice('El mensaje supera el tamaño permitido. Acorta tu borrador antes de insertar esta respuesta.',true);return;}box.setRangeText(body,box.selectionStart,box.selectionEnd,'end');drafts.set(c.id,box.value);box.focus();});}catch(e){notice(e.message,true);}};
  function syncComposer(){if(!sceneCurrent()||!$('send-form'))return;const busy=sendsInFlight.has(sendingKey);$('send-form').inert=busy;const button=$('send-form').querySelector('[type="submit"]');button.disabled=busy;button.textContent=busy?'Enviando…':'Enviar';}
  syncComposer();renderMessages(true);
  $('send-type').onchange=async()=>{const isTemplate=$('send-type').value==='template';$('template-label').hidden=!isTemplate;$('message').hidden=isTemplate;$('file-composer').hidden=isTemplate;$('quick-reply').hidden=isTemplate;$('parameters').innerHTML='';if(isTemplate){try{const data=await api('/templates');if(!current())return;templates=data.templates;$('template').innerHTML=templates.map((t,i)=>`<option value="${i}">${esc(t.name)} · ${esc(t.language)}</option>`).join('');templateFields();}catch(e){notice(e.message,true);}}};
  $('template').onchange=templateFields;
  bind($('send-form'),async(data,form)=>{
    if(!current())return;
    if(sendsInFlight.has(sendingKey))throw new Error('Este contacto ya tiene un envío en proceso. Espera su resultado.');
    let payload={type:data.type,text:data.text},file=data.type==='text'?fileDrafts.get(c.id):null;
    if(data.type==='template'){const t=templates[Number(data.template)];if(!t)throw new Error('Elige una plantilla aprobada.');payload={type:'template',templateName:t.name,language:t.language,parameters:[...$('parameters').querySelectorAll('input')].map(i=>i.value)};}
    if(file){if((data.text||'').length>1024)throw new Error('El texto de un archivo puede tener hasta 1024 caracteres.');payload={type:'file',text:data.text,fileKey:file.key};}
    const key=JSON.stringify(payload);let attempt=sendKeys.get(c.id);if(!attempt||attempt.key!==key){attempt={key,id:crypto.randomUUID()};sendKeys.set(c.id,attempt);}
    sendsInFlight.set(sendingKey,attempt.id);syncComposer();
    try{
      let result;
      if(file){const upload=new FormData();upload.set('file',file.file);upload.set('caption',data.text||'');upload.set('clientId',attempt.id);result=await api('/contacts/'+c.id+'/attachments',{method:'POST',body:upload});}
      else result=await api('/contacts/'+c.id+'/messages',{method:'POST',body:{...payload,clientId:attempt.id}});
      if(sceneCurrent())notice(statusNames[result.status]||result.status);
      const ownsAttempt=sendKeys.get(c.id)?.id===attempt.id;
      if(ownsAttempt&&['accepted','sent','delivered','read'].includes(result.status)){
        sendKeys.delete(c.id);
        const unchanged=(drafts.get(c.id)||'')===(data.text||'')&&(fileDrafts.get(c.id)?.key||null)===(file?.key||null);
        if(data.type!=='template'&&unchanged){drafts.delete(c.id);fileDrafts.delete(c.id);if(sceneCurrent()&&$('send-form')&&$('message')&&$('attachment-file')&&$('selected-file')){$('message').value='';$('attachment-file').value='';showFile();}}
      } else if(ownsAttempt&&result.status==='failed')sendKeys.delete(c.id);
    }finally{
      if(sendsInFlight.get(sendingKey)===attempt.id)sendsInFlight.delete(sendingKey);
      form.inert=false;syncComposer();
      if(sceneCurrent()){const data=await api('/contacts/'+c.id+'/messages');if(sceneCurrent()){messages=data.messages;const latest=messages.find(m=>m.client_id===attempt.id);if(latest?.status==='failed'&&sendKeys.get(c.id)?.id===attempt.id)sendKeys.delete(c.id);renderMessages(true);}}
    }
  });
}
function templateFields(){const t=templates[Number($('template').value)];$('parameters').innerHTML=t?`<p class="muted">${esc(t.body)}</p>${Array.from({length:t.parameters},(_,i)=>`<label>Valor ${i+1}<input maxlength="500" required></label>`).join('')}`:'<p class="muted">No hay plantillas aprobadas compatibles.</p>';}
function renderMessages(scroll=false){
  if(!$('messages'))return;
  const box=$('messages'),atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<70;
  box.innerHTML=messages.map(m=>{
    const attachment=m.attachment;
    return `<article class="message ${m.direction==='out'?'out':''}"><div class="bubble">${attachment?`<div class="message-file" data-file-id="${m.id}"><strong>${esc(attachment.filename)}</strong><small>${attachment.state==='ready'?(attachment.size/1024).toFixed(0)+' KB':'Archivo pendiente de descarga'}</small>${attachment.mime.startsWith('image/')?`<div class="image-preview">${mediaUrls.has(m.id)?`<img src="${mediaUrls.get(m.id)}" alt="Imagen de la conversación">`:`<button class="secondary" type="button" data-preview="${m.id}">Ver imagen</button>`}</div>`:''}<button class="secondary" type="button" data-download="${m.id}">${attachment.mime==='application/pdf'?'Descargar PDF':'Descargar imagen'}</button></div>`:''}<span>${esc(m.body)}</span></div><time>${fmt(m.created)} · ${esc(statusNames[m.status]||m.status)}</time></article>`;
  }).join('')||'<div class="empty">Aún no hay mensajes. Puedes iniciar con una plantilla aprobada.</div>';
  box.onclick=async e=>{
    const button=e.target.closest('[data-preview],[data-download]');if(!button)return;
    const id=button.dataset.preview||button.dataset.download,m=messages.find(v=>v.id===id);if(!m?.attachment)return;
    const epoch=workspaceEpoch,company=session.company.id,chat=active;button.disabled=true;
    try{
      let url=mediaUrls.get(id);
      if(!url){const blob=await api('/messages/'+id+'/attachment',{binary:true});if(epoch!==workspaceEpoch||session?.company.id!==company)return;url=URL.createObjectURL(blob);mediaUrls.set(id,url);if(mediaUrls.size>30){const first=mediaUrls.keys().next().value;URL.revokeObjectURL(mediaUrls.get(first));mediaUrls.delete(first);}}
      if(view!=='conversations'||active!==chat)return;
      if(button.dataset.preview){const img=document.createElement('img');img.src=url;img.alt='Imagen de la conversación';button.parentElement.replaceChildren(img);}
      else {const link=document.createElement('a');link.href=url;link.download=m.attachment.filename;document.body.append(link);link.click();link.remove();}
    }catch(error){notice(error.message,true);}finally{if(button.isConnected)button.disabled=false;}
  };
  if(scroll||atBottom)box.scrollTop=box.scrollHeight;
}
let connectionGeneration=0;
async function connectionsView(){
  const generation=++connectionGeneration,epoch=workspaceEpoch,company=session.company.id;
  const current=()=>generation===connectionGeneration&&epoch===workspaceEpoch&&session?.company.id===company&&view==='connections';
  $('view').onclick=null;$('view').onchange=null;$('view').innerHTML='<p class="empty">Cargando conexiones…</p>';
  const connection=await api('/whatsapp');if(!current())return;
  const scopedApi=(path,options)=>{if(!current())throw new Error('El espacio cambió. Vuelve a abrir Conexiones.');return api(path,options);};
  mountConnections($('view'),{connection,api:scopedApi,notice,isCurrent:current,onSaved:connectionsView,canCreate:session.user.role==='owner',
    onCreateCompany:async name=>{
      const created=await scopedApi('/companies',{method:'POST',body:{name}});if(!current())return;
      await scopedApi('/companies/switch',{method:'POST',body:{companyId:created.id}});
      if(!current())return;active=null;await startWorkspace();notice('Espacio creado. Conecta aquí la otra API; la conexión anterior se conserva en su empresa.');
    }});
}
async function settings(){
  $('view').onclick=null;$('view').onchange=null;
  const canAdmin=session.user.role!=='agent';
  const company=session.company.id;
  if(view!=='settings'||session?.company.id!==company)return;
  $('view').innerHTML=`<div class="crm-intro"><div><span class="eyebrow">TU EMPRESA</span><h2>Un espacio organizado para tu equipo</h2><p class="muted">${esc(session.company.name)}</p></div></div><div class="settings-grid"><section class="settings-card"><h2>Equipo</h2><div class="member-list">${members.map(m=>`<div class="team-row"><span class="avatar">${esc(initials(m.name))}</span><div><strong>${esc(m.name)}</strong><small>${esc(m.email)} · ${roles[m.role]}</small></div>${canAdmin&&m.role!=='owner'&&m.id!==session.user.id?`<button class="secondary" data-remove="${m.id}">Retirar acceso</button>`:''}</div>`).join('')}</div>${canAdmin?`<form id="invite-form"><h3>Invitar a un colaborador</h3><label>Correo<input name="email" type="email" required></label><label>Rol<select name="role"><option value="agent">Asesor</option>${session.user.role==='owner'?'<option value="admin">Administrador</option>':''}</select></label><label class="invite-email"><input type="checkbox" name="sendEmail" value="true" ${session.emailEnabled?'checked':'disabled'}> Enviar también por correo</label><p class="muted">${session.emailEnabled?'La invitación se enviará al correo indicado.':'El correo todavía no está configurado. Puedes compartir el enlace privado.'}</p><button class="send" type="submit">Crear invitación</button><p class="muted">Recibirás un enlace privado de un solo uso, válido durante 48 horas. Compártelo con tu colaborador.</p><textarea id="invite-link" readonly hidden aria-label="Enlace privado de invitación"></textarea></form>`:''}</section>
  ${canAdmin?`<section class="settings-card"><h2>WhatsApp Business</h2><p class="muted">Configura tu API y consulta el estado de recepción en Conexiones.</p><button class="secondary" id="open-connections">Abrir Conexiones de WhatsApp</button></section>`:''}
  ${session.user.role==='owner'?`<section class="settings-card"><h2>Otra empresa</h2><p class="muted">Cada empresa tiene su propia agenda, usuarios y conexión.</p><form id="company-form"><label>Nombre de la empresa<input name="name" maxlength="100" required></label><button class="send" type="submit">Crear empresa</button></form></section>`:''}</div>`;
  if(canAdmin){
    const tools=document.createElement('div');tools.className='settings-tools';$('view').append(tools);
    const toolEpoch=workspaceEpoch;
    const scopedApi=(path,options)=>{if(session?.company.id!==company||toolEpoch!==workspaceEpoch)throw new Error('La empresa cambió. Vuelve a abrir Ajustes.');return api(path,options);};
    mountManagement(tools,{api:scopedApi,notice,getStages:()=>pipelineStages,getReplies:()=>quickReplies,
      onStages:async list=>{if(session?.company.id!==company||toolEpoch!==workspaceEpoch)return;setPipeline(list);const data=await scopedApi('/contacts');if(session?.company.id===company&&toolEpoch===workspaceEpoch)contacts=data.contacts;},
      onReplies:list=>{if(session?.company.id===company&&toolEpoch===workspaceEpoch)quickReplies=list;}});
    bind($('invite-form'),async data=>{
      const epoch=workspaceEpoch,company=session.company.id;
      const current=()=>epoch===workspaceEpoch&&session?.company.id===company&&view==='settings'&&$('invite-link');
      const result=await api('/invitations',{method:'POST',body:{...data,sendEmail:data.sendEmail==='true'}});
      if(!current())return;
      $('invite-link').value=result.url;$('invite-link').hidden=false;
      notice(result.emailQueued?'Invitación en cola de correo. También puedes compartir el enlace privado.':'Invitación creada. Comparte el enlace de forma privada.');
      if(result.emailJobId)for(let attempt=0;attempt<12;attempt++) {
        await new Promise(resolve=>setTimeout(resolve,1500));if(!current())return;
        const job=await api('/invitations/email/'+result.emailJobId);if(!current())return;
        if(['queued','sending'].includes(job.state))continue;
        if(job.state==='accepted')notice('Zoho aceptó el correo. El colaborador debe comprobar su bandeja.');
        else notice('No se pudo confirmar el correo. Puedes compartir el enlace privado.',true);
        return;
      }
      if(result.emailJobId&&current())notice('El correo sigue en proceso. Puedes compartir el enlace privado.');
    });
    $('open-connections').onclick=()=>showView('connections').catch(e=>notice(e.message,true));
    document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{try{await api('/members/'+b.dataset.remove,{method:'DELETE',body:{}});members=(await api('/members')).members;await settings();notice('Acceso retirado.');}catch(e){notice(e.message,true);}});
  }
  if($('company-form'))bind($('company-form'),async data=>{const c=await api('/companies',{method:'POST',body:data});await api('/companies/switch',{method:'POST',body:{companyId:c.id}});active=null;await startWorkspace();notice('Empresa creada.');});
}
async function refresh(manual=false){
  if(!session||polling)return;
  polling=true;const epoch=workspaceEpoch,company=session.company.id,chat=active;
  try{
    const loaded=(await api('/contacts')).contacts;
    if(epoch!==workspaceEpoch||session?.company.id!==company)return;
    contacts=loaded;
    if(view==='conversations'){
      renderList();if(chat){const data=(await api(`/contacts/${chat}/messages`)).messages;
        if(epoch!==workspaceEpoch||view!=='conversations'||active!==chat||session?.company.id!==company)return;
        if($('send-form')&&JSON.stringify(messages)!==JSON.stringify(data)){messages=data;renderMessages();}
      }
    }else if(manual)await showView(view);
    if($('sync-label'))$('sync-label').textContent='Actualizado '+new Intl.DateTimeFormat('es-PE',{hour:'2-digit',minute:'2-digit'}).format(new Date());
  }catch(e){if(e.status===401&&epoch===workspaceEpoch){session=null;csrf='';await loginScreen();}else if(manual)throw e;}finally{polling=false;}
}
setInterval(()=>{if(!document.hidden)refresh().catch(()=>{});},5000);
if(resetToken)loadSession().catch(()=>{session=null;csrf='';}).then(()=>passwordScreen('reset'));
else startWorkspace().catch(e=>{if(e.status!==401)notice(e.message,true);loginScreen().catch(e=>notice(e.message,true));});
