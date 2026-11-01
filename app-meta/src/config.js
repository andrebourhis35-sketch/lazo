const REQUIRED = [
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_BUSINESS_ACCOUNT_ID',
  'WHATSAPP_PHONE_NUMBER_ID',
  'GRAPH_API_VERSION',
];

export const GRAPH_VERSION_PATTERN = /^v\d+\.\d+$/;
const NUMERIC_ID_PATTERN = /^\d+$/;

/**
 * Lee la configuración desde variables de entorno.
 * Nunca devuelve el token fuera del objeto de configuración del servidor.
 */
export function loadConfig(env = process.env) {
  const value = (name) => (env[name] ?? '').trim();
  const errors = [];

  for (const name of REQUIRED) {
    if (!value(name)) errors.push(`Falta ${name} en .env`);
  }

  const graphVersion = value('GRAPH_API_VERSION');
  if (graphVersion && !GRAPH_VERSION_PATTERN.test(graphVersion)) {
    errors.push('GRAPH_API_VERSION debe tener el formato vNN.N (por ejemplo, v00.0)');
  }

  const wabaId = value('WHATSAPP_BUSINESS_ACCOUNT_ID');
  if (wabaId && !NUMERIC_ID_PATTERN.test(wabaId)) {
    errors.push('WHATSAPP_BUSINESS_ACCOUNT_ID debe ser numérico');
  }

  const phoneNumberId = value('WHATSAPP_PHONE_NUMBER_ID');
  if (phoneNumberId && !NUMERIC_ID_PATTERN.test(phoneNumberId)) {
    errors.push('WHATSAPP_PHONE_NUMBER_ID debe ser numérico');
  }

  const portText = value('PORT') || '3000';
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    errors.push('PORT debe ser un número entre 0 y 65535');
  }

  return {
    token: value('WHATSAPP_ACCESS_TOKEN'),
    wabaId,
    phoneNumberId,
    graphVersion,
    port,
    host: '127.0.0.1',
    errors,
    ready: errors.length === 0,
  };
}

/** Muestra solo los últimos 4 dígitos de un ID. */
export function maskId(id) {
  if (!id) return null;
  return id.length <= 4 ? '••••' : `••••${id.slice(-4)}`;
}
