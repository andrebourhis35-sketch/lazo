const $ = (id) => document.getElementById(id);

async function api(method, path, body) {
  const response = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    // Respuesta sin JSON.
  }
  if (!response.ok) {
    const detail = [data.metaCode && `código ${data.metaCode}`, data.fbtraceId && `fbtrace_id ${data.fbtraceId}`]
      .filter(Boolean).join(' · ');
    throw new Error((data.error || `Error ${response.status}`) + (detail ? ` (${detail})` : ''));
  }
  return data;
}

function log(kind, message, code) {
  const item = document.createElement('li');
  item.className = kind;
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString('es-PE', { hour12: false });
  item.append(time, message);
  if (code) {
    const c = document.createElement('code');
    c.textContent = ` ${code}`;
    item.append(c);
  }
  $('log').prepend(item);
}

async function withBusy(button, task) {
  button.disabled = true;
  try {
    await task();
  } catch (err) {
    log('error', err.message);
  } finally {
    button.disabled = false;
  }
}

async function loadStatus() {
  const box = $('connection');
  try {
    const s = await api('GET', '/api/status');
    if (s.ready) {
      box.className = 'connection ok';
      box.textContent = `Graph API ${s.graphVersion} · WABA ${s.wabaId} · Número ${s.phoneNumberId}`;
      $('config-errors').hidden = true;
      return true;
    }
    box.className = 'connection error';
    box.textContent = 'Configuración incompleta';
    const alert = $('config-errors');
    alert.replaceChildren('Completa app-meta/.env y reinicia el servidor:');
    const list = document.createElement('ul');
    for (const e of s.errors) {
      const li = document.createElement('li');
      li.textContent = e;
      list.append(li);
    }
    alert.append(list);
    alert.hidden = false;
  } catch (err) {
    box.className = 'connection error';
    box.textContent = 'Servidor no disponible';
  }
  return false;
}

function renderTemplates(templates) {
  const body = $('templates');
  body.replaceChildren();
  if (!templates.length) {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 4;
    cell.className = 'muted';
    cell.textContent = 'La cuenta no tiene plantillas.';
  }
  for (const t of templates) {
    const row = body.insertRow();
    row.insertCell().textContent = t.name;
    row.insertCell().textContent = t.language;
    row.insertCell().textContent = t.category;
    const status = row.insertCell();
    const badge = document.createElement('span');
    badge.className = `badge ${/^[A-Z_]+$/.test(t.status) ? t.status : ''}`;
    badge.textContent = t.status;
    status.append(badge);
    if (t.rejectedReason) {
      const reason = document.createElement('span');
      reason.className = 'reason';
      reason.textContent = `Motivo: ${t.rejectedReason}`;
      status.append(reason);
    }
  }

  // Plantillas aprobadas disponibles para enviar; hello_world siempre como opción.
  const select = $('send-template');
  const previous = select.value;
  const options = new Map([['hello_world|en_US', 'hello_world · en_US']]);
  for (const t of templates) {
    if (t.status === 'APPROVED') options.set(`${t.name}|${t.language}`, `${t.name} · ${t.language}`);
  }
  select.replaceChildren(...[...options].map(([value, label]) => new Option(label, value)));
  if (options.has(previous)) select.value = previous;
}

async function loadTemplates() {
  const { templates } = await api('GET', '/api/templates');
  renderTemplates(templates);
  log('ok', `Plantillas actualizadas: ${templates.length}.`);
}

document.querySelectorAll('input[name="type"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    const isText = document.querySelector('input[name="type"]:checked').value === 'text';
    $('text-fields').hidden = !isText;
    $('template-fields').hidden = isText;
  });
});

$('send-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const button = event.submitter;
  withBusy(button, async () => {
    const type = document.querySelector('input[name="type"]:checked').value;
    const payload = { to: $('to').value, type };
    if (type === 'text') {
      payload.text = $('text').value;
    } else {
      const [templateName, language] = $('send-template').value.split('|');
      Object.assign(payload, { templateName, language });
    }
    const result = await api('POST', '/api/messages', payload);
    log('ok', `Mensaje aceptado por WhatsApp para ${result.to}. ID:`, result.messageId);
  });
});

$('create-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const button = event.submitter;
  withBusy(button, async () => {
    const payload = {
      name: $('tpl-name').value,
      language: $('tpl-language').value,
      category: $('tpl-category').value,
      bodyText: $('tpl-body').value,
      examples: $('tpl-examples').value.split('\n'),
      footer: $('tpl-footer').value,
    };
    const result = await api('POST', '/api/templates', payload);
    log('ok', `Plantilla "${payload.name}" enviada a Meta. Estado: ${result.status ?? 'sin estado'}. ID:`, result.id);
    await loadTemplates();
  });
});

$('refresh').addEventListener('click', (event) => withBusy(event.currentTarget, loadTemplates));

loadStatus().then((ready) => {
  if (ready) withBusy($('refresh'), loadTemplates);
});
