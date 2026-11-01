# LAZO · App mínima para la revisión de Meta

App web mínima cuyo único fin es la revisión de apps de Meta para los permisos `whatsapp_business_messaging` y `whatsapp_business_management`. La autorizó el usuario el 1 de noviembre de 2026 como excepción acotada (ver `docs/COORDINACION.md`). No es el producto LAZO. La landing y el CRM de diseño no se tocan, y esta app está separada de `interfaz/`.

El isotipo que se usa aquí es **provisional**: el isotipo A refinado sigue pendiente de aprobación.

## Funciones

1. **Enviar mensaje** (`whatsapp_business_messaging`): envía la plantilla `hello_world` (u otra aprobada) o un texto a un número de WhatsApp.
2. **Crear plantilla** (`whatsapp_business_management`): crea una plantilla con cuerpo, variables `{{n}}` con ejemplos y pie opcional. Categorías: UTILITY o MARKETING.
3. **Listar plantillas** (`whatsapp_business_management`): muestra nombre, idioma, categoría, estado y motivo de rechazo.

Llamadas a la Graph API oficial (`https://graph.facebook.com/<GRAPH_API_VERSION>/…`):

| Función | Método y ruta |
|---|---|
| Enviar mensaje | `POST /{WHATSAPP_PHONE_NUMBER_ID}/messages` |
| Listar plantillas | `GET /{WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates` |
| Crear plantilla | `POST /{WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates` |

## Requisitos

- Node.js 20.12 o posterior (probado con 24.15). Sin dependencias: no hace falta `npm install`.
- App de Meta con el producto WhatsApp, un número de prueba y un token de acceso.

## Configuración

1. Copia `.env.example` como `.env` en esta carpeta (`app-meta/.env`).
2. Rellena `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_PHONE_NUMBER_ID` y `GRAPH_API_VERSION` (la versión vigente que muestra tu panel de Meta, con formato `vNN.N`).
3. `.env` está en `.gitignore`. No lo subas al repositorio ni pegues su contenido en ningún chat.

## Uso

```
cd app-meta
npm start
```

Abre http://localhost:3000. Si falta algún dato en `.env`, la interfaz lo indica y no llama a Meta.

## Pruebas

```
cd app-meta
npm test
```

Las pruebas sustituyen la Graph API por una simulación: **no** llaman a Meta. Comprueban el formato de las peticiones, la versión configurable, la validación, que el token no aparezca en respuestas ni errores y las protecciones del servidor.

## Seguridad

- El token solo vive en el servidor. `/api/status` no lo devuelve y muestra los IDs enmascarados (últimos 4 dígitos).
- Si Meta devuelve el token dentro de un mensaje de error, se sustituye por `[token]`.
- El servidor escucha solo en `127.0.0.1`. Rechaza cabeceras `Host` ajenas (protección frente a DNS rebinding) y exige `Content-Type: application/json` en los POST, así que otra web abierta en el navegador no puede enviar mensajes desde aquí.
- Solo sirve una lista cerrada de archivos de `public/`. Envía cabeceras CSP, `nosniff`, `no-referrer` y `X-Frame-Options: DENY`.
- Límite de 16 KB por solicitud y de 15 s por llamada a Meta.

## Límites conocidos

- Texto libre: WhatsApp solo lo entrega si el destinatario escribió en las últimas 24 horas. Para el primer contacto, usa una plantilla (`hello_world`).
- No recibe mensajes (no hay webhook) y no guarda datos: lo enviado queda en Meta y en WhatsApp.
- Plantillas: solo cuerpo y pie de texto. Sin encabezados multimedia, botones ni categoría AUTHENTICATION.
- Pensada para ejecutarse en local durante la grabación de los videos. No está preparada para producción.
