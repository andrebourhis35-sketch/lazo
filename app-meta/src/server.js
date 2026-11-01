import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { maskId } from './config.js';
import { createMetaClient, MetaApiError } from './meta.js';
import { describeTemplate, validateSendMessage, validateTemplate } from './validation.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const MAX_BODY_BYTES = 16 * 1024;

// Lista cerrada de archivos públicos: evita recorrer rutas del disco.
const STATIC_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/marca.svg': ['marca.svg', 'image/svg+xml'],
  '/logotipo.svg': ['logotipo.svg', 'image/svg+xml'],
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': [
    "default-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; '),
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const payload = type.startsWith('application/json') ? JSON.stringify(body) : body;
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
  res.end(payload);
}

async function readJson(req) {
  const type = req.headers['content-type'] ?? '';
  // Exigir JSON obliga al navegador a hacer una petición de comprobación previa (CORS)
  // que este servidor no acepta: una web ajena no puede enviar mensajes desde aquí.
  if (!type.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Se esperaba Content-Type: application/json.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'La solicitud es demasiado grande.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'JSON no válido.');
  }
}

export function createApp(config, { fetchImpl = fetch } = {}) {
  const meta = createMetaClient({ ...config, fetchImpl });

  function requireReady() {
    if (!config.ready) {
      throw new HttpError(503, `Configuración incompleta: ${config.errors.join('; ')}`);
    }
  }

  const routes = {
    'GET /api/status': () => ({
      ready: config.ready,
      errors: config.errors,
      graphVersion: config.graphVersion || null,
      wabaId: maskId(config.wabaId),
      phoneNumberId: maskId(config.phoneNumberId),
    }),

    'POST /api/messages': async (req) => {
      requireReady();
      const check = validateSendMessage(await readJson(req));
      if (!check.ok) throw new HttpError(400, check.error);
      const data = await meta.sendMessage(check.value);
      return {
        messageId: data?.messages?.[0]?.id ?? null,
        messageStatus: data?.messages?.[0]?.message_status ?? null,
        to: data?.contacts?.[0]?.wa_id ?? check.value.to,
      };
    },

    'GET /api/templates': async () => {
      requireReady();
      const { templates, truncated } = await meta.listTemplates();
      return { templates: templates.map(describeTemplate), truncated };
    },

    'POST /api/templates': async (req) => {
      requireReady();
      const check = validateTemplate(await readJson(req));
      if (!check.ok) throw new HttpError(400, check.error);
      const data = await meta.createTemplate(check.value);
      return { id: data?.id ?? null, status: data?.status ?? null, category: data?.category ?? null };
    },
  };

  return async function handler(req, res) {
    try {
      // Rechaza nombres de host ajenos (protección frente a DNS rebinding).
      const port = req.socket.localPort;
      const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
      if (!allowedHosts.includes(req.headers.host ?? '')) throw new HttpError(421, 'Host no permitido.');

      const { pathname } = new URL(req.url, 'http://localhost');
      const route = routes[`${req.method} ${pathname}`];
      if (route) return send(res, 200, await route(req));

      if (pathname.startsWith('/api/')) throw new HttpError(404, 'Ruta no encontrada.');

      const file = STATIC_FILES[pathname];
      if (!file || req.method !== 'GET') throw new HttpError(404, 'No encontrado.');
      return send(res, 200, await readFile(PUBLIC_DIR + file[0]), file[1]);
    } catch (err) {
      if (err instanceof MetaApiError) {
        return send(res, err.status >= 400 && err.status < 600 ? err.status : 502, {
          error: err.message,
          metaCode: err.code ?? null,
          metaSubcode: err.subcode ?? null,
          fbtraceId: err.fbtraceId ?? null,
        });
      }
      if (err instanceof HttpError) return send(res, err.status, { error: err.message });
      console.error('Error interno:', err.message);
      return send(res, 500, { error: 'Error interno del servidor.' });
    }
  };
}

export function startServer(config, options) {
  const server = http.createServer(createApp(config, options));
  return new Promise((resolve) => {
    server.listen(config.port, config.host, () => resolve(server));
  });
}
