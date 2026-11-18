# Recuperación de acceso e invitaciones de LAZO

El correo transaccional usa la cuenta existente de Zoho Mail. La configuración
es del operador de la plataforma, mediante SSH y un formulario privado en su PC;
no existe una API para que las empresas clientes cambien el remitente o sus secretos.

## Activar el correo

1. Abrir el formulario **LAZO · Correo privado de Zoho** preparado en la computadora.
2. Elegir el servidor SMTP que muestra la configuración de la cuenta Zoho y confirmar
   el correo remitente. `smtppro` corresponde a organizaciones de pago; no asumirlo
   por usar un dominio propio. El formulario usa TLS en el puerto 465.
3. Crear una contraseña de aplicación de Zoho e introducirla únicamente en ese
   formulario. No usar el chat, Git ni capturas para comunicarla.
4. Pulsar **Guardar y comprobar conexión segura**. Se comprueban TLS y autenticación;
   se actualizan solo las variables SMTP del entorno privado de LAZO y se reinicia
   únicamente su servicio. Si el reinicio falla, se intenta recuperar el entorno anterior.
5. Comprobar un correo real mediante **Olvidé mi contraseña**. Aceptar la conexión
   SMTP no demuestra que un mensaje haya llegado a la bandeja.

La contraseña se transmite por SSH al VPS y a Zoho para autenticar; permanece en
el archivo de entorno del servicio, privado `0600`. Las copias cifradas incluyen
ese entorno para recuperación. El formulario no guarda una copia local en texto plano.
Los hosts admitidos están limitados a SMTP oficial de Zoho (.com, .eu, .in y .com.au).
Si la cuenta indica otro centro de datos, ampliar la lista con documentación oficial;
no sustituirlo silenciosamente por otra región o proveedor.

## Recuperar una cuenta

En la página de acceso, **Olvidé mi contraseña** permite solicitar un enlace.
La respuesta es igual para cuentas existentes y desconocidas, incluso con el
correo deshabilitado. Hay límites por IP y dirección normalizada. El operador
puede saber si el correo está activado en Ajustes; una solicitud aceptada no
garantiza la entrega.

El enlace contiene un valor aleatorio de 256 bits, de un solo uso y 15 minutos
de duración. La base guarda su hash; el correo pendiente se cifra con la clave
maestra y se elimina su contenido tras el intento. El token va en el fragmento
de URL y se retira de la barra al abrir. Se usa el origen fijo configurado, no
un Host aportado por el visitante. No se bloquea ni cambia la contraseña al pedirlo.

Al guardar la nueva contraseña se consume el enlace dentro de una transacción,
se invalidan los demás enlaces del usuario y se cierran todas sus sesiones en
todas las empresas. No se inicia sesión automáticamente. Se prepara una
notificación de cambio, sin incluir la nueva contraseña.

## Invitar a un colaborador

En Ajustes, el propietario o administrador puede marcar **Enviar también por
correo**. Se mantienen los permisos anteriores: un administrador solo invita
asesores; solo el propietario invita administradores. La invitación dura 48 horas.
Al emitir otra para el mismo correo/empresa se invalida la anterior.

El enlace privado sigue disponible como alternativa. El estado del correo se
consulta solo por administradores de esa empresa; los asesores y otras empresas
no acceden a él. **Aceptado por Zoho** no equivale a entrega en la bandeja.

La cola distingue pendientes, en proceso, aceptados, rechazados, caducados y
envíos sin confirmación. Un envío ambiguo no se repite automáticamente. Los
pendientes sobreviven a un reinicio normal; los que estaban en proceso pasan a
sin confirmación. Los registros se purgan a los siete días y los cuerpos se
descartan tras el intento o caducidad. No se registran tokens ni errores SMTP completos.

Antes de reabrir una base restaurada de una copia antigua, invalidar sesiones,
enlaces de recuperación/invitación y correos pendientes: restaurar una instantánea
no debe reactivar enlaces consumidos o reenviar invitaciones anteriores. Esa
operación pertenece a una restauración real autorizada, no al verificador aislado.

Fuentes: [SMTP oficial de Zoho](https://www.zoho.com/mail/help/zoho-smtp.html),
[recomendaciones de recuperación de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html),
[transporte SMTP de Nodemailer](https://nodemailer.com/smtp).
