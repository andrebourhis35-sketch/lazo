// All three views use the same local demo records from app.js.
let currentView = 'conversations';
const viewNames = { conversations: 'Conversaciones', contacts: 'Contactos', sales: 'Ventas' };
const inbox = document.querySelector('.inbox');
const crmView = document.createElement('section');
crmView.id = 'crm-view';
crmView.hidden = true;
document.querySelector('main').append(crmView);

const contactDialog = document.createElement('dialog');
contactDialog.id = 'contact-dialog';
contactDialog.setAttribute('aria-labelledby', 'new-contact-title');
contactDialog.innerHTML = `
  <form id="new-contact-form">
    <div class="section-heading"><div><span class="eyebrow">TU AGENDA COMERCIAL</span><h2 id="new-contact-title">Nuevo contacto de prueba</h2></div><button type="button" id="close-contact" class="icon" aria-label="Cerrar">×</button></div>
    <p class="muted">Usa datos ficticios. Solo se guardarán en este navegador.</p>
    <label>Nombre<input name="name" maxlength="80" required autocomplete="off"></label>
    <label>Correo electrónico <span class="muted">(opcional)</span><input name="email" type="email" maxlength="160" placeholder="nombre@example.com" autocomplete="off"></label>
    <label>Ciudad <span class="muted">(opcional)</span><input name="location" maxlength="100" autocomplete="off"></label>
    <label>Responsable<select name="owner"><option>Andrea Castro</option><option>Miguel López</option></select></label>
    <p id="contact-error" role="alert"></p>
    <div class="dialog-actions"><button type="button" id="cancel-contact" class="secondary">Cancelar</button><button class="send" type="submit">Crear contacto</button></div>
  </form>`;
document.body.append(contactDialog);

function stageOptions(selected) {
  return LazoDemoModel.stages.map(s => `<option${s === selected ? ' selected' : ''}>${s}</option>`).join('');
}

function showView(view) {
  currentView = Object.hasOwn(viewNames, view) ? view : 'conversations';
  document.querySelector('.app').classList.remove('chat-open');
  document.querySelectorAll('[data-view]').forEach(b => {
    const selected = b.dataset.view === currentView;
    b.classList.toggle('active', selected);
    if (selected) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  document.querySelector('h1').innerHTML = `${viewNames[currentView]}<span class="badge">Demo</span>`;
  document.querySelector('.breadcrumb').innerHTML = `Espacio de trabajo <span>/</span> ${viewNames[currentView]}`;
  document.title = `lazo · ${viewNames[currentView]}`;
  inbox.hidden = currentView !== 'conversations';
  crmView.hidden = currentView === 'conversations';
  if (currentView === 'conversations') render(); else renderCRM();
}

function renderCRM() {
  const won = chats.filter(c => c.stage === 'Venta ganada').length;
  const pending = chats.filter(c => c.stage === 'Propuesta enviada').length;
  const cards = currentView === 'contacts'
    ? [[chats.length, 'Contactos en tu agenda'], [chats.filter(c => c.owner === 'Andrea Castro').length, 'Asignados a ti'], [won, 'Con venta ganada']]
    : [[chats.length - won, 'Oportunidades abiertas'], [pending, 'Propuestas enviadas'], [won, 'Ventas ganadas']];
  crmView.innerHTML = `
    <div class="crm-intro"><div><span class="eyebrow">${currentView === 'contacts' ? 'RELACIONES QUE CRECEN' : 'CADA CONVERSACIÓN, UN PASO MÁS'}</span><h2>${currentView === 'contacts' ? 'Conoce mejor a tus clientes' : 'Tu proceso comercial, a la vista'}</h2><p class="muted">${currentView === 'contacts' ? 'Una agenda conectada con tus conversaciones y oportunidades.' : 'Organiza las oportunidades por etapa y sigue su avance.'}</p></div><button class="send" id="add-contact">+ Nuevo contacto</button></div>
    <div class="metric-grid">${cards.map(([n, label]) => `<article class="metric"><strong>${n}</strong><span>${label}</span></article>`).join('')}</div>
    <div class="demo-notice">Demostración · Datos ficticios guardados en este navegador. No hay conexión con WhatsApp.</div>
    ${currentView === 'contacts' ? `
    <section class="contact-table-panel"><div class="section-heading"><h2>Todos los contactos</h2><label class="search"><span>⌕</span><input id="contact-search" placeholder="Buscar nombre, correo o ciudad" aria-label="Buscar contactos"></label></div><div class="table-scroll"><table><thead><tr><th>Contacto</th><th>Ubicación</th><th>Responsable</th><th>Etapa comercial</th><th><span class="sr-only">Acción</span></th></tr></thead><tbody id="contact-rows"></tbody></table></div><p id="contact-empty" class="empty" hidden>No encontramos contactos con esa búsqueda.</p></section>`
    : `<div class="pipeline">${LazoDemoModel.byStage(chats).map(({stage, contacts}, index) => `
      <section class="pipeline-column"><div class="column-heading"><h2><span class="stage-dot step-${index}"></span>${stage}</h2><span class="column-count">${contacts.length}</span></div><div class="pipeline-cards">${contacts.map(c => `
        <article class="opportunity"><div class="contact-identity"><span class="avatar">${esc(c.initials)}</span><div><h3>${esc(c.name)}</h3><span class="muted">${esc(c.location || 'Sin ubicación')}</span></div></div><p class="opportunity-owner">Responsable <strong>${esc(c.owner)}</strong></p><label for="op-stage-${c.id}">Etapa<select id="op-stage-${c.id}" data-stage-id="${c.id}">${stageOptions(c.stage)}</select></label><button class="open-chat" data-chat-id="${c.id}">Ver conversación ↗</button></article>`).join('') || '<p class="column-empty">Las oportunidades de esta etapa aparecerán aquí.</p>'}</div></section>`).join('')}</div>`}
    <p id="crm-status" class="status" role="status"></p>`;
  $('add-contact').addEventListener('click', () => {
    $('new-contact-form').reset();
    $('contact-error').textContent = '';
    contactDialog.showModal();
  });
  if (currentView === 'contacts') {
    renderContactRows('');
    $('contact-search').addEventListener('input', e => renderContactRows(e.target.value));
  }
}

function renderContactRows(query) {
  const term = query.trim().toLocaleLowerCase();
  const filtered = chats.filter(c => `${c.name} ${c.email} ${c.location}`.toLocaleLowerCase().includes(term));
  $('contact-rows').innerHTML = filtered.map(c => `<tr>
    <td><div class="contact-identity"><span class="avatar">${esc(c.initials)}</span><div><strong>${esc(c.name)}</strong><small>${esc(c.email || 'Sin correo')}</small></div></div></td>
    <td>${esc(c.location || 'Sin ubicación')}</td><td>${esc(c.owner)}</td>
    <td><span class="table-stage">${esc(c.stage)}</span></td>
    <td><button class="open-chat" data-chat-id="${c.id}" aria-label="Ver conversación de ${esc(c.name)}">Ver conversación ↗</button></td></tr>`).join('');
  $('contact-empty').hidden = filtered.length > 0;
}

document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
crmView.addEventListener('click', e => {
  const button = e.target.closest('[data-chat-id]');
  if (!button) return;
  drafts[active] = $('message').value;
  active = Number(button.dataset.chatId);
  current().unread = 0;
  persist();
  showView('conversations');
  document.querySelector('.app').classList.add('chat-open');
  $('message').focus();
});
crmView.addEventListener('change', e => {
  const select = e.target.closest('[data-stage-id]');
  if (!select || !LazoDemoModel.stages.includes(select.value)) return;
  const contact = chats.find(c => c.id === Number(select.dataset.stageId));
  contact.stage = select.value;
  const saved = persist();
  renderCRM();
  $(`op-stage-${contact.id}`).focus();
  $('crm-status').textContent = saved ? `Etapa de ${contact.name} actualizada en la demo.` : 'Almacenamiento no disponible. El cambio queda en esta sesión.';
});
$('close-contact').addEventListener('click', () => contactDialog.close());
$('cancel-contact').addEventListener('click', () => contactDialog.close());
$('new-contact-form').addEventListener('submit', e => {
  e.preventDefault();
  try {
    const contact = LazoDemoModel.newContact(Object.fromEntries(new FormData(e.target)), chats);
    chats.push(contact);
    const saved = persist();
    contactDialog.close();
    list();
    renderCRM();
    $('crm-status').textContent = saved ? `${contact.name} añadido a la demostración.` : 'Contacto añadido a esta sesión. No se pudo guardar en el navegador.';
  } catch (error) { $('contact-error').textContent = error.message; }
});
$('reset').addEventListener('click', () => { if (currentView !== 'conversations') renderCRM(); });
showView('conversations');
