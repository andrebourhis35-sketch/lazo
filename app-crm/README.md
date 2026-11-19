# LAZO CRM

Primera plataforma con cuentas por empresa, independiente de la demo estática y de la app que está en revisión de Meta. Acceso: https://lazo.espacio-sereno.com/app/.

## Funciones

- Propietario, administrador y asesor. Cada sesión elige una empresa de la que el usuario es miembro. Invitaciones privadas válidas 48 horas y de un solo uso, con envío por Zoho cuando el operador configure el correo.
- Recuperación por correo con enlaces de un solo uso de 15 minutos, contraseña nueva y cierre de sesiones anteriores. El correo requiere configuración privada; consultar [Correo y acceso](../docs/CORREO-ACCESO.md).
- Contactos, conversaciones, notas internas, asignación y etiquetas guardadas en SQLite. Filtros por estado, asesor y etiqueta. Se muestran hasta 1.000 contactos y los 100 mensajes más recientes por contacto.
- Conexión WhatsApp por empresa: token cifrado en el servidor, validación del número dentro del WABA y envío de plantillas aprobadas o texto dentro de la ventana de 24 horas desde el último mensaje entrante real.
- Webhook de mensajes y estados con firma SHA-256, deduplicación e historial de estados que no retrocede al recibir eventos atrasados. Imágenes JPG/PNG de hasta 5 MB y PDF de hasta 10 MB, con envío, vista de imagen y descarga privada.
- Respuestas rápidas compartidas con el equipo: administradores y propietario pueden crearlas y editarlas; los asesores pueden insertarlas en un borrador. Insertar no envía el mensaje.
- Entre dos y doce etapas de ventas por empresa: añadir, renombrar, ordenar y elegir una etapa ganada. Una etapa ocupada no puede eliminarse; renombrarla conserva sus contactos.
- Estadísticas por empresa con periodos de 7, 30 y 90 días: mensajes, entregas, tiempo medio de respuesta, contactos nuevos, movimientos a etapa ganada y distribución actual del equipo. Los días usan hora de Perú.
- Destinatario de prueba limitado en el servidor. Una aprobación de Meta no se presupone ni se produce por desplegar esta plataforma. El código de Embedded Signup está preparado; su habilitación comercial requiere completar la configuración y los permisos de Meta y una prueba real.

## Activación privada

El propietario recibe en su equipo un enlace privado con fragmento `#setup=...`. No pegarlo en Git ni compartir capturas. Al abrirlo, la app retira el fragmento de la barra y solicita empresa, nombre, correo y contraseña de al menos 12 caracteres. El enlace solo funciona una vez.

Para la conexión manual avanzada, en Conexiones el propietario completa el secreto de su app directamente en el formulario. Un token existente se conserva al dejar su campo vacío. Guardar y comprobar valida la cuenta con Meta. Configurar en Meta la URL de devolución de llamada que muestra la app y su token de verificación, seleccionar el campo `messages` y vincular la app a la cuenta de prueba. La recepción real se confirma solo cuando un mensaje enviado desde WhatsApp aparece en la bandeja.

Nunca pedir ni pegar tokens, contraseñas o secretos por chat. Con Zoho habilitado, usar **Olvidé mi contraseña** en la página de acceso. Si el correo aún no está configurado, el operador debe completar la configuración privada o verificar la identidad mediante soporte administrativo del servidor.

## Implementación y pruebas

### Flujos de bienvenida por empresa

En `/flujos/`, la sesión de LAZO permite al propietario o administrador guardar borradores en SQLite, abrirlos desde otra computadora y activar una versión independiente del borrador. La activación exige la cuenta de WhatsApp de prueba, palabra clave y exactamente un mensaje. Admite Inicio, Mensaje, Etiqueta, Asignar asesor y Finalizar; condiciones y esperas continúan disponibles solo para simular.

Solo puede haber un flujo activo por empresa. Los mensajes entrantes nuevos con firma válida se registran junto a su trabajo en una transacción. El motor deduplica por mensaje/flujo y limita las bienvenidas a una por minuto y contacto. Los eventos con más de cinco minutos no inician automatizaciones. Pausar cancela pendientes; reactivar crea una generación distinta. Un envío que ya está en curso puede terminar, pero se comprueba el estado antes de las acciones siguientes. «Baja», «stop» y «cancelar» detienen pendientes y acciones posteriores del contacto; un nuevo mensaje posterior puede iniciar otro recorrido conforme al límite.

El envío reutiliza la protección del destinatario de prueba, ventana real de 24 horas e identificador idempotente. Un resultado incierto o un trabajo interrumpido no se reintentan automáticamente. Antes del envío se comprueba capacidad de etiquetas y pertenencia del asesor. El historial distingue cola, ejecución, completado, cancelado, error e interrupción; completado no equivale a entrega de WhatsApp, que se consulta en Conversaciones. Los trabajos se depuran a 90 días. No hay campañas ni seguimientos programados en esta fase.

Prueba específica: `node --test app-crm/test/flows.test.js`. Guardar/activar/pausar requieren los mismos controles de sesión, empresa, rol, origen y CSRF del CRM. El guardado exige la revisión actual para impedir que otra pestaña sobrescriba el borrador.

Node.js 22.13+ (SQLite integrado; aviso experimental en Node 22). Nodemailer está fijado en package-lock.json para el correo transaccional. HTTP escucha solo en 127.0.0.1:3031. Caddy enruta `/app`, `/app/*`, `/api/crm/*` y `/webhooks/whatsapp` a ese puerto; la demo continúa en las rutas existentes.

```powershell
npm --prefix app-crm ci --ignore-scripts
node --test app-crm/test/platform.test.js app-crm/test/daily-workflow.test.js app-crm/test/ui-send.test.js app-crm/test/recovery.test.js app-crm/test/recovery-races.test.js
node --check app-crm/public/app.js
```

La configuración se prepara fuera de Git mediante las variables del archivo .env.example. Producción: /etc/lazo-crm.env, solo root; SQLite y su WAL en /var/lib/lazo-crm, propietario del servicio. La clave maestra AES debe conservarse en el respaldo privado de administración: perderla impide descifrar las conexiones.

La unidad endurecida ejecuta código de /opt/lazo-crm/current. Las releases no contienen DB ni secretos. Antes de cambiar la release, generar un respaldo consistente de SQLite; conservar la release anterior y validar Caddy antes de recargar. Una recuperación de código cambia el enlace current y reinicia solo lazo-crm. Restaurar datos es una operación distinta y exige detener el servicio, conservar copia del estado actual y revisar la integridad de la copia.

El temporizador crea un respaldo diario consistente y conserva siete días en /var/backups/lazo-crm. Las copias cifradas fuera del VPS se descargan a la computadora del propietario y se comprueban de forma aislada; ver [Respaldos en Windows](../docs/RESPALDOS-PC.md). Requieren conservar el perfil de Windows y que el equipo esté encendido con sesión y red. Los mensajes y eventos operativos se depuran a 90 días; una copia diaria anterior puede conservarlos hasta siete días adicionales durante la rotación.

## Archivos y métricas

Los adjuntos se guardan cifrados en SQLite, con contexto de empresa y archivo, por lo que el respaldo consistente existente también los incluye. No tienen URL pública: cada descarga exige sesión y contexto de empresa y se obtiene a través del mensaje asociado. El PDF se descarga; no se ejecuta ni se incrusta como HTML. Los formatos distintos de JPG, PNG y PDF siguen identificándose por tipo.

Los medios entrantes compatibles se descargan automáticamente en segundo plano. Se comprueban la propiedad del número en Meta, la ubicación HTTPS de descarga, MIME, tamaño y SHA-256 antes de conservar el contenido. Los identificadores de medios entrantes de Meta caducan a los siete días; por eso se obtiene una copia privada al recibirlos. Si no se pudo descargar a tiempo, el contacto debe reenviarlos. Referencia: [API de medios de Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media).

Límites iniciales: 256 MB por empresa y 1 GB para la instancia, contando también reservas de descargas pendientes. Hasta dos cargas y dos descargas simultáneas. Los archivos se depuran junto a sus mensajes a los 90 días. Estos límites protegen el espacio del VPS y pueden ampliarse con una revisión de capacidad.

Los archivos, al igual que el texto libre, requieren un mensaje entrante del contacto en las últimas 24 horas; fuera de esa ventana se utiliza una plantilla aprobada. Se mantienen el destinatario de prueba, la firma del webhook y las claves idempotentes. Un archivo adjunto no se envía al seleccionarlo.

Las métricas se calculan en el servidor sobre todos los registros de la empresa, no sobre los primeros 1.000 contactos visibles. Un envío aceptado por Meta no se cuenta como entregado hasta recibir su estado. El tiempo de respuesta considera el primer envío aceptado tras cada grupo consecutivo de mensajes entrantes. No incluye intentos fallidos o inciertos como respuestas.

El historial de movimientos de ventas empieza al instalar esta versión. Se cuentan contactos que pasan a la etapa ganada durante el periodo, sin inventar fechas históricas para contactos anteriores. Los gráficos de etapas y la distribución del equipo muestran el estado actual; no son un registro de ingresos.

Seguridad: scrypt asíncrono, límite de intentos y concurrencia, sesiones almacenadas por hash, cookies HttpOnly/Secure/SameSite, control de origen y CSRF, consultas SQL parametrizadas y filtradas por empresa, AES-256-GCM con empresa como contexto, ninguna credencial en respuestas públicas o logs. Los usuarios administradores pueden ver el token de verificación de su empresa; los asesores no pueden ver ni cambiar su conexión.

Pruebas automatizadas utilizan Meta simulada. Separar esos resultados de la prueba contra la cuenta real. Antes de declarar completa la conexión: comprobación de credenciales, challenge de Meta, suscripción a mensajes, recepción real y confirmación de estados del envío de prueba.

La sección **Conexiones** está disponible para propietarios y administradores en `/app/?view=connections`. Permite guardar y renovar credenciales de WhatsApp Cloud API, comprobar el acceso al número dentro de la WABA y consultar la verificación del webhook y su último evento. El token y el secreto nunca se devuelven al navegador; un campo vacío conserva la credencial anterior. La pantalla protege los formularios frente a respuestas tardías y cambios de empresa.

Actualmente hay una conexión por empresa. Sus identificadores no se pueden reemplazar: así el historial y los flujos permanecen asociados al número original. El propietario puede crear un espacio separado desde Conexiones y configurar otra API allí, conservando el primero. Los envíos conservan la restricción de destinatario de prueba de esta instalación; conectar credenciales no habilita envíos comerciales generales ni activa flujos automáticamente. No se implementan todavía bandeja con varios números, QR ni migración desde otro proveedor. La comprobación manual de permisos no registra ni traslada números.

### Conectar con Meta: configuración de LAZO

La opción principal usa **Embedded Signup v4**. El cliente inicia sesión en una ventana oficial de Meta y elige los activos que Meta permita compartir. LAZO intercambia inmediatamente el código de autorización en su servidor, comprueba la aplicación y los permisos, valida la pertenencia del número y suscribe la app a la cuenta. No pide al cliente el token ni el secreto de LAZO. El formulario manual queda plegado como opción avanzada.

Preparación única del propietario de la plataforma:

1. En la app de Meta, comprobar por separado **Revisión de la app** y **Verificación de acceso**; una solicitud enviada no equivale a aprobación. Para clientes externos se necesitan el estado de proveedor y acceso avanzado a `whatsapp_business_management` y `whatsapp_business_messaging`.
2. Abrir **Facebook Login for Business → Configuraciones**, crear una configuración **Embedded Signup v4** y seleccionar **Cloud API**. No añadir publicidad, catálogos u otros productos que LAZO no use. Copiar su ID público de configuración.
3. En los ajustes de inicio de sesión, permitir el dominio `https://lazo.espacio-sereno.com` y la URI HTTPS `https://lazo.espacio-sereno.com/app/`, con inicio OAuth web, SDK JavaScript, HTTPS y modo estricto habilitados según la documentación de Meta.
4. Configurar el webhook de la app de LAZO y los campos `messages` y `account_update`. El servidor valida firmas; los eventos que no son de mensajes se aceptan sin crear contactos ni mensajes. Debe existir una conexión de proveedor con webhook verificado y el mismo secreto central antes de habilitar el botón.
5. Guardar únicamente en `/etc/lazo-crm.env` las variables `LAZO_META_APP_ID`, `LAZO_META_CONFIG_ID`, `LAZO_META_APP_SECRET` y `LAZO_META_GRAPH_VERSION`. No introducirlas por chat ni Git. El secreto pertenece a LAZO, no a cada cliente. Reiniciar el servicio y comprobar el estado desde Conexiones.

Los intentos duran diez minutos, quedan vinculados a sesión, usuario y empresa y desaparecen al reiniciar. Códigos usados, respuestas de una pestaña o intento anterior, aplicación incorrecta, permisos ausentes o cambios concurrentes no pueden sustituir la conexión. Los tokens temporales quedan cifrados en memoria. Solo se cargan el SDK de Meta y sus orígenes HTTPS explícitos; no se permite JavaScript inline ni eval.

Un número `CONNECTED` de Cloud API no se vuelve a registrar. Si Meta devuelve `PENDING`, LAZO pide confirmar un PIN de seis dígitos para el registro; un resultado de registro incierto invalida el intento y no se reintenta automáticamente. La coexistencia con WhatsApp Business del celular y los finales sin número se rechazan o no finalizan esta primera implementación. Confirmar la suscripción no prueba entrega: falta un mensaje entrante real y verificar sus estados. El cliente puede necesitar un método de pago en Meta. Las cuentas creadas originalmente desde la app de desarrollador pueden no estar disponibles en el selector de Meta.

Fuentes oficiales: [implementación](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation), [v4](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/version-4), [alta para Tech Providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider) y [estado de números](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers). La disponibilidad no acredita aprobación de Meta: depende también de la configuración y de una prueba real con la cuenta del usuario.
