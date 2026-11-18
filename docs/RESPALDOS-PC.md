# Copias cifradas de LAZO en Windows

Destino elegido por el propietario: su computadora, sin contratar otro servicio.
Los scripts se encuentran en `app-crm/deploy/`; los archivos privados de ejecución
se instalan fuera del repositorio y de OneDrive.

## Qué contiene la copia

- Una instantánea consistente de SQLite, incluidos los cambios del WAL y adjuntos.
- El archivo de entorno exclusivo de LAZO, que contiene la clave maestra necesaria
  para recuperar las conexiones cifradas. Todo el paquete se cifra antes de salir del VPS.
- Un manifiesto con versión del formato, release y SHA-256 de los dos archivos.

No incorpora bases, secretos o configuraciones de otras aplicaciones.
El código se conserva en Git; el manifiesto identifica el release del servidor.

## Instalación preparada para este equipo

- Herramientas, configuración y clave protegida: `%LOCALAPPDATA%\LAZOBackup`.
- Copias: `C:\Users\acer\Documents\LAZO\CopiasCifradas`.
- Ambas carpetas tienen acceso limitado al usuario de Windows y SYSTEM.
- age para Windows se obtiene de la publicación oficial y se comprueba con su SHA-256.
- La clave privada de age se protege con DPAPI `CurrentUser`; nunca se escribe en texto plano.
  El VPS recibe únicamente su destinatario público.
- El exportador root tiene rutas fijas de LAZO y un bloqueo; los archivos cifrados
  de descarga son de solo lectura para el grupo del usuario SSH existente.
- La descarga usa el host SSH y la clave ya configurados para OVH, con comprobación
  estricta de su clave de host. Comprueba tamaño y SHA-256 antes de darla por terminada.

La tarea **LAZO - Copia cifrada OVH** se ejecuta a las 09:00 de la zona horaria de
Windows y al iniciar sesión. Requiere sesión iniciada y conexión; no guarda una
contraseña de Windows ni enciende la computadora. `StartWhenAvailable` permite
recuperar una ejecución pendiente cuando esté disponible. Solo ejecuta una instancia.

Se conservan siete días de exportaciones regulares. La rotación local ocurre
después de una descarga correcta y no borra otros archivos ni enlaces simbólicos.
`estado.json` muestra el resultado de la descarga; `verificacion.json`, el de la
última prueba de recuperación. Descargar no equivale a haber probado la restauración.

## Uso con PowerShell

Para descargar manualmente, desde la carpeta de herramientas privada:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "$env:LOCALAPPDATA\LAZOBackup\backup-windows.ps1" -ConfigPath "$env:LOCALAPPDATA\LAZOBackup\config.json"
```

Para comprobar una recuperación **aislada**, sin sustituir la base activa:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "$env:LOCALAPPDATA\LAZOBackup\verify-backup-windows.ps1" -ConfigPath "$env:LOCALAPPDATA\LAZOBackup\config.json"
```

La segunda orden descifra en una carpeta temporal privada, verifica los hashes y
SQLite, y comprueba que la clave maestra puede abrir conexiones y adjuntos. No
contacta a Meta ni envía mensajes. Después elimina la extracción temporal; el
archivo `.age` permanece cifrado.

## Recuperar después de perder el VPS

Primero ejecutar la comprobación aislada. Conservar el release indicado en el
manifiesto, restaurar la base y el entorno solo en un servidor nuevo o detenido,
con permisos privados, instalar el código de ese release y comprobar salud,
acceso y firma del webhook antes de reabrir el tráfico. Una restauración real
requiere una operación separada; los scripts de comprobación no la realizan.

DPAPI depende de este perfil de Windows. Perder el perfil o la computadora puede
impedir descifrar sus copias; migrar de equipo requiere exportar la clave de
recuperación de forma privada mientras el perfil actual siga disponible. No
copiar `identity.dpapi` a otro usuario esperando que pueda abrirlo. Nunca pegar
claves o contenido de copias en el chat, en Git o en capturas.

Fuentes: [age oficial](https://age-encryption.org/),
[DPAPI de Windows](https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata).
