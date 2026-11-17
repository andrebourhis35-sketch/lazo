# LAZO CRM

Primera plataforma con cuentas por empresa, independiente de la demo estática y de la app que está en revisión de Meta. Acceso: https://lazo.espacio-sereno.com/app/.

## Funciones

- Propietario, administrador y asesor. Cada sesión elige una empresa de la que el usuario es miembro. Invitaciones privadas válidas 48 horas y de un solo uso. No se envían correos automáticamente.
- Contactos, conversaciones, notas internas, asignación y cuatro etapas comerciales guardadas en SQLite. Se muestran hasta 1.000 contactos y los 100 mensajes más recientes por contacto.
- Conexión WhatsApp por empresa: token cifrado en el servidor, validación del número dentro del WABA y envío de plantillas aprobadas o texto dentro de la ventana de 24 horas desde el último mensaje entrante real.
- Webhook de mensajes y estados con firma SHA-256, deduplicación e historial de estados que no retrocede al recibir eventos atrasados. Los adjuntos recibidos se identifican por tipo; no se descargan ni se pueden enviar archivos en esta versión.
- Destinatario de prueba limitado en el servidor. Una aprobación de Meta no se presupone ni se produce por desplegar esta plataforma. El alta comercial de clientes mediante Embedded Signup sigue siendo una fase posterior.

## Activación privada

El propietario recibe en su equipo un enlace privado con fragmento `#setup=...`. No pegarlo en Git ni compartir capturas. Al abrirlo, la app retira el fragmento de la barra y solicita empresa, nombre, correo y contraseña de al menos 12 caracteres. El enlace solo funciona una vez.

En Ajustes → WhatsApp, el propietario completa el secreto de su app directamente en el formulario. Un token existente se conserva al dejar su campo vacío. Guardar y comprobar valida la cuenta con Meta. Configurar en Meta la URL de devolución de llamada que muestra la app y su token de verificación, seleccionar el campo `messages` y vincular la app a la cuenta de prueba. La recepción real se confirma solo cuando un mensaje enviado desde WhatsApp aparece en la bandeja.

Nunca pedir ni pegar tokens, contraseñas o secretos por chat. Para cambiar el acceso del propietario ante una pérdida de contraseña, usar soporte administrativo del servidor y verificar la identidad; no existe recuperación por correo en esta versión.

## Implementación y pruebas

Node.js 22.13+ (SQLite integrado; aviso experimental en Node 22). Sin dependencias npm. HTTP escucha solo en 127.0.0.1:3031. Caddy enruta `/app`, `/app/*`, `/api/crm/*` y `/webhooks/whatsapp` a ese puerto; la demo continúa en las rutas existentes.

```powershell
node --test app-crm/test/platform.test.js
node --check app-crm/public/app.js
```

La configuración se prepara fuera de Git mediante las variables del archivo .env.example. Producción: /etc/lazo-crm.env, solo root; SQLite y su WAL en /var/lib/lazo-crm, propietario del servicio. La clave maestra AES debe conservarse en el respaldo privado de administración: perderla impide descifrar las conexiones.

La unidad endurecida ejecuta código de /opt/lazo-crm/current. Las releases no contienen DB ni secretos. Antes de cambiar la release, generar un respaldo consistente de SQLite; conservar la release anterior y validar Caddy antes de recargar. Una recuperación de código cambia el enlace current y reinicia solo lazo-crm. Restaurar datos es una operación distinta y exige detener el servicio, conservar copia del estado actual y revisar la integridad de la copia.

El temporizador crea un respaldo diario consistente y conserva siete días en /var/backups/lazo-crm. Son respaldos locales al VPS; no protegen frente a pérdida total del servidor. Los mensajes y eventos operativos se depuran a 90 días; una copia diaria anterior puede conservarlos hasta siete días adicionales durante la rotación.

Seguridad: scrypt asíncrono, límite de intentos y concurrencia, sesiones almacenadas por hash, cookies HttpOnly/Secure/SameSite, control de origen y CSRF, consultas SQL parametrizadas y filtradas por empresa, AES-256-GCM con empresa como contexto, ninguna credencial en respuestas públicas o logs. Los usuarios administradores pueden ver el token de verificación de su empresa; los asesores no pueden ver ni cambiar su conexión.

Pruebas automatizadas utilizan Meta simulada. Separar esos resultados de la prueba contra la cuenta real. Antes de declarar completa la conexión: comprobación de credenciales, challenge de Meta, suscripción a mensajes, recepción real y confirmación de estados del envío de prueba.
