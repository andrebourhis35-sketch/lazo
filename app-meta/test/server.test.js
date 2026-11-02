import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { loadConfig } from '../src/config.js';
import { startServer } from '../src/server.js';
import { validateTemplate, normalizePhone } from '../src/validation.js';

const TOKEN = 'TOKEN_DE_PRUEBA_SECRETO';
const ENV = {
  WHATSAPP_ACCESS_TOKEN: TOKEN,
  WHATSAPP_BUSINESS_ACCOUNT_ID: '1111222233334444',
  WHATSAPP_PHONE_NUMBER_ID: '5555666677778888',
  GRAPH_API_VERSION: 'v99.0',
  PORT: '0',
};

// Simulación de la Graph API: guarda cada llamada y responde según la ruta.
const calls = [];
let nextError = null;
async function fakeFetch(url, init) {
  calls.push({ url: String(url), init, body: init.body ? JSON.parse(init.body) : null });
  if (nextError) {
    const error = nextError;
    nextError = null;
    return Response.json({ error }, { status: 400 });
  }
  const { pathname } = new URL(url);
  if (pathname.endsWith('/messages')) {
    return Response.json({ messaging_product: 'whatsapp', contacts: [{ input: '51987654321', wa_id: '51987654321' }], messages: [{ id: 'wamid.PRUEBA' }] });
  }
  if (pathname.endsWith('/message_templates') && init.method === 'GET') {
    // Dos páginas: la segunda se pide con el cursor "after".
    if (new URL(url).searchParams.get('after') === 'CURSOR2') {
      return Response.json({ data: [
        { id: '3', name: 'cita', status: 'APPROVED', category: 'UTILITY', language: 'es',
          components: [{ type: 'BODY', text: 'Hola {{1}}, tu cita es el {{2}}. {{1}}' }] },
        { id: '4', name: 'con_imagen', status: 'APPROVED', category: 'MARKETING', language: 'es',
          components: [{ type: 'HEADER', format: 'IMAGE' }, { type: 'BODY', text: 'Oferta' }] },
        { id: '5', name: 'nombrada', status: 'APPROVED', category: 'UTILITY', language: 'es',
          components: [{ type: 'BODY', text: 'Hola {{cliente}}' }] },
      ], paging: { cursors: { before: 'B', after: 'FIN' } } });
    }
    return Response.json({ data: [
      { id: '1', name: 'hello_world', status: 'APPROVED', category: 'UTILITY', language: 'en_US',
        components: [{ type: 'HEADER', format: 'TEXT', text: 'Hello World' }, { type: 'BODY', text: 'Welcome' }] },
      { id: '2', name: 'promo', status: 'REJECTED', category: 'MARKETING', language: 'es', rejected_reason: 'PROMOTIONAL' },
    ], paging: { cursors: { before: 'A', after: 'CURSOR2' }, next: 'https://graph.facebook.com/siguiente' } });
  }
  if (pathname.endsWith('/message_templates') && init.method === 'POST') {
    return Response.json({ id: '987', status: 'PENDING', category: 'UTILITY' });
  }
  return Response.json({ error: { message: 'ruta inesperada' } }, { status: 404 });
}

let server;
let base;
before(async () => {
  server = await startServer(loadConfig(ENV), { fetchImpl: fakeFetch });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const post = (path, body, headers = { 'Content-Type': 'application/json' }) =>
  fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });

test('estado: no expone el token y enmascara los IDs', async () => {
  const res = await fetch(`${base}/api/status`);
  const text = await res.text();
  assert.equal(res.status, 200);
  assert.ok(!text.includes(TOKEN));
  assert.ok(!text.includes(ENV.WHATSAPP_BUSINESS_ACCOUNT_ID));
  const data = JSON.parse(text);
  assert.equal(data.ready, true);
  assert.equal(data.graphVersion, 'v99.0');
  assert.equal(data.wabaId, '••••4444');
});

test('envía hello_world con la versión configurada y el token en la cabecera', async () => {
  calls.length = 0;
  const res = await post('/api/messages', { to: '+51 987 654 321', type: 'template', templateName: 'hello_world', language: 'en_US' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { messageId: 'wamid.PRUEBA', messageStatus: null, to: '51987654321' });
  const [call] = calls;
  assert.equal(call.url, 'https://graph.facebook.com/v99.0/5555666677778888/messages');
  assert.equal(call.init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(call.body, {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: '51987654321',
    type: 'template', template: { name: 'hello_world', language: { code: 'en_US' } },
  });
});

test('envía texto', async () => {
  calls.length = 0;
  const res = await post('/api/messages', { to: '51987654321', type: 'text', text: ' Hola ' });
  assert.equal(res.status, 200);
  assert.deepEqual(calls[0].body.text, { preview_url: false, body: 'Hola' });
});

test('rechaza número no válido sin llamar a Meta', async () => {
  calls.length = 0;
  const res = await post('/api/messages', { to: '123', type: 'text', text: 'hola' });
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test('modo revisión solo envía al destinatario de prueba configurado', async () => {
  let requestsToMeta = 0;
  const restricted = await startServer(loadConfig({
    ...ENV,
    LAZO_REVIEW_MODE: '1',
    LAZO_REVIEW_RECIPIENT: '51987654321',
  }), { fetchImpl: async (...args) => { requestsToMeta++; return fakeFetch(...args); } });
  try {
    const url = `http://127.0.0.1:${restricted.address().port}/api/messages`;
    const request = (to) => fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, type: 'template', templateName: 'hello_world', language: 'en_US' }),
    });
    assert.equal((await request('51912345678')).status, 403);
    assert.equal(requestsToMeta, 0);
    assert.equal((await request('+51 987 654 321')).status, 200);
    assert.equal(requestsToMeta, 1);
  } finally {
    await new Promise((resolve) => restricted.close(resolve));
  }
});

test('modo revisión falla de forma segura si falta el destinatario', () => {
  assert.equal(loadConfig({ ...ENV, LAZO_REVIEW_MODE: '1' }).ready, false);
  assert.equal(loadConfig({ ...ENV, LAZO_REVIEW_MODE: 'yes' }).ready, false);
  assert.equal(loadConfig({ ...ENV, LAZO_REVIEW_MODE: '1', LAZO_REVIEW_RECIPIENT: '51987654321' }).ready, true);
});

test('lista todas las páginas de plantillas con estado y motivo de rechazo', async () => {
  calls.length = 0;
  const res = await fetch(`${base}/api/templates`);
  const { templates, truncated } = await res.json();
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /^https:\/\/graph\.facebook\.com\/v99\.0\/1111222233334444\/message_templates\?fields=/);
  assert.equal(new URL(calls[1].url).searchParams.get('after'), 'CURSOR2');
  assert.equal(truncated, false);
  assert.deepEqual(templates.map((t) => t.name), ['hello_world', 'promo', 'cita', 'con_imagen', 'nombrada']);
  assert.equal(templates[1].rejectedReason, 'PROMOTIONAL');
});

test('marca qué plantillas puede enviar la app y cuántas variables tienen', async () => {
  const { templates } = await (await fetch(`${base}/api/templates`)).json();
  const byName = Object.fromEntries(templates.map((t) => [t.name, t]));
  assert.deepEqual([byName.hello_world.sendable, byName.hello_world.bodyVariables], [true, 0]);
  assert.equal(byName.promo.sendable, false);
  assert.deepEqual([byName.cita.sendable, byName.cita.bodyVariables], [true, 2]);
  assert.equal(byName.con_imagen.sendable, false);
  assert.equal(byName.nombrada.sendable, false);
});

test('envía plantilla con variables como parámetros del cuerpo', async () => {
  calls.length = 0;
  const res = await post('/api/messages', { to: '51987654321', type: 'template', templateName: 'cita', language: 'es', parameters: [' Lucía ', 'lunes'] });
  assert.equal(res.status, 200);
  assert.deepEqual(calls[0].body.template, {
    name: 'cita', language: { code: 'es' },
    components: [{ type: 'body', parameters: [{ type: 'text', text: 'Lucía' }, { type: 'text', text: 'lunes' }] }],
  });
});

test('rechaza parámetros vacíos sin llamar a Meta', async () => {
  calls.length = 0;
  const res = await post('/api/messages', { to: '51987654321', type: 'template', templateName: 'cita', language: 'es', parameters: ['Lucía', ' '] });
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test('crea plantilla con variables y ejemplos', async () => {
  calls.length = 0;
  const res = await post('/api/templates', {
    name: 'confirmacion_cita', language: 'es', category: 'utility',
    bodyText: 'Hola {{1}}, tu cita es el {{2}}.', examples: ['Lucía', 'lunes', ''], footer: 'LAZO',
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { id: '987', status: 'PENDING', category: 'UTILITY' });
  assert.deepEqual(calls[0].body, {
    name: 'confirmacion_cita', language: 'es', category: 'UTILITY',
    components: [
      { type: 'BODY', text: 'Hola {{1}}, tu cita es el {{2}}.', example: { body_text: [['Lucía', 'lunes']] } },
      { type: 'FOOTER', text: 'LAZO' },
    ],
  });
});

test('devuelve el error de Meta sin filtrar el token', async () => {
  nextError = { message: `Invalid OAuth access token ${TOKEN}`, code: 190, fbtrace_id: 'TRAZA' };
  const res = await fetch(`${base}/api/templates`);
  const text = await res.text();
  assert.equal(res.status, 400);
  assert.ok(!text.includes(TOKEN));
  assert.deepEqual(JSON.parse(text), { error: 'Invalid OAuth access token [token]', metaCode: 190, metaSubcode: null, fbtraceId: 'TRAZA' });
});

test('exige Content-Type JSON en POST (bloquea envíos desde otras webs)', async () => {
  calls.length = 0;
  const res = await post('/api/messages', { to: '51987654321', type: 'text', text: 'x' }, { 'Content-Type': 'text/plain' });
  assert.equal(res.status, 415);
  assert.equal(calls.length, 0);
});

test('rechaza un Host ajeno (DNS rebinding)', async () => {
  const status = await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path: '/api/status', headers: { Host: 'atacante.example:80' } },
      (res) => { res.resume(); resolve(res.statusCode); }).on('error', reject);
  });
  assert.equal(status, 421);
});

test('sirve solo los archivos públicos de la lista', async () => {
  assert.equal((await fetch(`${base}/`)).status, 200);
  assert.equal((await fetch(`${base}/marca.svg`)).status, 200);
  assert.equal((await fetch(`${base}/..%2Fsrc%2Fconfig.js`)).status, 404);
  assert.equal((await fetch(`${base}/.env`)).status, 404);
});

test('configuración incompleta: 503 sin llamar a Meta', async () => {
  const incomplete = await startServer(loadConfig({ PORT: '0' }), { fetchImpl: fakeFetch });
  calls.length = 0;
  try {
    const res = await fetch(`http://127.0.0.1:${incomplete.address().port}/api/templates`);
    assert.equal(res.status, 503);
    assert.equal(calls.length, 0);
  } finally {
    incomplete.close();
  }
});

test('validación: versión de Graph API y variables', () => {
  assert.ok(loadConfig({ ...ENV, GRAPH_API_VERSION: '21' }).errors.some((e) => e.includes('GRAPH_API_VERSION')));
  assert.equal(normalizePhone('51 987-654-321').value, '51987654321');
  assert.equal(validateTemplate({ name: 'a', language: 'es', category: 'UTILITY', bodyText: 'Hola {{2}}', examples: ['x'] }).ok, false);
  assert.equal(validateTemplate({ name: 'Mal-Nombre', language: 'es', category: 'UTILITY', bodyText: 'Hola' }).ok, false);
  assert.equal(validateTemplate({ name: 'ok', language: 'es', category: 'AUTHENTICATION', bodyText: 'Hola' }).ok, false);
});
