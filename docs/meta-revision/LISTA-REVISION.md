# Lista de verificación para el formulario de revisión de Meta

Marca cada punto antes de enviar. Los nombres de los campos pueden variar: confírmalos en el panel de la app (Configuración → Básica, y App Review → Permisos y funciones).

## Datos que debes completar (no están en el repositorio)

- [ ] `[NOMBRE LEGAL DE LA LLC]`, `[ESTADO DE CONSTITUCIÓN]`, `[DIRECCIÓN]`, `[EMAIL DE CONTACTO]` y los demás marcadores de `docs/legal/`.
- [ ] Revisión de las tres páginas legales por un abogado.
- [ ] `app-meta/.env` con token, WABA ID, Phone Number ID y versión de Graph API (solo en tu equipo).
- [ ] Correo de contacto de la app en el panel.

## Configuración básica de la app

- [ ] **URL de la política de privacidad:** `https://andrebourhis35-sketch.github.io/lazo/legal/privacidad.html`. Funcionará solo si activas GitHub Pages desde `main` y carpeta `/docs`, después de integrar el PR. Ábrela en una ventana privada para comprobarla.
- [ ] **URL de las condiciones del servicio:** `https://andrebourhis35-sketch.github.io/lazo/legal/terminos.html`
- [ ] **Eliminación de datos:** elige "URL de instrucciones" y usa `https://andrebourhis35-sketch.github.io/lazo/legal/eliminacion-datos.html`. La app no tiene callback de eliminación.
- [ ] **Ícono de la app (1024×1024):** `branding/app-meta/icono-app-1024-PROVISIONAL.png`. Provisional: el isotipo A sigue pendiente de aprobación.
- [ ] **Categoría:** propuesta "Negocios y páginas" (o la más cercana a mensajería para empresas que ofrezca el panel). Decisión tuya.
- [ ] **Verificación del negocio** de la LLC completada en el Administrador comercial, si el panel la exige para acceso avanzado.

Aviso: GitHub Pages desde `/docs` también publica el resto de esa carpeta, incluido `docs/COORDINACION.md`. Si no quieres que sea público, publica Pages desde otra rama o carpeta que solo contenga `legal/`.

## Permiso `whatsapp_business_messaging`

- [ ] Video 1 subido (ver `GUION-VIDEOS.md`).
- [ ] Descripción de uso propuesta (revísala y ajústala):

> LAZO es un CRM para que las empresas atiendan a sus clientes por WhatsApp. Usamos whatsapp_business_messaging para que la empresa envíe mensajes desde LAZO a clientes que dieron su consentimiento: plantillas aprobadas para iniciar la conversación y respuestas de texto dentro de la ventana de atención de 24 horas. El video muestra cómo se envía una plantilla desde LAZO y cómo llega al WhatsApp del destinatario.

- [ ] Versión en inglés si el formulario la pide.

## Permiso `whatsapp_business_management`

- [ ] Video 2 subido (ver `GUION-VIDEOS.md`).
- [ ] Descripción de uso propuesta (revísala y ajústala):

> Usamos whatsapp_business_management para que la empresa gestione sus plantillas de mensaje desde LAZO: crear una plantilla y enviarla a revisión de Meta, y consultar las plantillas de su cuenta de WhatsApp Business con su estado de aprobación y motivo de rechazo. Así la empresa sabe qué plantillas puede usar sin salir de LAZO. El video muestra la creación de una plantilla y la lista actualizada con su estado.

- [ ] Versión en inglés si el formulario la pide.

## Antes de enviar

- [ ] Las tres URL legales abren sin iniciar sesión y sin marcadores pendientes.
- [ ] Ningún video ni captura muestra el token o `.env`.
- [ ] La app usada en los videos es la de `app-meta/`, ejecutada con `npm start`.
- [ ] Instrucciones para el revisor: explica que la app se ejecuta en local y que los videos muestran el flujo completo. Ofrece credenciales de prueba solo si el formulario las pide, y nunca tu token.
