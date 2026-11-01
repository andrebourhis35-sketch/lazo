# Lista de verificación para el formulario de revisión de Meta

Marca cada punto antes de enviar. Los nombres de los campos pueden variar: confírmalos en el panel de la app (Configuración → Básica, y App Review → Permisos y funciones).

## Datos que debes completar (no están en el repositorio)

- [x] Titular: La Boutique du Monde E.I.R.L., empresa constituida en Perú, con RUC 20610684760, domicilio en Av. Brasil 3730, Magdalena del Mar, Lima 15087, Perú; correo contacto@espacio-sereno.com. Es la empresa verificada en Meta.
- [x] Páginas legales completas y sin marcadores (1 de noviembre de 2026): base del tratamiento, proveedores, transferencias internacionales, conservación máxima de 90 días, respuesta en 10 días hábiles, mayores de 18 años, ley peruana (Ley N.º 29733) y jurisdicción de Lima.
- [ ] Revisión del texto por un abogado después de publicarlo, incluida la adecuación a la Ley N.º 29733.
- [ ] `app-meta/.env` con token, WABA ID, Phone Number ID y versión de Graph API (solo en tu equipo).
- [ ] Correo de contacto de la app en el panel.

## Configuración básica de la app

- [ ] **URL de la política de privacidad:** `https://legal.espacio-sereno.com/legal/privacidad.html`. Publicada desde la rama `gh-pages`, que contiene únicamente `legal/` y `CNAME`. Ábrela sin iniciar sesión para comprobarla.
- [ ] **URL de las condiciones del servicio:** `https://legal.espacio-sereno.com/legal/terminos.html`
- [ ] **Eliminación de datos:** elige "URL de instrucciones" y usa `https://legal.espacio-sereno.com/legal/eliminacion-datos.html`. La app no tiene callback de eliminación.
- [ ] **Ícono de la app (1024×1024):** `branding/app-meta/icono-app-1024-PROVISIONAL.png`. Provisional: el isotipo A sigue pendiente de aprobación.
- [ ] **Categoría:** Messaging (Mensajería), según la indicación del usuario; confirmar la opción disponible en el panel.
- [x] **Verificación del negocio:** La Boutique du Monde E.I.R.L. (RUC 20610684760) es la empresa verificada en Meta. Comprueba que la app esté asociada a ese portafolio comercial.

Publicación: regenerar `gh-pages` desde `main/docs/legal` después de integrar cambios legales, conservando `CNAME` con `legal.espacio-sereno.com`. No copiar otros documentos a esa rama.

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

- [ ] Las tres URL legales abren sin iniciar sesión y muestran la versión de `gh-pages` regenerada después de integrar este cambio.
- [ ] Ningún video ni captura muestra el token o `.env`.
- [ ] La app usada en los videos es la de `app-meta/`, ejecutada con `npm start`.
- [ ] Instrucciones para el revisor: explica que la app se ejecuta en local y que los videos muestran el flujo completo. Ofrece credenciales de prueba solo si el formulario las pide, y nunca tu token.

