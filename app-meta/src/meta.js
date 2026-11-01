// Cliente mínimo de la WhatsApp Cloud API (Graph API oficial de Meta).

const GRAPH_BASE = 'https://graph.facebook.com';

export class MetaApiError extends Error {
  constructor(message, { status, code, subcode, fbtraceId } = {}) {
    super(message);
    this.name = 'MetaApiError';
    this.status = status;
    this.code = code;
    this.subcode = subcode;
    this.fbtraceId = fbtraceId;
  }
}

export function createMetaClient({ token, graphVersion, wabaId, phoneNumberId, fetchImpl = fetch }) {
  const redact = (text) => (token ? String(text).split(token).join('[token]') : String(text));

  async function request(method, path, { query, body } = {}) {
    const url = new URL(`${GRAPH_BASE}/${graphVersion}/${path}`);
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);

    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      throw new MetaApiError(`No se pudo conectar con la Graph API: ${redact(err.message)}`, { status: 502 });
    }

    let data = null;
    try {
      data = await response.json();
    } catch {
      // Respuesta sin JSON.
    }

    if (!response.ok || data?.error) {
      const e = data?.error ?? {};
      const message = e.error_user_msg || e.message || `La Graph API respondió ${response.status}`;
      throw new MetaApiError(redact(message), {
        status: response.status,
        code: e.code,
        subcode: e.error_subcode,
        fbtraceId: e.fbtrace_id,
      });
    }
    return data;
  }

  return {
    sendMessage(msg) {
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: msg.to,
      };
      if (msg.type === 'text') {
        payload.type = 'text';
        payload.text = { preview_url: false, body: msg.text };
      } else {
        payload.type = 'template';
        payload.template = { name: msg.templateName, language: { code: msg.language } };
      }
      return request('POST', `${phoneNumberId}/messages`, { body: payload });
    },

    listTemplates() {
      return request('GET', `${wabaId}/message_templates`, {
        query: { fields: 'id,name,status,category,language,rejected_reason', limit: '100' },
      });
    },

    createTemplate(template) {
      return request('POST', `${wabaId}/message_templates`, { body: template });
    },
  };
}
