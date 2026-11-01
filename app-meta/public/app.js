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

  // Plantillas que la app puede enviar; hello_world (sin variables) siempre como opción.
  const select = $('send-template');
  const previous = select.value;
  const options = new Map([['hello_world|en_US', { label: 'hello_world · en_US', variables: 0 }]]);
  for (const t of templates) {
    if (t.sendable) {
      const vars = t.bodyVariables ? ` · ${t.bodyVariables} variable(s)` : '';
      options.set(`${t.name}|${t.language}`, { label: `${t.name} · ${t.language}${vars}`, variables: t.bodyVariables });
    }
  }
  templateVariables = new Map([...options].map(([value, o]) => [value, o.variables]));
  select.replaceChildren(...[...options].map(([value, o]) => new Option(o.label, value)));
  if (options.has(previous)) select.value = previous;
  renderTemplateParams();
}

// Número de variables del cuerpo de cada plantilla enviable, por "nombre|idioma".
let templateVariables = new Map([['hello_world|en_US', 0]]);

function renderTemplateParams() {
  const box = $('template-params');
  const count = templateVariables.get($('send-template').value) ?? 0;
  const values = [...box.querySelectorAll('input')].map((i) => i.value);
  box.replaceChildren();
  for (let n = 1; n <= count; n++) {
    const label = document.createElement('label');
    label.htmlFor = `param-${n}`;
    label.textContent = `Valor de {{${n}}}`;
    const input = document.createElement('input');
    input.id = `param-${n}`;
    input.required = true;
    input.maxLength = 1024;
    input.autocomplete = 'off';
    input.value = values[n - 1] ?? '';
    box.append(label, input);
  }
}

async function loadTemplates() {
  const { templates, truncated } = await api('GET', '/api/templates');
  renderTemplates(templates);
  $('templates-truncated').hidden = !truncated;
  log('ok', `Plantillas actualizadas: ${templates.length}.`);
}

document.querySelectorAll('input[name="type"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    const isText = document.querySelector('input[name="type"]:checked').value === 'text';
    $('text-fields').hidden = !isText;
    $('template-fields').hidden = isText;
  });
});

$('send-template').addEventListener('change', renderTemplateParams);

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
      const parameters = [...$('template-params').querySelectorAll('input')].map((i) => i.value);
      Object.assign(payload, { templateName, language, parameters });
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
