# Guion de los videos para la revisión de Meta

Dos videos, uno por permiso. Cada uno debe mostrar el uso real del permiso dentro de la app LAZO (`app-meta/`), de principio a fin y sin cortes que oculten pasos.

Antes de grabar, confirma en el panel de la app (App Review → Permisos y funciones) los requisitos vigentes de formato, idioma y duración. Este guion no los sustituye.

## Preparación (una sola vez, sin grabar)

1. Completa `app-meta/.env` (ver `app-meta/README.md`). No grabes nunca la pantalla con `.env`, el token o el panel de tokens abiertos.
2. En el panel de Meta (WhatsApp → Configuración de la API), añade el teléfono que usarás como destinatario a la lista de números de prueba y verifícalo.
3. Ejecuta `npm start` en `app-meta/` y abre http://localhost:3000. Comprueba que la píldora superior muestre la versión de Graph API y los IDs enmascarados.
4. Ten el teléfono destinatario a mano con WhatsApp abierto. Para grabarlo, usa duplicación de pantalla (por ejemplo, la app de Windows "Enlace Móvil") o una segunda cámara.
5. Cierra pestañas, notificaciones y cualquier ventana con datos personales o credenciales. Usa zoom del navegador al 100 % y resolución de al menos 1280×720.
6. Recomendado: subtítulos o narración en inglés además del español, porque los revisores pueden no hablar español (confírmalo en el panel).

## Video 1: `whatsapp_business_messaging` (2 a 3 minutos)

| Tiempo | Qué mostrar | Qué decir o rotular |
|---|---|---|
| 0:00–0:15 | La app LAZO abierta en http://localhost:3000, con el encabezado y la píldora de conexión. | "LAZO es un CRM para WhatsApp Business. Este video muestra cómo usamos whatsapp_business_messaging." |
| 0:15–0:35 | Sección 1, "Enviar mensaje". Escribe el número de prueba con código de país. | "La empresa escribe el número del cliente que dio su consentimiento." |
| 0:35–1:00 | Elige "Plantilla" y `hello_world · en_US`. Pulsa "Enviar mensaje". | "Enviamos una plantilla aprobada mediante la API oficial de WhatsApp Cloud." |
| 1:00–1:20 | El Registro de actividad muestra "Mensaje aceptado por WhatsApp" con el ID `wamid…`. | "La API confirma el envío y devuelve el ID del mensaje." |
| 1:20–1:50 | El teléfono destinatario recibe el mensaje en WhatsApp. | "El cliente recibe el mensaje en WhatsApp." |
| 1:50–2:30 | Opcional, solo si el destinatario respondió en las últimas 24 h: elige "Texto", escribe un mensaje breve, envíalo y muestra que llega al teléfono. | "Dentro de la ventana de 24 horas, la empresa responde con texto libre." |
| 2:30–2:45 | Vuelve a la app. | "Así usamos el permiso: enviar mensajes de la empresa a sus clientes desde LAZO." |

Para que el paso opcional funcione, haz que el teléfono destinatario escriba antes al número de prueba. Si no, WhatsApp no entregará el texto libre: no lo muestres como fallo en el video.

## Video 2: `whatsapp_business_management` (2 a 3 minutos)

| Tiempo | Qué mostrar | Qué decir o rotular |
|---|---|---|
| 0:00–0:15 | La app LAZO abierta. | "Este video muestra cómo usamos whatsapp_business_management." |
| 0:15–0:40 | Sección 3, "Plantillas de la cuenta". Pulsa "Actualizar" y muestra la lista con sus estados. | "LAZO consulta las plantillas de la cuenta de WhatsApp Business y su estado de aprobación." |
| 0:40–1:30 | Sección 2, "Crear plantilla". Nombre `confirmacion_cita_demo`, idioma Español (es), categoría Utilidad. Cuerpo: `Hola {{1}}, tu cita está confirmada para el {{2}}. Gracias por confiar en nosotros.` Ejemplos: `Lucía` y `5 de noviembre a las 10:00`. Pie: `LAZO`. | "La empresa crea una plantilla de mensaje desde LAZO." |
| 1:30–1:50 | Pulsa "Enviar a revisión de Meta". El Registro muestra la plantilla enviada con su ID y estado. | "La plantilla se envía a revisión de Meta mediante la API." |
| 1:50–2:20 | La tabla se actualiza sola y muestra la nueva plantilla con estado PENDING o APPROVED. | "La empresa ve el estado de cada plantilla sin salir de LAZO." |
| 2:20–2:45 | Opcional: muestra la misma plantilla en el Administrador de WhatsApp de Meta como comprobación. | "La plantilla creada aparece en la cuenta de WhatsApp Business." |

Usa un nombre de plantilla nuevo en cada intento: Meta rechaza nombres repetidos en el mismo idioma. Si la plantilla queda aprobada antes de terminar, puedes cerrar enviándola desde la sección 1: al elegirla aparecen los campos "Valor de {{1}}" y "Valor de {{2}}".

## Después de grabar

- Revisa que ningún fotograma muestre el token, `.env`, el panel de tokens ni datos personales reales de terceros.
- Exporta en MP4 y comprueba que se lee bien a la resolución en que lo subirás.
