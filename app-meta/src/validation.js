// Validación de entradas antes de llamar a la WhatsApp Cloud API.
// Cada función devuelve { ok: true, value } o { ok: false, error }.

const TEMPLATE_NAME = /^[a-z0-9_]{1,512}$/;
const LANGUAGE_CODE = /^[a-z]{2,3}(_[A-Z]{2})?$/;
const VARIABLE = /\{\{\s*(\d+)\s*\}\}/g;
const NAMED_VARIABLE = /\{\{\s*[a-z_][a-z0-9_]*\s*\}\}/;
const CATEGORIES = new Set(['UTILITY', 'MARKETING']);

const fail = (error) => ({ ok: false, error });
const isText = (v) => typeof v === 'string';

/** Número en formato internacional, solo dígitos (8 a 15), sin "+". */
export function normalizePhone(raw) {
  if (!isText(raw)) return fail('Indica el número de destino.');
  const digits = raw.replace(/[\s\-().+]/g, '');
  if (!/^\d{8,15}$/.test(digits)) {
    return fail('El número debe tener entre 8 y 15 dígitos, con código de país (por ejemplo, 51987654321).');
  }
  return { ok: true, value: digits };
}

export function validateSendMessage(body) {
  if (!body || typeof body !== 'object') return fail('Solicitud no válida.');
  const phone = normalizePhone(body.to);
  if (!phone.ok) return phone;

  if (body.type === 'text') {
    const text = isText(body.text) ? body.text.trim() : '';
    if (!text) return fail('Escribe el texto del mensaje.');
    if (text.length > 4096) return fail('El texto no puede superar 4096 caracteres.');
    return { ok: true, value: { to: phone.value, type: 'text', text } };
  }

  if (body.type === 'template') {
    const name = isText(body.templateName) ? body.templateName.trim() : '';
    const language = isText(body.language) ? body.language.trim() : '';
    if (!TEMPLATE_NAME.test(name)) return fail('Nombre de plantilla no válido.');
    if (!LANGUAGE_CODE.test(language)) return fail('Código de idioma no válido (por ejemplo, es o en_US).');
    const raw = body.parameters ?? [];
    if (!Array.isArray(raw) || raw.length > 20) return fail('Parámetros de plantilla no válidos.');
    const parameters = raw.map((p) => (isText(p) ? p.trim() : ''));
    if (parameters.some((p) => !p)) return fail('Completa el valor de cada variable de la plantilla.');
    if (parameters.some((p) => p.length > 1024)) return fail('Cada valor de variable admite hasta 1024 caracteres.');
    return { ok: true, value: { to: phone.value, type: 'template', templateName: name, language, parameters } };
  }

  return fail('El tipo de mensaje debe ser "text" o "template".');
}

/** Devuelve los números de variable {{n}} en orden de aparición. */
export function findVariables(text) {
  return [...text.matchAll(VARIABLE)].map((m) => Number(m[1]));
}

export function validateTemplate(body) {
  if (!body || typeof body !== 'object') return fail('Solicitud no válida.');

  const name = isText(body.name) ? body.name.trim() : '';
  if (!TEMPLATE_NAME.test(name)) {
    return fail('El nombre solo admite minúsculas, números y guion bajo (por ejemplo, confirmacion_pedido).');
  }

  const language = isText(body.language) ? body.language.trim() : '';
  if (!LANGUAGE_CODE.test(language)) return fail('Código de idioma no válido (por ejemplo, es o en_US).');

  const category = isText(body.category) ? body.category.trim().toUpperCase() : '';
  if (!CATEGORIES.has(category)) return fail('La categoría debe ser UTILITY o MARKETING.');

  const text = isText(body.bodyText) ? body.bodyText.trim() : '';
  if (!text) return fail('Escribe el cuerpo de la plantilla.');
  if (text.length > 1024) return fail('El cuerpo no puede superar 1024 caracteres.');

  const vars = findVariables(text);
  const unique = [...new Set(vars)].sort((a, b) => a - b);
  if (unique.some((n, i) => n !== i + 1)) {
    return fail('Las variables deben ser consecutivas desde {{1}}.');
  }

  const examples = Array.isArray(body.examples)
    ? body.examples.map((e) => (isText(e) ? e.trim() : '')).filter(Boolean)
    : [];
  if (examples.length !== unique.length) {
    return fail(`Indica ${unique.length} valor(es) de ejemplo, uno por variable.`);
  }

  const footer = isText(body.footer) ? body.footer.trim() : '';
  if (footer.length > 60) return fail('El pie no puede superar 60 caracteres.');

  const bodyComponent = { type: 'BODY', text };
  if (examples.length) bodyComponent.example = { body_text: [examples] };
  const components = [bodyComponent];
  if (footer) components.push({ type: 'FOOTER', text: footer });

  return { ok: true, value: { name, language, category, components } };
}

/**
 * Resume una plantilla de la Graph API para la interfaz.
 * Solo se puede enviar desde la app si sus únicas variables están en el cuerpo:
 * encabezados multimedia o con variables y botones con variables necesitan datos que esta app no pide.
 */
export function describeTemplate(t) {
  const components = Array.isArray(t.components) ? t.components : [];
  const body = components.find((c) => c.type === 'BODY');
  const bodyVariables = body?.text ? new Set(findVariables(body.text)).size : 0;

  const header = components.find((c) => c.type === 'HEADER');
  const headerUnsupported = header && (header.format !== 'TEXT' || findVariables(header.text ?? '').length > 0);
  const buttons = components.find((c) => c.type === 'BUTTONS')?.buttons ?? [];
  const supportedButton = (b) => b.type === 'QUICK_REPLY' || b.type === 'PHONE_NUMBER'
    || (b.type === 'URL' && findVariables(b.url ?? '').length === 0);
  const buttonsUnsupported = buttons.some((b) => !supportedButton(b));
  // Variables con nombre ({{cliente}}) requieren parameter_name: no las admite esta app.
  const namedVariables = components.some((c) => NAMED_VARIABLE.test(c.text ?? ''));

  return {
    id: t.id,
    name: t.name,
    status: t.status,
    category: t.category,
    language: t.language,
    rejectedReason: t.rejected_reason && t.rejected_reason !== 'NONE' ? t.rejected_reason : null,
    bodyVariables,
    sendable: t.status === 'APPROVED' && t.category !== 'AUTHENTICATION' && !headerUnsupported && !buttonsUnsupported && !namedVariables,
  };
}
