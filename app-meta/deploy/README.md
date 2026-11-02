# Preparación de una instancia de revisión de Meta

Esta propuesta es solo para la app de `app-meta/`. El sitio público de LAZO y los demás servicios del VPS siguen en sus rutas actuales. Los archivos de esta carpeta son plantillas; no implican que la instancia esté instalada ni accesible.

La app escucha únicamente en `127.0.0.1:3027`. El servicio arranca con `--review`, que obliga a configurar un único destinatario de prueba y rechaza cualquier otro número antes de llamar a Meta. La app sigue sin tener autenticación propia: **no debe publicarse sin una puerta de acceso HTTPS autenticada**. El ejemplo de Caddy requiere un archivo de autenticación separado y no incluye contraseñas ni hashes reales.

El límite de destinatario solo protege el envío de mensajes: quien acceda puede consultar y crear plantillas de toda la cuenta de WhatsApp Business configurada. La instancia debe usar exclusivamente una cuenta de prueba y un token de prueba con el menor alcance posible. No existe límite de frecuencia integrado; hay que supervisar su uso y desactivar la instancia y las credenciales al terminar. Otros procesos del mismo VPS pueden conectar al puerto local, por lo que el acceso protegido externo no sustituye el aislamiento de los demás servicios.

Antes de publicar, un operador debe:

1. Verificar que la cuenta y el número emisor sean los de prueba y que el destinatario de prueba esté permitido por Meta. Utilizar credenciales de prueba y confirmar su vencimiento; no copiar valores al repositorio ni al chat.
2. Colocar el entorno privado en `/etc/lazo-meta-review.env` con propietario root y permisos `0600`. Debe incluir las cuatro variables de `.env.example` y `LAZO_REVIEW_RECIPIENT` como número internacional de 8 a 15 dígitos sin `+`. El servicio fija el puerto y `--review` impone la restricción.
3. Instalar la aplicación en una versión de solo lectura en `/opt/lazo-meta-review/current`, crear un usuario de sistema sin privilegios y configurar el servicio con Node 22 ya disponible en este VPS. Validar las rutas y la configuración real antes de habilitarlo.
4. Crear fuera de Git `/etc/caddy/lazo-meta-review-auth.caddy`, legible por Caddy, con autenticación HTTP Basic y una contraseña de prueba larga y aleatoria guardada de forma privada. Limitar su vigencia y retirarla al acabar la revisión. No usar contraseñas de cuentas personales.
5. Añadir únicamente el nuevo bloque de revisión al Caddyfile existente, conservar los otros bloques y sus respaldos, verificar `caddy validate` y solo después recargar. Configurar la resolución del dominio elegido sin cambiar registros existentes. Mantener HTTPS y no publicar el puerto interno.
6. Probar desde fuera que sin credenciales la interfaz y los endpoints devuelven `401`, que con la cuenta de revisión cargan por HTTPS, que un destinatario distinto se rechaza sin llamada a Meta y que el sitio público y otros servicios continúan funcionando. Validar el certificado y el DNS reales, no solo con `--resolve`.
7. Añadir a Meta únicamente la URL y las credenciales de prueba necesarias para los revisores, mediante su formulario privado. Confirmar que los videos no revelan tokens y que el destinatario de prueba pueda recibir el mensaje de demostración. Al finalizar, desactivar la instancia y revocar las credenciales de revisión.

La disponibilidad de la URL, las ubicaciones reales de tratamiento de datos, los permisos requeridos de Meta y los proveedores se deben verificar antes de completar la solicitud. Un sitio estático publicado no demuestra que la app de WhatsApp esté alojada o en uso.
