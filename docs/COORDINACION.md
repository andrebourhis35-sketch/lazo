# Coordinación Codex y Claude

### Operación de ventas en LAZO (23 de noviembre de 2026)

- Reserva: CRM, motor de pedidos y editor de flujos; rama codex/operacion-ventas. Catálogo por empresa con variantes por mercado, chat con oferta y ficha de pedido, bandeja por cobro/verificación/entrega, lectura de comprobantes por IA y diagnóstico de flujos.
- QA en navegador con una empresa de prueba: alta de oferta, filtro Por verificar, apertura del pedido exacto desde Ventas, oferta copiada en el editor y bloque Inicio marcado cuando la simulación no coincide. Prueba aislada de importes congelados, duplicados, permisos, lectura de imagen y entrega manual sin contactar proveedores reales.

### Globo de ventas con giro fluido (23 de noviembre de 2026)

- Codex, rama codex/globo-fluido. Reserva del globo, panel de ventas y versiones de sus recursos. Se amplía el planeta y se reduce el ancho de su panel; giro automático, arrastre con inercia y enfoque fijo al filtrar un país.
- QA con datos ficticios: a 1876 × 918, lienzo de 420 × 420 y tarjeta de 600 px; a 390 × 844, lienzo cuadrado sin desbordamiento. En navegador se verificó giro automático, movimiento al arrastrar, inercia tras soltar y filtro de Panamá.

- Publicado globe-78169b6 en OVH con respaldo previo y 86 pruebas aprobadas. Salud correcta y cinco recursos de la versión comprobados por SHA-256 sobre HTTPS público. PR #70.

### Globo en Ventas (23 de noviembre de 2026)

- Codex, rama codex/globo-ventas. Sustituye el mapa plano por un globo giratorio con iluminación y relieve visual. Los países con pedidos conservan su color; seleccionar un país lo centra en el globo.
- Publicado globe-dfcd4ae con respaldo previo y 86 pruebas aprobadas en OVH. Se verificaron por SHA-256 los seis recursos en HTTPS público. En navegador con datos ficticios se comprobó el giro, el filtro de Panamá y el botón para volver a América. PR #69.

### Panel de ventas por moneda y país (23 de noviembre de 2026)

- Codex, rama codex/panel-ventas. Resumen de pedidos con cobros confirmados y pendientes por moneda, filtros, mapa parcial por prefijo telefónico identificado y pedidos recientes. Conserva el embudo. Cartografía mundial Natural Earth 1:110m v5.1.2 de dominio público.

- Publicado sales-panel-61e61e1 con respaldo cifrado y 86 pruebas aprobadas. HTTPS verificó los cinco recursos y el endpoint de ventas sin sesión devolvió 401. QA con pedidos ficticios confirmó separación PEN/USD, filtro Panamá, retorno desde el embudo y ancho móvil sin desborde. PR #68.

### Bandeja global legible (23 de noviembre de 2026)

- Codex, rama codex/bandeja-global-legible. Filtro de conexiones con contraste y nombre legible, explicación de la bandeja, filas más claras y cabecera compacta. El sondeo no reemplaza el filtro ni las filas cuando los datos permanecen iguales.

- Publicado overview-2feacdf con respaldo cifrado y 85 pruebas aprobadas. HTTPS confirmó las huellas. QA con dos conexiones ficticias confirmó contraste, filtrado por conexión y apertura del chat en su espacio de origen. PR #67.

### Tamaño de los mensajes por cuenta (23 de noviembre de 2026)

- Codex, rama codex/tamano-texto-crm. Ajustes ofrece cuatro tamaños de lectura, con vista previa. Preferencia personal por usuario, común a sus espacios. Valor inicial de 15 px.

- Publicado reading-1d3cbc5 con respaldo cifrado y 85 pruebas aprobadas. HTTPS confirmó las huellas del HTML, JS y CSS. En una sesión ficticia se guardó 14 px, se recargó la página y se midió el mismo tamaño en el historial. PR #66.

### Historial amplio en Conversaciones (23 de noviembre de 2026)

- Codex, rama codex/chat-historial-amplio. La ficha se abre bajo demanda. La bandeja se puede ocultar en escritorio. Historial con texto mayor, cabecera unificada y compositor más bajo. Conserva Órbita y la edición del contacto.

- Publicado history-08c8f03 tras respaldo cifrado y 85 pruebas del CRM aprobadas. HTTPS verificó cuatro huellas. QA en navegador con datos ficticios: a 1280 × 720 el historial mide 382 px de alto y 814 px de ancho, 1042 al ocultar la bandeja. Mensajes de 16 px. Ficha flotante, plantilla y móvil de 390 × 844 comprobados. PR #65.

### Lienzo de flujos a ancho completo (23 de noviembre de 2026)

- Codex, rama codex/lienzo-amplio. Se retiran las columnas fijas del editor. Biblioteca y propiedades quedan en paneles bajo demanda. Se compacta la barra y se ajusta el flujo al abrir el lienzo. Solo se publica el sitio estático de flujos.

- Publicado canvas-0ced16e. Pasaron 11 pruebas del editor, compilación y diagnóstico Astryx. HTTPS confirmó las huellas. Verificación en navegador a 1280 × 720: lienzo de 1280 × 633, biblioteca y propiedades abren y cierran sin cambiar el tamaño. PR #64.

### Infoproductos y abonos (23 de noviembre de 2026)

- Codex, rama codex/venta-infoproductos. Añadidos bloques de venta, cobro, confirmación por el equipo y entrega por enlace. El archivo recibido se vincula al pedido para revisión. La comprobación en cuenta y la referencia se registran por separado. Plantillas de pago anticipado y contra entrega, y botón para insertar un bloque en una conexión del lienzo.

- Publicado sales-02e954c en OVH tras respaldo cifrado. Pasaron 85 pruebas del CRM y 11 del editor. HTTPS verificó huellas de los recursos y la ruta de pedidos respondió 401 sin sesión. En navegador, el menú Venta/Pago/Entrega apareció y el botón de conexión insertó una espera correctamente, sin guardar el borrador. PR #63. Los flujos conservan el modo de cuenta de prueba. No se conectó banco ni pasarela.

### Agente IA y espera real (22 de noviembre de 2026)

- Codex, rama codex/agente-ia-flujos. Se añade el agente con información del negocio, una aclaración y salida a un asesor. La clave de API se guarda cifrada por espacio y el propietario activa el uso. Espera fija ejecuta el siguiente bloque después de la pausa aunque haya respuesta. Esperar sin respuesta sigue siendo un recordatorio que se cancela al intervenir el cliente o el equipo.

- Publicado ai-wait-9bf52e5 en CRM y editor con respaldo cifrado. Pasaron 84 pruebas del CRM y 11 del editor. Los recursos públicos coinciden por SHA-256 y la configuración de IA sin sesión devuelve 401. Las pruebas usaron un proveedor simulado y adelantaron el vencimiento de la espera. PR #62.

### Flujos avanzados y bandeja global (22 de noviembre de 2026)

- Codex, rama codex/flujos-avanzados. Editor, motor, almacenamiento, API y CRM. Menús encadenados y retorno, seguimiento por inactividad, traspaso, historial por contacto y vista global de números autorizados. Cada chat permanece en su espacio de origen y todas las automatizaciones reales conservan la restricción de cuenta de prueba.

- Publicado advanced-225365b en OVH tras respaldo cifrado y 82 pruebas del CRM aprobadas. El editor pasó 11 pruebas y su diagnóstico de Astryx. HTTPS público confirmó las huellas de los recursos y el acceso sin sesión a la bandeja devolvió 401. En Brave se comprobaron los nuevos bloques y una simulación pública. La sesión de Brave no estaba iniciada. La prueba real de los menús en WhatsApp queda pendiente. PR #61.

### Tercera opción en los flujos (22 de noviembre de 2026)

- Codex, rama codex/tercer-boton. Editor, modelo, ejecución y prueba de integración amplían los menús a dos o tres opciones. El ejemplo nuevo incluye «Consultar pedido». Los borradores y ejecuciones con dos botones siguen siendo compatibles.

- Publicado third-df99e3d en CRM y editor con respaldo cifrado. 78 pruebas del CRM y 11 del editor aprobadas. Salud del servicio y huellas de HTML, JS y CSS verificadas por HTTPS. PR #60. Prueba de WhatsApp real pendiente.

### Bienvenida con botones (22 de noviembre de 2026)

- Codex, rama codex/flujos-botones. Cambios en modelo, motor y transporte de flujos, pruebas de integración y editor visual. El borrador inicial de un flujo nuevo ofrece dos botones editables. Cada botón lleva a su propia rama y se valida contra el menú original y el contacto. Pausar o cambiar la versión cancela menús pendientes. Se conserva la activación en cuenta de prueba. Pruebas con webhook firmado y Meta simulado para ambas ramas, contexto incorrecto y respuestas repetidas.

- Publicado buttons-ed3e332 en el CRM y el editor de OVH. 78 pruebas del CRM y 11 del editor aprobadas. Respaldo cifrado previo y salud verificada. HTML y recursos del editor verificados por HTTPS y SHA-256. PR #59. El ejemplo queda disponible en Nuevo flujo. Falta la prueba con un toque desde WhatsApp real.

### Conversaciones compactas y respuesta visible (20 de noviembre de 2026)

- Usuario confirma envío y recepción desde el nuevo número y solicita reducir el tamaño de la interfaz: el historial queda pequeño y no se distingue dónde responder. Reserva: app-crm/public/app.js, presentación visual y versiones de recursos, documentación y este tablero; rama codex/chat-compacto, responsable Codex. Medición real en Chrome a 1482×734: encabezado 194 px, compositor 306,5 px e historial solo 96 px, bandeja fuera del alto visible. Compactar exclusivamente Conversaciones, conservar Órbita/animaciones y funciones de envío, y verificar escritorio/móvil antes de publicar. No modificar credenciales ni envíos reales durante QA.

- Implementado CSS exclusivo de Conversaciones, encabezado reducido a 72 px y compositor con etiqueta visible Tu respuesta, borde y fondo propios. QA en Chrome: a 1482x734 el historial aumenta de 96 a 247 px y la bandeja cabe completa; 1280x800 y 1100x768 con ficha flotante; 390x844 sin desborde horizontal, historial de 330 px y campo/Enviar visibles. Cinco pruebas dirigidas aprobadas, sintaxis y diff limpios; revisión independiente apta tras corregir ficha en breakpoint 1300 y alcance de selectores de navegación. Publicación chat-b61a284 en OVH tras 77/77 pruebas Node 22, respaldo cifrado y activación atómica; salud correcta, conexiones y configuración de flujos idénticas, Caddy y entorno sin cambios. HTTPS normal desde Windows: HTML, JS y CSS 200 con huellas idénticas; sesión sin autenticar 401 y archivo de entorno 404. PR #58.

### Alta real mediante Meta confirmada (19 de noviembre de 2026)

- Tras repetir el alta, usuario vuelve a Conexiones y pregunta por el resultado. Reserva: registro en este tablero, rama codex/verificacion-alta-real, responsable Codex. Consulta de solo lectura del servidor confirma dos conexiones en total, una nueva durante los últimos 30 minutos; auditoría whatsapp.connected a las 23:00:52 UTC y whatsapp.subscribed a las 23:00:53 UTC del 19 de noviembre. La conexión de prueba anterior sigue presente. Esto acredita guardado y suscripción tras autorización real, sin imprimir credenciales ni modificar datos o configuración. Pendiente recepción real en el número nuevo: se solicita enviar Hola LAZO desde el destinatario personal usado en las pruebas. No se presume recepción, entrega de respuesta ni aprobación de revisión de Meta.
- Usuario confirma el envío. Nueva consulta de solo lectura, limitada a la empresa de la conexión más reciente: webhook posterior al alta presente y exactamente un mensaje entrante posterior al guardado. Esto confirma recepción real en el espacio nuevo. Sin enviar respuestas desde la herramienta ni cambiar credenciales, configuración o datos; entrega de una respuesta desde el CRM y aprobación de Meta siguen sin comprobar. La restricción de destinatario de prueba continúa vigente.

### Plazo del alta y protección de la conexión de prueba (19 de noviembre de 2026)

- Apertura de Meta confirmada por el usuario. Tras la selección de negocio/cuenta y espera en Meta, vuelve al CRM con el aviso literal del temporizador local de nueve minutos; la consulta de solo lectura confirma que aún existe únicamente la conexión de prueba, sin alta nueva. La captura muestra seleccionado el espacio original La Boutique du Monde. Reserva: duración del intento en servidor/cliente, explicación de espacio ocupado, pruebas y este tablero; rama codex/plazo-alta-meta, responsable Codex. Ampliar a 30 minutos y sincronizar cliente con vencimiento devuelto por servidor, renovar intentos vencidos antes de abrir el popup y conservar el intercambio inmediato del código de Meta. No reemplazar el número de prueba ni eliminar las comprobaciones de sesión/empresa.
- Implementado plazo de 30 minutos con expiresAt compartido, renovación previa de tickets vencidos sin perder clic síncrono y aviso visible de conexión existente. Dieciocho pruebas dirigidas aprobadas localmente y por revisor independiente, incluidas alta válida tras 20 minutos, rechazo tras 30 y temporizador basado en servidor. Publicado 6b024e4 en /opt/lazo-crm/releases/signup-time-6b024e4 tras 77/77 pruebas secuenciales Node 22, respaldo cifrado previo y activación atómica; sdk-full-fa11c58 conservada, salud correcta y conexiones/configuración de flujos idénticas antes/después. HTTPS público: HTML y tres módulos 200 y huellas idénticas al candidato. Caddy y entorno sin cambios. PR #56; debe repetirse el alta en espacio separado y comprobar guardado/recepción real, todavía pendientes. El código de Meta continúa intercambiándose inmediatamente; no se prolongó su validez ni se sustituyó la conexión de prueba.

### Referencia al SDK completo de Meta (19 de noviembre de 2026)

- Usuario informa que el botón queda esperando sin ventana. Inspección de Chrome: pantalla en espera, sin ventana de Meta; consola muestra bloqueo de estilos internos del SDK pero no un bloqueo de la ventana. Inspección del SDK oficial descargado de connect.facebook.net confirma objeto provisional FB.__buffer cuya función login solo encola llamadas; el SDK real sustituye ese objeto. El cargador conservaba el provisional al dispararse load del bootstrap. Reserva: public/meta-signup.js, versiones de recursos, regresión del cargador y este tablero; rama codex/meta-sdk-completo, responsable Codex. Esperar objeto real y no inicializar/guardar el provisional; probar sustitución y publicar tras revisión. No cambiar navegador, credenciales, Meta, datos ni Caddy.
- Corrección revisada independientemente: ocho pruebas UI aprobadas por el revisor; nueve dirigidas aprobadas tanto localmente como en Node 22 de OVH. Publicado fa11c58 en /opt/lazo-crm/releases/sdk-full-fa11c58, con respaldo cifrado previo, release sdk-ready-c5874f7 conservada y activación atómica. Backend src/ idéntico al anterior, dependencias sin cambios; salud correcta y conexiones/configuración de flujos conservadas. HTML y tres módulos públicos HTTP 200 y SHA-256 idéntico al candidato. Caddy y entorno sin cambios. PR #55. Se solicita al usuario recargar y probar apertura; autorización y apertura real siguen pendientes, sin atribuir éxito a las pruebas aisladas.

### Corrección de carga del SDK de Meta (19 de noviembre de 2026)

- Usuario informa que Conectar con Meta falla al cargar el SDK. Diagnóstico público GET /app/: Caddy devuelve script-src y connect-src solo self y sustituye la política del CRM que sí permite Meta; SDK oficial accesible HTTP 200 desde esta computadora. Release meta-0f8ca78 y Caddyfile con huella previa sin cambios. Reserva: diagnóstico/configuración de publicación y este tablero, rama codex/csp-sdk-meta, responsable Codex. Corregir solo la política de LAZO/CRM, conservando otros sitios, datos, entorno y revisiones de Meta; validar Caddy antes de recargar y comprobar el encabezado real por HTTPS, sin atribuir login real a la prueba de carga.
- Operador fix-caddy-sdk.py revisado independientemente y candidato validado por Caddy real antes de aplicar. La CSP estática se limita al matcher inverso de las rutas del CRM; el proxy conserva la política que entrega el backend. Copia previa privada, sustitución atómica y recarga correctas; demás bloques del archivo conservados byte a byte. Nueva huella Caddy 58d1ddaeb45f4dfb1be2df6be20641fb4e6fbf0345197a572939ca8c4451b1ec. Verificación pública desde Windows: /app/ 200 con única CSP que permite el SDK; / y /flujos/ 200 con política estática anterior; /api/crm/session 401 y /app/.env 404, ambos sin exponer datos. Sin reiniciar CRM ni cambiar datos, entorno o Meta. PR #54; queda pendiente confirmar carga en navegador y autorización real, que esta verificación HTTP no acredita.
- Segunda corrección necesaria: el SDK público actual carga módulos dependientes de forma asíncrona y no garantiza window.FB al disparar load del archivo inicial. Ampliación de reserva a public/meta-signup.js, versiones de importación y prueba de UI: esperar fbAsyncInit, conservar comprobación load cuando FB ya existe, límite de 25 segundos y recuperación tras fallo. Pendientes pruebas, revisión y publicación de esta parte; no confundir disponibilidad del SDK con autorización.
- Cargador revisado independientemente, ocho pruebas UI aprobadas por el revisor y nueve pruebas dirigidas aprobadas localmente. Release sdk-ready-c5874f7 publicada tras 74/74 pruebas secuenciales en Node 22, respaldo cifrado y activación atómica; salud correcta y conexiones/configuración de flujos idénticas antes/después. HTTPS normal: HTML y tres módulos 200 con huellas idénticas al candidato, única CSP que permite el SDK. Permanece la corrección de Caddy con huella 58d1ddaeb45f4dfb1be2df6be20641fb4e6fbf0345197a572939ca8c4451b1ec; entorno sin cambios. El usuario informó haber guardado OAuth/SDK y se comprobó visualmente su persistencia tras recargar Meta (dos interruptores activos, URI y dominio presentes). Sigue pendiente comprobar la carga completa en el navegador del CRM y el login real; no se declara conexión nueva ni aprobación de Meta.

### Vinculación de la configuración de Meta (19 de noviembre de 2026)

- Usuario crea la configuración que Codex dejó preparada en el asistente de Meta: LAZO · WhatsApp Cloud API, registro insertado v4, solo Cloud API, token de usuario del sistema de 60 días y permisos whatsapp_business_management/whatsapp_business_messaging. El diálogo confirma creación y devuelve ID público 1624576328867502. Reserva de este tablero en rama codex/configuracion-meta-alta, responsable Codex. Pendientes vinculación privada en servidor, ajustes OAuth/SDK y prueba real. No declarar aprobado el acceso de clientes por haber creado la configuración.
- Configuración vinculada en /etc/lazo-crm.env con los cuatro campos del proveedor, reutilizando en memoria el secreto cifrado de la única conexión verificada. Meta confirmó la correspondencia del secreto con la app 1542490610948026; sin imprimir credenciales ni guardarlas en Git. Operador temporal revisado independientemente, con copia previa privada 0600, respaldo cifrado y restauración comprobable ante fallo. Reinicio de lazo-crm y salud correctos; filas de conexiones y configuración de flujos idénticas antes/después. Solo se modificó el entorno del servidor. Computer Use confirmó además persistencia del ID en la lista de Meta; los ajustes OAuth/SDK se dejaron al usuario por la restricción de la herramienta sobre cambios de seguridad. Respuesta a esos ajustes y login real siguen pendientes; no se atribuye autorización completa ni aprobación de la revisión de Meta.

### Alta oficial con Meta (19 de noviembre de 2026)

- Usuario aclara que espera autorización de Meta y selección de activos, sin introducir credenciales manualmente. Reserva: app-crm/src/embedded-signup.js, rutas/configuración, recepción del SDK y presentación Conexiones, pruebas, documentación y este tablero; rama codex/alta-meta-oficial. Responsable: Codex. Implementar Embedded Signup v4 con intercambio de código solo en servidor, intentos limitados y vinculados a sesión/empresa, comprobación de activos y secreto central del proveedor. Conservar la conexión de prueba y restricciones de envío. Falta confirmar/crear el ID de configuración Facebook Login for Business en la app de Meta; no confundir código preparado con alta real completada.
- Implementados SDK oficial y ventanas de autorización, intercambio inmediato del código exclusivamente en servidor, validación de app/permisos/activos, PIN solo para estado PENDING y suscripción. Nonce por sesión/usuario/empresa, cifrado temporal, bloqueo por número, control de generaciones de UI y protección frente a respuestas inciertas. Conexión manual plegada y estado pendiente honesto. Revisión independiente final apta; 71 pruebas aprobadas y una omitida en Windows, 13 específicas repetidas por el revisor. Comprobada únicamente la presencia de variables en el entorno de OVH: faltan las cuatro de Embedded Signup; no se leyeron valores ni se modificó Meta. El estado actual de ambas solicitudes de Meta sigue sin confirmar. Pendientes validación Node 22 y publicación; sin login real ni QA visual de navegador.
- Publicado 0f8ca78 en /opt/lazo-crm/releases/meta-0f8ca78 tras 72/72 pruebas secuenciales en Node 22 de OVH, respaldo cifrado previo y activación atómica; connections-fe58ae0 conservada para recuperación. Salud correcta; conexiones y configuración de flujos idénticas antes/después, entorno y Caddy sin cambios. HTML y tres módulos públicos 200 con SHA-256 idéntico; APIs de alta, conexión y flujos sin sesión 401, .env 404. PR #52. El usuario confirma que Revisión de la app continúa En revisión; Verificación de acceso sigue sin comprobar. La configuración Embedded Signup y la prueba real con usuario administrador siguen pendientes; botón deshabilitado y estado explícito. No se atribuye login real ni revisión visual de navegador.

### Conexión manual de una API de WhatsApp (19 de noviembre de 2026)

- Usuario solicita poder conectar su API desde LAZO. Reserva: navegación y formulario de conexiones en app-crm/public/, validación en src/whatsapp.js, pruebas y este tablero; rama codex/conexion-api-whatsapp. Responsable: Codex. Una conexión activa por empresa; un espacio separado permite conservar la prueba actual. No se promete multiplenúmero dentro de una misma bandeja ni vinculación QR. Se bloqueará reemplazar el número de una empresa para conservar historial y flujos, sin migrar conexiones de otros proveedores. Pendientes implementación, revisión independiente y publicación.
- Implementada sección Conexiones y acceso directo /app/?view=connections: formulario privado, renovación de credenciales, estado del webhook, instrucciones de recepción y creación de otro espacio para otra API. Se conserva el destinatario de prueba de esta instalación. Backend bloquea reemplazar número/WABA y rechaza guardados concurrentes obsoletos; sin migraciones de base, modificaciones de Meta ni envíos. Revisión independiente apta tras corregir generación del formulario y patrón de versión; pruebas nuevas de concurrencia, conservación y respuestas tardías aprobadas. No se atribuye QA visual ni conexión real de una API nueva; pendientes validación en Node 22 y publicación.
- Publicado fe58ae0 en /opt/lazo-crm/releases/connections-fe58ae0, conservando flows-efca8dd como release anterior y sin cambiar la publicación estática de /flujos/. Windows: 60 pruebas aprobadas y una omitida; Node 22.23.4 en OVH, ejecución secuencial: 61/61 aprobadas. Tras cortes intermitentes de SSH, se confirmó recuperación de HTTPS antes de activar. Respaldo cifrado previo y sustitución atómica; salud correcta. Comparación en memoria de conexiones y configuración de flujos antes/después idéntica, sin leer credenciales descifradas. Entorno 0600 y Caddy conservados. HTTPS público normal: HTML, app.js, connections-ui.js y visual-preview.js 200 y SHA-256 idéntico al candidato; APIs de conexión y flujos sin sesión 401, .env 404. PR #51. El usuario debe introducir las credenciales únicamente en la pantalla; quedan pendientes su API nueva, verificación de webhook y recepción real. Sin nueva comprobación visual de navegador.

Fecha: 29 de octubre de 2026.

Repositorio: https://github.com/andrebourhis35-sketch/lazo

## Estado comprobado

- Documento maestro disponible en README.md.
- La sesión de nube de Claude Code LAZO branding proposal contiene el artefacto LAZO — Direcciones visuales y el tablero Isotipo definitivo · revisión.
- Fuentes del artefacto importadas en `branding/lienzo/` por Claude en la rama `claude/importacion-branding` (versión `1793315864-70cd`). Inventario en `branding/lienzo/README.md`.
- Lectura del repositorio por Claude: verificada (clonación anónima de `main` en `f97b073`).
- Escritura de Claude: repositorio asociado a la sesión con permiso de escritura; la publicación de la rama se confirma con el push y el PR de esta importación.

## Reparto inicial

| Responsable | Trabajo | Archivos | Estado |
|---|---|---|---|
| Codex | Preparar contexto y reglas de coordinación | AGENTS.md, CLAUDE.md, docs/COORDINACION.md | Preparado |
| Claude | Importar fuentes existentes del branding conservando originales | branding/lienzo/ (21 archivos + README.md), referencias/referencia-usuario-sistema-g.webp, este tablero · rama claude/importacion-branding | Importado; PR abierto para revisión |
| Codex | Revisar importación y consistencia con documento maestro | Revisión del PR de Claude | Pendiente de revisión |
| Usuario | Aprobar isotipo definitivo | Tablero actual | Pendiente |

## Método

1. Actualizar desde main y leer este tablero.
2. Reservar tarea y archivos con responsable y rama antes de editar; coordinar cambios al tablero secuencialmente.
3. Usar ramas separadas y commits pequeños. Nunca force-push ni borrar cambios ajenos.
4. Entregar PR con inventario, origen de archivos y verificación visual realizada.
5. El otro agente revisa antes de integrar. No afirmar que hubo revisión sin evidencia.

La importación conserva A — Órbita refinada, paleta y logotipo existentes; no equivale a aprobar el isotipo ni autoriza desarrollar funcionalidades nuevas.

## Inventario de la importación (Claude, 29 de octubre de 2026)

Origen: artefacto https://claude.ai/artifact/8YGnscSgBTwEUm9DF4opHe, versión `1793315864-70cd`. Se conservan las 5 páginas y los 20 tableros del lienzo; detalle por archivo, estado y SHA-256 en `branding/lienzo/README.md`.

| Página del lienzo | Archivos | Estado |
|---|---|---|
| Isotipo definitivo · revisión | Definitivo.dc.html | Pendiente de aprobación del usuario |
| G · Refinamiento del isotipo | Refinamiento.dc.html, Escala.dc.html | Referencia de decisión (A, B, C) |
| G · Sistema de marca | LogoOscuro, LogoClaro, AppIcon, Isotipos, Paleta, Landing, Splash, CRM (.dc.html) | Landing, Splash y CRM son propuestas de aplicación sin modificar; usan el isotipo anterior a A |
| 3D · Tecnológica | E3d, E3dLight, F3d, G3d, G3dLight (.dc.html) | Exploración; G3d y G3dLight originan la dirección G |
| Exploración 1 | Main, Violet, Coral, Mono (.dc.html) | Exploración descartada |
| — | canvas.json | Índice del lienzo |
| — | referencias/referencia-usuario-sistema-g.webp | Referencia aportada por el usuario |

## Verificaciones realizadas en la importación

- Los 21 archivos descargados de la versión publicada coinciden byte a byte con las fuentes de trabajo de la sesión (`cmp`) y sus SHA-256 coinciden con los informados por el artefacto.
- `canvas.json` es JSON válido; sus 20 tableros y 5 páginas coinciden con los archivos importados y con el inventario.
- Los 20 `.dc.html` se analizan sin errores con el parser HTML de Python.
- Sin recursos subidos al artefacto; la única dependencia externa es Manrope en Google Fonts.
- No se modificaron landing, CRM ni aplicaciones; ningún archivo importado se editó.
- Verificación visual: no realizada en esta importación. Los `.dc.html` necesitan el entorno del lienzo (`support.js`) y no se renderizan fuera de él; la revisión visual se hizo dentro del artefacto, no en el repositorio.

## Autorización del usuario: app mínima para la revisión de Meta (1 de noviembre de 2026)

Texto de la autorización, registrado tal como lo dio el usuario:

> Autorizo desarrollar una aplicación mínima de LAZO cuyo único objetivo es cumplir los requisitos de la revisión de apps de Meta para los permisos whatsapp_business_messaging y whatsapp_business_management. Esto es una excepción acotada a la regla de no tocar aplicaciones. La landing y el CRM de diseño no se modifican. El isotipo A refinado sigue pendiente de aprobación: úsalo solo como provisional y márcalo así.

Alcance: solo lo necesario para enviar la revisión. No autoriza ampliar el producto ni integrar `interfaz/` (PR #3).

| Responsable | Trabajo | Archivos | Rama | Estado |
|---|---|---|---|---|
| Claude | App mínima (backend Node.js + interfaz) | app-meta/ | claude/app-revision-meta | Revisado por Codex (`/codex:review --base main`): 2 hallazgos P2 corregidos; segunda revisión sin hallazgos. 15 pruebas locales con Meta simulada; sin pruebas contra Meta real |
| Claude | Ícono 1024×1024 provisional desde el isotipo A | branding/app-meta/ | claude/app-revision-meta | Generado y revisado a la vista; provisional |
| Claude | Guion de videos y lista de verificación | docs/meta-revision/ | claude/app-revision-meta | Listo para revisión |
| Claude | Configuración del repositorio (LF, credenciales fuera del repo) | .gitattributes, .gitignore, este tablero | claude/app-revision-meta | Listo |
| Codex | Páginas legales (borradores para revisión de abogado) | docs/legal/ | claude/app-revision-meta (delegado por Claude) | Borradores entregados; Claude comprobó LF, HTML y enlaces; pendiente de abogado |
| Codex | Revisión del PR con `/codex:review --base main` (la ejecuta el usuario) | — | — | Hecha dos veces el 1 de noviembre de 2026; la segunda, sin hallazgos |
| Usuario | Aprobar isotipo definitivo; completar datos legales; credenciales en `.env` local | — | — | Pendiente |

Las fuentes de `branding/lienzo/`, la landing, el CRM de diseño e `interfaz/` no se modifican.

## Titular de la app ante Meta (1 de noviembre de 2026)

Según indicó el usuario, el titular de la app ante Meta es la empresa verificada en Meta: La Boutique du Monde E.I.R.L., empresa constituida en Perú, con RUC 20610684760, con domicilio en Av. Brasil 3730, Magdalena del Mar, Lima 15087, Perú. Correo de contacto: contacto@espacio-sereno.com.

Las páginas de `docs/legal/` ya no mencionan a OpenChapter LLC (rama `claude/titular-verificado`). Siguen siendo borrador: los marcadores legales pendientes y la adecuación a la Ley N.º 29733 quedan para el abogado. `README.md` todavía describe a la propietaria como "LLC constituida en Estados Unidos"; no se modificó en este cambio.

## Políticas legales completas (1 de noviembre de 2026)

A petición del usuario, Claude completó en la rama `claude/politicas-completas` las páginas de `docs/legal/` (índice, privacidad, términos y eliminación de datos) con los datos reales que aportó: titular, proveedores, conservación, plazo de respuesta, edad mínima, ley aplicable y jurisdicción. Las páginas ya no tienen marcadores ni avisos de borrador, para poder publicarlas en la revisión de Meta.

Un abogado debe revisar el texto después, en especial la adecuación a la Ley N.º 29733 y su reglamento, las transferencias internacionales y las cláusulas de los términos. La rama `gh-pages` se regenerará desde `main` cuando el usuario integre este cambio.

## Continuación de revisión Meta — Codex (1 de noviembre de 2026)

- main actualizado en 888642e; checkout separado para conservar cambios locales anteriores.
- Rama codex/proveedores-correo-meta: privacidad identifica Zoho Mail como proveedor del correo y GoDaddy únicamente como registrador del dominio, según el usuario.
- Lista de revisión actualizada a legal.espacio-sereno.com, rama gh-pages y categoría Messaging indicada por el usuario.
- PR #3 pausado. No se modifican interfaz/ ni branding/lienzo/.
- Al integrar, sincronizar solo docs/legal/ hacia legal/ en gh-pages y conservar CNAME.
- Credenciales, prueba real, grabaciones y revisión Meta: pendientes. No se han recibido ni mostrado tokens.

## Resultado de configuración Meta — Codex (1 de noviembre de 2026)

- PR #8 integrado en main fbc842a tras revisión independiente sin hallazgos. PR #9 integrado en gh-pages a718810; contenido regenerado desde main/docs/legal y CNAME conservado byte a byte. Política pública devuelve HTTP 200 y muestra Zoho Mail/correo y GoDaddy/registro del dominio. Las otras dos páginas legales responden HTTP 200.
- Usuario confirmó que la app Meta es MiCRM, ID 1542490610948026. Nombre visible conservado. URLs de privacidad, términos e instrucciones de eliminación guardadas y releídas tras recarga. Correo contacto@espacio-sereno.com confirmado visualmente. Categoría Mensajes e ícono orbital provisional ya estaban configurados; se conservaron.
- npm test en app-meta/: 15/15 pruebas pasan con Meta simulada; ninguna llamada real a Meta.
- Copia local para esta fase: C:\Users\acer\lazo-meta. app-meta/.env creado a partir del ejemplo y exclusión Git comprobada; valores privados pendientes de entrada del usuario. Nunca leer ni registrar su contenido.
- Próximo paso: usuario completa token, WABA ID, Phone Number ID y Graph API en su archivo local. Luego prueba real con su teléfono, confirmación humana de recepción, dos grabaciones y formulario. Ninguno de esos pasos se declara completado. No se envió la revisión ni se publicó la app Meta.

- Asistencia de credenciales: ventana local privada preparada fuera del repositorio para que el usuario complete los cuatro valores sin PowerShell. Token oculto, guardado local en .env excluido de Git y sin llamadas a Meta. Pendiente de entrada y confirmación del usuario; no inspeccionar formulario ni contenido del archivo.

- Usuario informó que guardó el token nuevo. La app local se reinició y consulta real de plantillas de la cuenta seleccionada respondió correctamente: 0 plantillas, sin truncamiento (1 de noviembre de 2026). No se envió ningún mensaje ni se confirmó recepción. Pendiente identificar número emisor de prueba, registrar destinatario propio y comprobar disponibilidad de plantilla; no activar pagos.

- 2 de noviembre: el usuario seleccionó número de prueba y confirmó destinatario verificado. Tras actualizar el token caducado, la consulta real a Meta respondió HTTP 200 con hello_world, en_US, APPROVED. App local abierta; envío y recepción siguen pendientes de confirmación humana.

- 2 de noviembre: LAZO registró aceptación por Meta de hello_world a las 10:23 y el usuario confirmó recepción real mediante captura de WhatsApp. El error previo 131030 quedó superado. Se preparó en la interfaz una plantilla de demostración para el video de management; todavía no se envió a revisión de Meta. Grabaciones y formulario pendientes.

- Prueba de plantilla: Meta rechazó el ejemplo original con código 100 porque una variable quedaba al final del cuerpo. Se agregó texto después de {{2}} en el formulario y en el guion; pendiente nuevo envío y resultado de Meta.

- La plantilla corregida confirmacion_cita_lazo_demo_02 fue enviada desde LAZO a Meta; el registro y listado muestran PENDING. El usuario informó que tiene un video; falta confirmar cuál o cuáles y revisar los archivos antes de adjuntarlos.

- 2 de noviembre: el usuario confirmó que grabó ambos videos y los subió en la solicitud de Meta. En la interfaz se verificó el video de envío y se comprobó la sección de gestión de plantillas completa, incluido su video y la prueba API. Meta seguía mostrando 0 de 1 pruebas requeridas para mensajería, pese a la recepción real confirmada; el panel indica hasta 24 horas de demora.
- El usuario confirmó el uso permitido de public_profile. En tratamiento de datos se guardó que no hubo entregas por solicitudes de seguridad nacional y que no hay procedimientos establecidos de los enumerados; la pregunta sobre proveedores sigue pendiente de identificación precisa, con Sí seleccionado provisionalmente y sin proveedores agregados.
- El usuario señaló que la app seguía llamándose MiCRM. Se cambió el nombre visible en Meta a LAZO y se verificó después de recargar; ID de app sin cambios. La app local de prueba no está preparada para exponerla públicamente. Pendientes: determinar acceso del revisor, proveedores efectivos y reconocimiento de la llamada de mensajería. Solicitud no enviada.

## Preparación de acceso de revisión en OVH — Codex (2 de noviembre de 2026)

- El usuario solicitó alojar LAZO en su servidor. La página pública existente responde y se conserva. Se verificó acceso administrativo al VPS y que también ejecuta otros servicios.
- Reserva de trabajo: `app-meta/` y `docs/COORDINACION.md`, rama `codex/acceso-meta-seguro`. Objetivo: preparar una instancia de revisión protegida y limitar los envíos a un destinatario de prueba. La publicación y el acceso real de los revisores siguen pendientes de configuración y verificación.
- La app admite `--review`, que exige un único destinatario de prueba; hay plantillas separadas para systemd y Caddy, sin credenciales. Pasaron 17 pruebas con Meta simulada en Windows y en Node 22 del VPS; la plantilla Caddy se validó en el VPS con credenciales ficticias y la unidad pasó `systemd-analyze verify`. Revisión independiente: sin hallazgos bloqueantes; pendientes prueba de autenticación externa, DNS/TLS, cuenta de prueba, mitigación de riesgos de acceso y despliegue. No se ha publicado la instancia de revisión.

- PR #11 integrado en main. En OVH se preparó una copia aislada del commit integrado, ejecutada como usuario de servicio sin acceso interactivo y limitada al puerto local 3027; el archivo de entorno quedó fuera del repositorio y con permisos root `0600`. Se comprobó el arranque y que Caddy, Folio y AI Business HQ seguían activos. Al consultar plantillas Meta devolvió 401, código 190 y subcódigo 463: el token temporal había caducado; también falló la consulta local posterior. La instancia privada quedó detenida hasta renovar el token. No se configuraron DNS, proxy ni acceso público para la revisión, y no se ha enviado la solicitud a Meta.

- Con autorización expresa del usuario se creó en Meta el usuario de sistema `LAZO Revision`, con rol empleado. Meta muestra que aún no tiene activos asignados. Se preparó, sin guardar, la asignación limitada a probar la app LAZO y administrar plantillas de la cuenta de mensajes de prueba. La asignación, el token y el acceso del revisor siguen pendientes.

- Tras autorización específica, se asignaron a `LAZO Revision` dos activos: LAZO con acceso parcial para probar la app y Test Messaging Account con acceso parcial para ver y administrar plantillas. Se verificaron tras recargar. Para el token se seleccionaron la app LAZO, duración de 60 días y los permisos `whatsapp_business_management` y `whatsapp_business_messaging`; la generación queda en manos del usuario y no se ha confirmado. No se registran tokens ni otros datos privados.

- El usuario confirmó la actualización privada del token. En la instancia aislada de OVH, la consulta de plantillas respondió HTTP 200. Un intento autorizado de envío al destinatario de prueba fue rechazado por Meta (código 10, falta permiso granular para mensajes); no se envió ningún mensaje. Meta muestra un permiso parcial de mensajes para la cuenta de WhatsApp de prueba vinculada; su asignación está pendiente de autorización específica. La instancia sigue sin acceso público.

- Con autorización específica se asignó a LAZO Revision el acceso parcial Mensajes y, por dependencia de Meta, Números de teléfono (solo ver), únicamente para Test WhatsApp Account, vinculada a la cuenta de mensajería de prueba. La asignación se verificó tras recargar. Un nuevo intento con el token existente volvió a recibir el código 10 de permiso granular; no se envió mensaje. Una consulta de solo lectura confirmó que la cuenta y el número configurados corresponden a los activos de prueba. Se investiga la autorización del token; la app permanece privada.

- El usuario actualizó nuevamente el token en privado; se instaló en el VPS y el servicio se reinició. Meta confirma concedidos ambos permisos de WhatsApp del token, pero el envío de prueba sigue rechazado con código 10. La consulta de asignaciones de la cuenta de mensajería muestra que LAZO Revision solo dispone de MANAGE_TEMPLATES en esa cuenta, pese al permiso de mensajes en el activo de teléfono. La interfaz ofrece acceso total a la cuenta de mensajería de prueba; quedó preparado sin guardar, sujeto a autorización específica. No se confirmó entrega ni se publicó la app.

- Con autorización específica se asignó acceso total a LAZO Revision solo en Test Messaging Account; se verificó tras recargar. El envío de hello_world desde OVH fue aceptado por Meta (HTTP 200) y el usuario confirmó su recepción en WhatsApp. Se preparó autenticación de revisión fuera de Git y una configuración candidata de Caddy, sin modificar la activa ni publicar DNS. En un proxy local aislado: sin credenciales 401, con credenciales 200 y destinatario distinto 403. El acceso externo, DNS, TLS público y la entrega de credenciales al revisor siguen pendientes.

## Publicación protegida de revisión — Codex (2 de noviembre de 2026)

- Con autorización específica se añadió en Cloudflare el registro A de revision-lazo.espacio-sereno.com mediante proxy al VPS existente. Se respaldó Caddyfile, se comprobó que la configuración anterior coincidía con la candidata, se validó como usuario caddy y se recargó. El servicio de revisión quedó habilitado para reiniciar con el servidor. No se cambiaron los registros previos ni las rutas de otros sitios.
- DNS resuelve públicamente, la página principal de LAZO devuelve HTTP 200 y los servicios de Caddy, Folio, AI Business HQ y LAZO están activos. La URL de revisión responde HTTP 525 mientras Caddy intenta obtener el certificado; el acceso externo autenticado y el TLS de extremo a extremo aún no se declaran verificados. La instancia sigue limitada al destinatario de prueba.

- Tras emitirse el certificado, se comprobó desde este equipo mediante DNS normal y HTTPS sin forzar: la URL de revisión devuelve 401 sin credenciales, 200 con ellas, API 200 y 403 para otro destinatario. La verificación TLS fue correcta. Se registró la URL como plataforma web en Meta y se verificó tras recargar. Las instrucciones se prepararon con marcadores para que el usuario agregue en privado contraseña y destinatario; la solicitud no se ha enviado.
- El panel de OVH identifica el VPS en Beauharnois, Canadá. Cloudflare actúa como proxy de la instancia. Siguen pendientes de confirmar todas las ubicaciones de tratamiento y acceso remoto de los proveedores antes de completar esa parte del formulario. No se incluyeron credenciales ni datos personales en este registro.

- El usuario indicó que completó y guardó los datos privados del revisor en Meta. La página de revisión ya no muestra los marcadores y, al continuar, Meta indica 100 % en instrucciones para revisores. La sección de uso permitido figura también al 100 %; tratamiento de datos sigue pendiente, incluida la identificación completa de países de tratamiento y acceso remoto de los proveedores. La solicitud no se ha enviado.

- 3 de noviembre: se preparó en Meta la ficha de OVHcloud con la categoría de servicios de TI y Canadá, ubicación comprobada del VPS, sin guardarla porque falta confirmar si hay otros países de acceso remoto. Se prepararon dos borradores privados para consultar a OVHcloud y Cloudflare sus ubicaciones de tratamiento y acceso; no se han enviado. La solicitud de revisión continúa pendiente.

- 3 de noviembre: al releer Meta, OVHcloud figura guardado con categoría de TI y Canadá. El VPS está en Canadá, pero la lista completa de países desde los que OVHcloud podría acceder de forma remota no se ha verificado. Se preparó sin guardar la ficha de Cloudflare como proveedor de TI; falta completar sus países de tratamiento y acceso. La respuesta compartida de la IA de Cloudflare confirma alcance de red global pero no ofrece una lista exhaustiva para esta configuración. Meta muestra el tratamiento como completo pese a que Cloudflare aún no figura; no se ha enviado la solicitud.

- 3 de noviembre: por solicitud del usuario se consultó a la asistencia directa de Meta cómo declarar un proveedor con red global cuando el formulario exige países y no se dispone de una lista exhaustiva. Meta confirmó la recepción y el caso 29264000559899230 figura abierto. Sin respuesta todavía; Cloudflare sigue pendiente y la solicitud de revisión no se ha enviado. No se compartieron credenciales ni datos de clientes.

- 4 de noviembre: la asistencia de Meta mantiene abierto el caso 29264000559899230 sin respuesta visible. Verificación desde este equipo mediante HTTPS y DNS normales: la interfaz de revisión devuelve 401 sin autenticación y 200 con credenciales; la consulta de plantillas responde 200. Las tres páginas legales y la web principal responden 200. Los servicios Caddy, Folio, AI Business HQ y la instancia de revisión figuran activos. No se enviaron mensajes de prueba nuevos ni se presentó la solicitud. El control del navegador no estaba disponible para revisar más campos.

## Retomar la plataforma — Codex (10 de noviembre de 2026)

- El usuario confirma que Meta todavía no responde y solicita continuar la plataforma. Selecciona desarrollar primero la interfaz de conversaciones, contactos y ventas.
- Reserva: `interfaz/` y este tablero, rama `codex/plataforma-contactos-ventas`. Se retoma el prototipo del PR #3 en una propuesta nueva desde main, sin integrar automáticamente aquel PR.
- Responsable: Codex. Alcance: navegación entre tres vistas, contactos de demostración y etapas comerciales compartidas en almacenamiento local. No constituye un CRM de producción ni una conexión nueva a WhatsApp.
- Se conservan app-meta, su instancia pública de revisión y las fuentes branding/lienzo. Isotipo provisional, pendiente de aprobación. El estado de revisión comunicado por el usuario no se ha consultado de nuevo en Meta.
- Implementado: tres vistas conectadas, alta/búsqueda de contactos ficticios, tablero comercial con cuatro etapas, contadores compartidos y persistencia local. Se mantiene un contacto por oportunidad en esta demo.
- Evidencia: Chrome, vista de escritorio y viewport 390×844; alta de Contacto QA, búsqueda por correo, apertura de conversación vacía, mensaje local, nota, cambio de etapa desde ficha y Ventas; tras recargar se conservaron contacto, mensaje, nota y etapa. Restablecer demo recuperó los seis registros originales. Consola capturada sin errores ni advertencias.
- Pruebas: 4/4 pruebas Node del modelo (persistencia de altas, almacenamiento corrupto, cambio de columna sin duplicar, validación de campos); comprobación de sintaxis de los tres scripts y git diff --check. No hubo llamadas reales a WhatsApp ni cambios en la instancia de revisión.
- Entrega: vista previa local en http://127.0.0.1:8774/. Rama preparada para PR; no integrada ni desplegada en OVH. Próxima fase: revisión de la experiencia y después cuentas, permisos y almacenamiento de servidor.

## Publicar interfaz en OVH — Codex (14 de noviembre de 2026)

- El usuario autoriza comprobar si está publicada y publicarla si falta. El dominio servía el prototipo antiguo de Conversaciones; /interfaz/ devolvía 404.
- Reserva: interfaz/index.html, docs/COORDINACION.md y documentación de publicación, rama codex/publicacion-interfaz-ovh. Responsable: Codex.
- Revisión independiente del PR #23 en f2f7c22: sin hallazgos bloqueantes; cuatro pruebas pasan, scripts compatibles y alcance limitado al prototipo. PR integrado en main 911ee12.
- Se prepara una publicación estática en la raíz del dominio y en /interfaz/, con respaldo y cambio atómico de la versión activa. Pendientes verificación HTTPS pública y recorrido en navegador.
- La primera publicación devolvió HTTP 200 en ambas rutas y los 14 archivos coincidieron por SHA-256 desde este equipo. Para asegurar la actualización en navegadores que conservan los recursos del prototipo anterior, se añaden versiones a las URLs de scripts, estilos e imagen en interfaz/index.html antes de la verificación final.
- Publicación completada: https://lazo.espacio-sereno.com/ y https://lazo.espacio-sereno.com/interfaz/ devuelven 200. La versión activa es demo-20261114-1281f43, construida desde 1281f43 con solo siete archivos estáticos en cada ruta; sus 14 copias coinciden por SHA-256 a través de HTTPS público desde Windows. No se publican README, pruebas, repositorio ni configuración privada.
- Chrome sobre el dominio público: navegación de las tres vistas, búsqueda de Mateo por correo, apertura de su conversación y cambio de etapa; se verificó la persistencia tras recargar y se restituyó la etapa original. La entrada principal también muestra el nuevo tablero. Consola sin errores ni advertencias capturados. No se envió ningún mensaje real.
- Respaldo previo en /var/www/lazo/backups/20261114-before-demo-911ee12 y release original 118462e conservada. Cambio atómico del enlace current; sin reiniciar servicios. Caddyfile conserva el mismo SHA-256; DNS y configuración privada no se editaron.
- Revisión de Meta: su URL sigue devolviendo 401 sin credenciales; política de privacidad 200. Caddy, lazo-meta-review, Folio y AI Business HQ continúan activos. No se consultó el estado de la solicitud en Meta.
- Ajuste de publicación y registro en PR #24, con revisión independiente sin bloqueantes. La demo sigue usando datos ficticios y almacenamiento local; cuentas, servidor de datos y conexión del CRM con WhatsApp quedan para la siguiente fase.

## Plataforma con cuentas y WhatsApp — Codex (16 de noviembre de 2026)

- Autorización del usuario: «Haz todo del 1 al 5»: revisar interfaz, publicar en OVH, cuentas y empresas, base de datos y conectar WhatsApp con recepción y estados.
- Reserva: app-crm/, docs/COORDINACION.md, docs/PUBLICACION-INTERFAZ.md y .gitignore. Rama codex/plataforma-cuentas-whatsapp. Responsable: Codex; revisión independiente antes de integrar.
- Diseño: conservar la demo y ofrecer la plataforma con acceso privado en /app/. Backend aislado, empresas y roles, sesiones de servidor, contactos/notas/etapas en SQLite y conexión WhatsApp por empresa. Secretos fuera de Git y cifrados en el servidor. No se modifica app-meta ni el expediente de revisión de Meta.
- Configuración real de WhatsApp: usar inicialmente la cuenta de prueba existente salvo indicación del usuario; falta el secreto de la app para validar las firmas de los webhooks. Nunca pedirlo por chat. La entrega no se declarará completa sin diferenciar pruebas simuladas de recepción real.

### Implementación y despliegue (17 de noviembre de 2026)

- El usuario confirmó mantener la cuenta de prueba. PR #25 integrado en 486bc23 tras revisión independiente sin bloqueantes y correcciones de estados fallidos, contexto entre pestañas, carga asíncrona e invitaciones. Sin cambios en app-meta ni branding/lienzo.
- 12/12 pruebas en Windows y en Node 22.23.4 del VPS, con Meta simulada: aislamiento de empresas, permisos, invitaciones, contexto de sesión, firma/deduplicación de webhooks, estados fuera de orden, timeout incierto sin reenvío y reapertura de SQLite. El revisor comprobó además bootstrap, invitación y envíos concurrentes.
- Chrome con cuenta de QA local: inicio de sesión, alta de contacto, nota y etapa, tablero, recarga y segunda empresa vacía; sin errores capturados. Esa cuenta y sus datos son solo de prueba en memoria, no se desplegaron.
- Servicio lazo-crm activo y habilitado, código en /opt/lazo-crm/releases/486bc23, puerto 127.0.0.1:3031; DB en /var/lib/lazo-crm, entorno privado fuera de Git. Caddy validado como usuario caddy y recargado con solo las rutas /app, /app/*, /api/crm/* y /webhooks/whatsapp del sitio LAZO. Copia anterior en /etc/caddy/Caddyfile.before-crm-20261117.
- HTTPS público desde Windows: /app/ y sus recursos 200 y hashes coincidentes; sesión/contactos 401 sin autenticación; webhook con token incorrecto 403; .env 404; demo principal y /interfaz/ 200; revisión Meta 401 y privacidad 200. Caddy, CRM, revisión Meta, Folio y AI Business HQ activos.
- Integridad SQLite correcta. Primer respaldo consistente creado y temporizador diario habilitado (siete días de rotación local). No cubre pérdida completa del VPS; procedimiento en app-crm/README.md.
- Lectura real de la cuenta de prueba desde OVH: Meta HTTP 200, dos plantillas aprobadas; no se enviaron mensajes. La activación privada de propietario se abrió en Chrome y se pidió al usuario completar su contraseña directamente en la página. Pendiente su entrada; no se generó ni eligió una contraseña real por él.
- Pendiente antes de declarar terminados los cinco puntos: activación del propietario, guardar secreto de app en privado, verificar callback y suscripción messages en Meta y confirmar recepción/estados reales. La implementación está publicada, pero esas pruebas y entradas no se sustituyen por pruebas simuladas.

### Cuenta activada y continuación de WhatsApp (17 de noviembre de 2026)

- Usuario confirmó «Ya activé mi cuenta». Comprobación de solo lectura: un propietario, una empresa, una sesión y una conexión WhatsApp en la base de datos; formulario privado en Chrome muestra la sesión del propietario. No se leyó su contraseña ni se modificó su perfil.
- Reserva de actualización: docs/COORDINACION.md, rama codex/activacion-cuenta-whatsapp. Servicio CRM y Caddy activos; respaldo posterior a la activación ejecutado. Hasta ese momento no se habían enviado mensajes reales.
- WhatsApp aún sin callback verificado y sin mensajes entrantes. Se abrió la configuración básica de la app LAZO en Meta para localizar su secreto. El control de Chrome perdió respuesta antes de poder leer esa página; no se modificó ninguna opción de Meta.
- Se pidió al usuario copiar el secreto directamente de Meta al campo privado de Ajustes de LAZO y pulsar Guardar y comprobar conexión. No se pidió el valor por chat. Pendiente confirmación y comprobación de configuración, callback, suscripción y recepción real.
- Prueba real posterior desde el motor del CRM: se creó o reutilizó el contacto del destinatario autorizado de prueba y se envió una única plantilla hello_world en_US, con identificador idempotente conservado fuera de Git para evitar repetirla. Meta aceptó el envío y devolvió un ID; el registro del CRM quedó en accepted. No equivale a entrega ni a recepción. Secreto de app aún ausente, callback sin verificar y cero mensajes entrantes al comprobarlo.

### Preparación del webhook en Meta (17 de noviembre de 2026)

- Usuario confirmó que guardó el secreto en LAZO. Comprobación de servidor sin exponer valores: secreto presente y conexión comprobada; callback todavía sin verificar, sin eventos recibidos. El secreto y el token de acceso permanecen cifrados.
- Reserva: docs/COORDINACION.md, rama codex/verificacion-webhook-meta. La navegación en Chrome volvió a responder; se localizó Casos de uso → WhatsApp → Configuración. Se prepararon la URL pública del webhook y su valor privado de verificación; no se pulsó Verificar y guardar.
- Comprobación actual de Meta: revisión de whatsapp_business_messaging, whatsapp_business_management y public_profile «en curso». La pantalla Publicar mantiene su botón deshabilitado hasta completar revisión. Configuración advierte que mientras la app siga sin publicar solo enviará eventos de prueba del panel.
- Se pidió confirmación para guardar el webhook, suscribir únicamente messages y vincular la cuenta de prueba a LAZO; acción pendiente de respuesta del usuario. No se habilitó producción ni se cambió el expediente de revisión. Recepción y estados reales continúan pendientes de prueba.

### Webhook guardado y comprobación de firma (17 de noviembre de 2026)

- El usuario autorizó expresamente guardar el webhook y conectar únicamente messages para la cuenta de prueba. Meta completó el challenge contra https://lazo.espacio-sereno.com/webhooks/whatsapp y el servidor registra el callback como verificado.
- En Configuración de WhatsApp, messages figura Suscritos (v27.0); todos los demás campos del webhook permanecen sin suscribir. La lectura real de subscribed_apps confirma que LAZO ya estaba vinculado a la cuenta de prueba y continúa vinculado; no se modificaron otras suscripciones.
- Se enviaron muestras desde el panel de Meta. Una comprobación temporal en el puerto local del CRM, limitada a la ruta y el código HTTP, confirmó POST /webhooks/whatsapp y respuesta 403. No se guardaron cuerpos, encabezados ni credenciales. La muestra contiene identificadores ficticios y no se incorpora como conversación de un cliente.
- Diagnóstico privado: el valor guardado como secreto de app no tiene el formato esperado y Meta no lo valida para la app LAZO. No se mostró ni registró su contenido. Se conserva la comprobación de firma; no se acepta el evento sin autenticarlo.
- Se dejaron abiertas Configuración básica de Meta y Ajustes de LAZO, y se pidió al usuario copiar la Clave secreta de la app directamente al campo privado de LAZO y guardar. Pendiente su actualización, repetir la prueba y comprobar recepción y estados reales cuando Meta permita publicar la app. La revisión continúa pendiente; no se publicó ni se cambió la solicitud.
- Alcance del PR #28: registro documental de la configuración y sus límites. Código desplegado, app-meta, branding y configuración de los demás servicios sin cambios.
- Revisión independiente del diff documental en cca6fe2: sin bloqueantes; git diff --check correcto. No se declara resuelta la recepción mientras sigan fallando la firma y la comprobación privada del secreto.

### Secreto corregido y evento firmado aceptado (17 de noviembre de 2026)

- Reserva: docs/COORDINACION.md, rama codex/comprobar-webhook-whatsapp. Responsable: Codex. Continuación de la autorización del usuario para conectar únicamente messages a la cuenta de prueba.
- El usuario confirmó que actualizó el secreto directamente en Ajustes. Comprobación privada desde OVH: formato esperado y Meta HTTP 200 con identidad de app LAZO coincidente. No se expuso ni registró el valor.
- Se renovó la verificación de Meta y se conservó como URL definitiva https://lazo.espacio-sereno.com/webhooks/whatsapp. El servidor registra el callback verificado; messages sigue siendo el único campo suscrito (v27.0), y subscribed_apps confirma que la app continúa vinculada a la cuenta de prueba.
- Nueva muestra Incoming Message enviada desde el panel de Meta: se observó POST al webhook en el puerto local del CRM y respuesta HTTP 200. El código desplegado exige firma SHA-256 válida antes de aceptar el evento. La comprobación temporal solo informó ruta y código de respuesta; no guardó cuerpos, encabezados ni credenciales.
- La muestra usa identificadores ficticios de Meta: se acepta el transporte y se ignora su contenido por no corresponder a la cuenta/número configurados. No se relajó el aislamiento ni se creó una conversación ficticia. Al finalizar la prueba seguían registrados cero mensajes entrantes reales.
- Chrome muestra en Ajustes «Secreto guardado. Meta verificó la URL. Todavía no se recibieron eventos». Se pidió al usuario enviar Hola LAZO desde su destinatario verificado al número de prueba para comprobar la recepción real. La app sigue sin publicar; Meta advierte que no entregará eventos de producción hasta publicarla. La recepción y los estados reales permanecen pendientes y no se sustituyen por esta muestra.
- Sin cambios de código, despliegue, instancia de revisión ni servicios ajenos. Respaldo del CRM actualizado después de corregir la configuración: servicio de respaldo Result=success y ExecMainStatus=0.
- Verificación documental: git diff --check correcto y revisión independiente del diff 0d9bfc0 sin bloqueantes.

### Recepción y entrega reales confirmadas (17 de noviembre de 2026)

- El usuario confirmó que envió Hola LAZO desde su WhatsApp verificado. Reserva: docs/COORDINACION.md y docs/PUBLICACION-INTERFAZ.md, rama codex/recepcion-whatsapp-confirmada. Responsable: Codex.
- Comprobación de solo lectura en OVH: un mensaje entrante con el saludo esperado, remitente coincidente con el destinatario autorizado de prueba y estado received, registrado a las 14:20 de Perú. El callback continúa verificado y existe un evento asociado a la cuenta configurada.
- En la misma conversación se registró una respuesta saliente hola con estado delivered y su evento de estado de Meta. El envío anterior de hello_world conserva accepted; no se le atribuye la entrega de esta respuesta. No se enviaron mensajes adicionales desde el agente durante esta comprobación.
- Chrome, plataforma privada /app/, después de recargar: Hola lazo figura Recibido y hola figura Entregado en Mi WhatsApp de prueba. Evidencia visual guardada fuera del repositorio; no se incorpora el número privado, capturas de la conversación ni identificadores de mensajes a Git.
- Quedan comprobados envío, recepción y actualización de estado reales entre el CRM y la cuenta de WhatsApp de prueba. La cuenta de prueba sí entregó estos eventos mientras la app seguía sin publicar; no se generaliza este resultado a números comerciales ni empresas de clientes. La revisión de Meta continúa pendiente de resolución.
- Se actualiza el aviso de publicación para reflejar la activación del propietario y esta validación. No se modificó código, despliegue, permisos, configuración de Meta ni servicios. Revisión documental independiente en a5bd18f: sin bloqueantes; git diff --check correcto. Registro presentado en PR #30.

### Bandeja para uso diario y gestión comercial (17 de noviembre de 2026)

- El usuario autorizó implementar la propuesta de cinco mejoras: imágenes/PDF, etiquetas y filtros de conversaciones, respuestas rápidas, etapas personalizables y estadísticas reales por empresa.
- Reserva: app-crm/ y docs/COORDINACION.md, rama codex/bandeja-archivos-organizacion. Responsable: Codex; revisión independiente antes de integrar. Se conserva la cuenta de prueba, el destinatario autorizado, las credenciales y la validación de firmas. Sin cambios en branding/lienzo, demo estática ni app-meta.
- Se prepara migración compatible de SQLite, archivos privados con acceso por empresa y los controles existentes de sesión/origen, gestión compartida por administradores y métricas calculadas con registros reales. Pendientes implementación, pruebas, revisión y publicación de la nueva versión.
- Implementadas las cinco mejoras en app-crm. Adjuntos cifrados en SQLite, descarga autenticada por mensaje y empresa, caché de medios entrantes y límites de formato/tamaño/espacio; respuestas rápidas, filtros y etiquetas, etapas configurables y estadísticas de servidor. Se conserva el destinatario de prueba y no se amplían permisos de Meta.
- Pruebas locales: 25 pruebas de backend y migración, más cuatro regresiones de interfaz para preservar borradores, archivos y claves idempotentes al cambiar de conversación durante un envío. Se corrigieron nombres Unicode en descargas, rechazo de medios sin SHA-256 comprobable y la carrera de envíos tardíos detectados en revisión.
- Chrome contra instancia aislada en memoria con Meta simulada: filtros de estado y etiqueta, imagen visible, PDF descargado con SHA-256 idéntico al archivo de prueba, inserción de respuesta sin envío automático, envío de PDF e imagen, etiquetas y etapa persistidas al recargar, alta/renombrado/orden de etapa, respuesta con caracteres HTML mostrados como texto y métricas con una venta registrada. Otra empresa vacía muestra ceros; al volver se recuperan los datos propios. Escritorio y 390×844 sin desbordamiento horizontal; consola sin errores ni advertencias capturados.
- Revisión independiente de backend e interfaz: sin bloqueantes tras las correcciones y las regresiones. Aprobado para integrar; todavía no constituye evidencia de despliegue ni de archivos enviados por Meta real. Pendiente Node 22 en OVH, migración sobre copia, publicación y comprobación HTTPS.
- Candidato d93db32, PR #31: 29/29 pruebas ejecutadas con Node 22.23.4 en OVH mediante las tres rutas de test explícitas. Se creó un respaldo consistente y se migró una copia temporal privada de la base actual: integridad correcta, mismos recuentos en tablas existentes y conexiones cifradas sin cambios. La copia temporal se eliminó; no se migró todavía la base activa.

### Publicación de las cinco mejoras (17 de noviembre de 2026)

- PR #31 integrado en main fecef05 tras revisión independiente sin bloqueantes. Reserva de registro: docs/COORDINACION.md y docs/PUBLICACION-INTERFAZ.md, rama codex/publicacion-bandeja-diaria. Responsable: Codex.
- En OVH se extrajo el código integrado en /opt/lazo-crm/releases/fecef05 y se cambió atómicamente /opt/lazo-crm/current, conservando 486bc23 para recuperación. Se reinició únicamente lazo-crm. El servicio inició con la migración aditiva y pasó healthz; SQLite conserva integridad y los registros existentes: una empresa, un propietario, un contacto y tres mensajes. El callback sigue verificado.
- Caddy, lazo-crm, revisión Meta, Folio y AI Business HQ permanecen activos. Caddyfile conserva su SHA-256; no se editaron DNS, permisos de Meta ni credenciales. Archivo de entorno privado con modo 0600. Respaldos consistentes anteriores y posteriores completados correctamente.
- HTTPS público con DNS normal desde Windows: /app/, app.js, work-ui.js y app.css devuelven 200; estadísticas y descarga de adjuntos devuelven 401 sin sesión; /app/.env devuelve 404; demo principal 200 y revisión Meta 401. work-ui.js publicado coincide por SHA-256 con main.
- Chrome con la sesión existente del propietario: nueva navegación y controles presentes; conversación y estados previos conservados. Ajustes ofrece etapas y respuestas rápidas y mantiene la conexión verificada; Estadísticas muestra un mensaje recibido, dos envíos aceptados, uno entregado y cero ventas registradas. No se crearon contactos, respuestas o ventas de demostración en la empresa real.
- Prueba adicional de proveedor desde OVH: subida y descarga reales de un PNG y un PDF generados sin datos personales, utilizando el módulo desplegado y un almacén aislado en memoria. SHA-256 idéntico en ambos casos; los dos activos temporales se eliminaron de Meta. No se enviaron mensajes ni se añadieron archivos de prueba a la base activa del CRM. La entrega de archivos a un destinatario se comprobó con Meta simulada, no se declara entrega real de esos archivos.
- La plataforma permanece conectada a la cuenta y destinatario de prueba autorizados. La publicación del CRM no modifica la solicitud pendiente de revisión de Meta ni habilita el alta comercial de clientes. Servidor local de QA detenido. Revisión independiente del registro 2754de3: sin bloqueantes; git diff --check correcto. Registro presentado en PR #32.

### Acceso, respaldo externo y revisión visual (continuación)

- El usuario autorizó continuar con recuperación de contraseña, invitaciones por correo y respaldos fuera del VPS; eligió guardar copias cifradas en su computadora, sin otro servicio. En el entorno de LAZO todavía no hay configuración de correo o respaldo externo. No se le pidieron credenciales por chat.
- El usuario pidió priorizar la interfaz. Reserva: vista previa optativa en app-crm/public/, rutas estáticas necesarias en app-crm/src/server.js y este tablero, rama codex/vista-previa-orbita. Responsable: Codex; revisión independiente antes de integrar.
- Se prepara una propuesta basada en G — Órbita, conservando paleta, Manrope y el símbolo provisional. Se mantendrá disponible la vista actual para comparar. Sin modificaciones en branding/lienzo, demo estática, app-meta, credenciales ni mensajes reales.
- Recuperación, correo y respaldo siguen pendientes de implementación y activación; la prioridad visual no se registra como finalización de esos trabajos.
- Primera propuesta clara comprobada en navegador aislado; el usuario la consideró demasiado sencilla y pidió explícitamente apariencia futurista, 3D y animaciones. Segunda propuesta optativa con paneles azul noche, profundidad, luces de la paleta aprobada y presentación animada del SVG existente, sin redibujar el símbolo. Control para pausar/activar movimiento, reducido por defecto cuando lo solicita el sistema.
- QA aislado en memoria con Meta simulada: Conversaciones, Contactos y Ventas; mensajes y adjuntos existentes conservan controles, envío simulado, abrir/cerrar ficha y volver a la lista en 390×844; escritorio 1440×900. Sin desbordamiento horizontal observado. Activación y pausa cambian la animación calculada entre orbita-float y none; se preserva la preferencia de movimiento reducido al iniciar. 29/29 pruebas previas al último ajuste cosmético; sintaxis y diff correctos. Sin publicación todavía.
- El usuario pidió todavía más presencia 3D. Se exporta sin cambios el grupo sym3d de Definitivo.dc.html a un SVG exclusivo de la app; la primera escena utilizaba por error la versión simplificada. Cabecera con el símbolo volumétrico, capas flotantes con perspectiva y parallax acotado, más profundidad en tarjetas. Originales y versión predeterminada intactos. Esta presentación CSS/SVG no equivale a un modelo WebGL ni a aprobación del isotipo. Revisión final y publicación de la vista optativa pendientes.
- Revisión independiente comprobó rutas, CSP, observador y coincidencia textual de los defs originales. Señaló contraste del diálogo Nuevo contacto y del aviso de cambio de empresa; corregidos y comprobados en navegador aislado con fondos oscuros y texto claro calculados. Durante esa prueba se detectó y corrigió también la duplicación del aviso de sesión por respuestas concurrentes: solo se crea un panel. El cambio sigue en PR #33, sin datos de QA en producción.
- PR #33 integrado en main dba1a66 tras revisión independiente final apta de 428d96f. Publicado en /opt/lazo-crm/releases/dba1a66, con fecef05 conservado para recuperación y respaldo consistente previo. Reinicio de lazo-crm y healthz correctos; Caddyfile conserva su SHA-256. HTTPS normal desde Windows: /app/?visual=1, CSS y símbolo devuelven 200; CSS coincide con main por SHA-256. Navegador muestra el acceso privado con la nueva presentación. La sesión de propietario de Chrome no estaba disponible en el navegador conectado, por lo que no se afirma comprobación autenticada de esta publicación; los recorridos autenticados corresponden a QA aislado. /app/ conserva la vista predeterminada.

### Copias cifradas en la computadora (18 de noviembre de 2026)

- Reserva: app-crm/deploy/backup-export.py, scripts de Windows y recuperación, sus pruebas y documentación, y este tablero; rama codex/respaldo-cifrado-pc. Responsable: Codex, revisión independiente antes de activar.
- Destino autorizado: C:/Users/acer/Documents/LAZO/CopiasCifradas, fuera de OneDrive y Git, con ACL del usuario y SYSTEM. age 1.3.2 de Windows descargado de la publicación oficial, SHA-256 comprobado; clave privada generada y protegida con DPAPI CurrentUser, sin imprimirla ni guardarla en texto plano. Solo se enviará el destinatario público al VPS.
- age instalado desde el repositorio de Ubuntu. El gestor de paquetes reinició automáticamente cuadre-web; comprobación posterior: ese servicio y lazo-crm, Caddy, revisión Meta, Folio y AI Business HQ activos. No se ejecutaron otros cambios de esas aplicaciones. Pendientes exportador, programación, primera descarga y prueba de restauración aislada.
- PR #34 integrado en main 7a960d1 tras revisión independiente apta de dba5171. Exportador instalado en /usr/local/lib/lazo-crm-backup/export.py, con comando root fijo limitado a 300 s. Solo el destinatario público se copió a /etc/lazo-crm-backup-recipient.txt (0600). Exportaciones en /var/backups/lazo-crm-export root:ubuntu 0750, archivos 0640; SQLite privados anteriores conservan directorio 0700. Primera descarga real por scp como ubuntu correcta, tamaño y SHA-256 coincidentes.
- Recuperación real aislada en Windows: SQLite íntegro y hashes correctos; la clave maestra recuperó una conexión cifrada y cero adjuntos existentes, sin llamadas a Meta. La extracción temporal se eliminó. Prueba inicial sobre lazo-20261118T145416Z.tar.gz.age, release dba1a66. Clave privada protegida con DPAPI CurrentUser y fuera de OneDrive/Git.
- Tarea Windows LAZO - Copia cifrada OVH registrada como acer, Interactive, Limited, sin contraseña guardada: cada día a las 09:00 de Windows y al iniciar sesión, con red y StartWhenAvailable. Primera ejecución mediante el Programador completó con LastTaskResult 0; estado.json registra copia lazo-20261118T145500Z.tar.gz.age de 7.628 bytes y SHA-256 comprobado. No quedan carpetas temporales recovery-check. Persisten siete días; la computadora debe estar encendida y con sesión/red. La protección DPAPI depende de conservar este perfil de Windows.

### Recuperación de acceso y correo (18 de noviembre de 2026)

- Reserva: autenticación, servidor, almacenamiento, correo y UI de app-crm, pruebas de recuperación, scripts privados de configuración y documentación; rama codex/recuperacion-correo en worktree lazo-acceso. Responsable: Codex. El respaldo se revisa en su rama separada, sin ediciones simultáneas de los mismos archivos de trabajo.
- Se prepara recuperación mediante enlaces de un solo uso y caducidad, cierre de sesiones al cambiar contraseña y correo para invitaciones. Se conservará Zoho Mail como proveedor. La configuración SMTP se realizará con un formulario privado en esta computadora y el entorno privado del servicio, sin pedir contraseñas por chat ni exponer su edición a las empresas clientes.
- Pendientes implementación, pruebas, revisión independiente y publicación. No se declara que el correo esté habilitado hasta comprobar sus credenciales y entrega.
- Implementados recuperación de un solo uso (15 minutos), revocación de sesiones, cola cifrada y notificación de cambio; invitaciones por correo con alternativa de enlace y consulta de estado restringida a empresa/administradores. Zoho/Nodemailer 10.6.0 fijado, TLS obligatorio, hosts y direcciones acotados y npm audit sin vulnerabilidades detectadas. Formulario privado y configurador del entorno preparados, todavía sin credenciales reales ni correo habilitado.
- 39/39 pruebas iniciales Windows y QA aislado de navegador con Meta/SMTP simulados: solicitud de recuperación con respuesta genérica, formulario de nueva contraseña en campos ocultos con límites 12–128 y fragmento eliminado conservando visual=1; invitación con estado aceptado por transporte simulado y alternativa manual sin correo. No se cambió ninguna contraseña mediante el navegador ni se enviaron mensajes/correos reales.
- La revisión detectó una carrera entre cambio de contraseña y emisión de sesiones. Se revalidan la versión del hash o sesión de origen en login, aceptación y cambio de empresa; la aceptación se confirma dentro de su transacción. Formularios y archivos comprueban la sesión después de leer el cuerpo, y la conexión se revalida tras comprobar el proveedor. Cuatro regresiones locales aisladas pasaron, incluidas solicitudes simultáneas y cuerpos pendientes. Revisión estática del delta: casos señalados corregidos, sin otros bloqueantes detectados. Pendientes ejecución completa final, Node 22, migración sobre copia, revisión final y publicación.
- Configurador SMTP: cuatro pruebas Linux con entorno y procesos completamente simulados comprobaron conservación de las otras variables, archivo privado, autenticación fallida sin cambios y reversión del entorno ante fallo de reinicio. Sin lectura del entorno real ni conexión a Zoho durante esas pruebas.
- Candidato c8b7a97: 43/43 pruebas completas también en Node 22.23.4 de OVH, con dependencias fijadas instaladas en un directorio candidato, sin reiniciar producción. Migración sobre instantánea temporal privada de la base activa: huella de todos los registros anteriores idéntica, SQLite íntegro, nuevas tablas vacías y conexiones descifrables con la clave existente, sin solicitudes a proveedores. La instantánea temporal se eliminó.
- Segunda revisión independiente estática de c8b7a97: sin bloqueantes, apto para integrar; documentación del CRM actualizada para reflejar recuperación, Nodemailer y respaldo externo. Se amplió el margen del formulario local para que una reversión del servidor no quede interrumpida por su espera y se evita cerrar accidentalmente la ventana durante el guardado. Todavía no publicado ni configurado Zoho real.

### Publicación de recuperación y preparación de Zoho (18 de noviembre de 2026)

- Reserva de registro: docs/COORDINACION.md, rama codex/registro-acceso-correo. Responsable: Codex; revisión documental independiente antes de integrar.
- PR #36 integrado en main 24b629a tras revisión independiente final apta de 0ad0433. Publicado en /opt/lazo-crm/releases/24b629a con respaldo consistente previo y dba1a66 conservado para recuperación. Reinicio de lazo-crm y healthz correctos. Caddyfile conserva su SHA-256; los demás servicios comprobados siguen activos. Entorno del CRM root:root 0600.
- HTTPS público normal desde Windows: /app/?visual=1 y app.js responden 200; app.js coincide por SHA-256 con main. El navegador muestra el acceso publicado con Olvidé mi contraseña. No había sesión del propietario en el navegador conectado; los recorridos autenticados y el transporte de correo corresponden a las pruebas aisladas documentadas, sin atribuirles entrega real.
- La apertura automática del formulario privado fue rechazada por la revisión automática de permisos, con motivo genérico blocked by policy. No se eludió el rechazo: se preparó un acceso directo visible Configurar correo de LAZO en el escritorio y el usuario confirmó que lo abrió manualmente. El formulario envía la configuración por stdin de SSH al configurador fijo del VPS; no guarda la contraseña en este repositorio ni en argumentos.
- El usuario inició sesión en Zoho y se preparó el nombre LAZO en Contraseñas específicas de aplicación. La generación, copia y pegado de la credencial se dejaron al usuario; no se leyó su valor. Primer intento del formulario con resultado no confirmado. SSH, configurador y salud del CRM comprobados; ambos hosts SMTP de Zoho permiten TLS 1.3 desde OVH. El usuario confirmó plan gratuito y se le indicó seleccionar smtp.zoho.com, según la documentación oficial, y repetir el guardado. Configuración y entrega reales siguen pendientes.
- Copia cifrada posterior al despliegue lazo-20261118T200616Z.tar.gz.age descargada en la computadora. Restauración aislada correcta: release 24b629a, SQLite íntegro, hashes correctos, clave maestra compatible con una conexión existente y cero solicitudes a proveedores. No se sustituyó la base activa ni se enviaron mensajes; la extracción temporal se eliminó.

### Diagnóstico privado de la configuración de correo (18 de noviembre de 2026)

- El segundo intento con smtp.zoho.com tampoco quedó confirmado. Reserva: configurador SMTP, verificador y formulario de app-crm/deploy/, pruebas y este tablero; rama codex/diagnostico-correo-zoho. Responsable: Codex. Se preparan categorías de error fijas para distinguir autenticación, conexión y guardado, sin imprimir respuestas del proveedor ni credenciales. El usuario no debe seguir reintentando mientras se revisa el configurador.
- Candidato f5a29ce: 47/47 pruebas de Node 22.23.4 en OVH y 6/6 pruebas Python con entorno/SMTP/servicios simulados correctas; Windows pasó tres pruebas nuevas y omitió únicamente la regresión de enlace simbólico, comprobada en Linux. Se comprueba que errores del proveedor con valores privados sintéticos no salgan del verificador ni alteren el entorno. La revisión independiente aprobó el delta final después de priorizar respuestas temporales frente a EAUTH y mostrar el detalle en un aviso legible. El formulario usa smtp.zoho.com por defecto y elimina espacios de separación al guardar. Sin activación ni entrega real confirmadas todavía.

### Publicación del diagnóstico de Zoho (18 de noviembre de 2026)

- Reserva de registro: docs/COORDINACION.md, rama codex/publicacion-diagnostico-zoho. Responsable: Codex; revisión documental independiente antes de integrar.
- PR #38 integrado en main ffff9b0 tras revisión independiente apta del código y registro final 55d4c31. Publicado en /opt/lazo-crm/releases/ffff9b0; candidato f5a29ce y release comparados, dependencias fijadas idénticas y respaldo consistente previo. Se conservan 24b629a y el configurador anterior para recuperación. Reinicio de lazo-crm y healthz correctos; entorno root:root 0600 y los demás servicios comprobados activos.
- La primera comprobación previa se detuvo antes de modificar el servicio porque el Caddyfile ya tenía un hash distinto al registrado en la publicación anterior. Se comprobó que el sitio LAZO mantiene CRM en 127.0.0.1:3031, rutas de app/API/webhook y la demo en /var/www/lazo/current. No se editó Caddy: se fijó y conservó su hash actual b12a6864fb2134f2211b1f65e518b547e1f8b63b095675914577d83bc6277de8 durante esta publicación. No se atribuye el cambio previo ni se alteran otros sitios, DNS o Meta.
- Comprobación del configurador instalado con petición vacía: responde únicamente ok=false y smtp-settings, sin solicitud al proveedor. HTTPS normal desde Windows: /app/ devuelve 200. Formulario privado local actualizado desde main con SHA-256 coincidente; no se abrió automáticamente. Se pidió al usuario volver a abrir su acceso directo y guardar la contraseña de aplicación directamente en el formulario. Autenticación de Zoho y entrega de correo siguen pendientes de comprobar.
- Tras otro intento, el archivo local de estado registra ok=false y smtp-settings. Se corrigió la interpretación inicial de la respuesta del usuario, que había seleccionado smtp-auth, y se le indicó copiar solo la contraseña generada con el botón de Zoho. No se inspeccionó la credencial ni se atribuyó este resultado a un rechazo de autenticación del proveedor. Configuración y entrega siguen sin confirmarse.

### Pegado de la contraseña específica de Zoho (18 de noviembre de 2026)

- Reserva: app-crm/deploy/configure-mail.py, su prueba Python y este tablero; rama codex/pegar-clave-zoho. Responsable: Codex. Ante nuevos resultados smtp-settings se comprobaron sin credenciales los valores públicos del formulario; smtpOptions acepta servidor/correo con una clave sintética y sin contactar a Zoho. Se cubren separadores de pegado (incluidos saltos de línea y tabulaciones) en la contraseña específica; los demás controles y TLS se mantienen. No se leyó la contraseña del usuario ni se declara esa copia como causa confirmada de su error.
- PR #40 integrado en main 83e6592 tras revisión independiente de b3a3b16 sin bloqueantes y 8/8 pruebas Python Linux con entorno, SMTP y servicios simulados. Se actualizó atómicamente solo el configurador root /usr/local/lib/lazo-crm-mail/configure.py, con SHA-256 coincidente con main y copia privada del configurador anterior. La aplicación continúa en el release ffff9b0: no hubo reinicio del CRM ni modificación de su entorno o de Caddy. Servicio activo y petición vacía devuelve el código fijo previsto, sin contactar al proveedor. Se indicó al usuario reintentar desde la ventana existente; autenticación y entrega reales siguen pendientes. Reserva de este registro: docs/COORDINACION.md, rama codex/registro-clave-zoho.

### Correo de Zoho activado y entrega comprobada (18 de noviembre de 2026)

- Reserva: docs/COORDINACION.md, rama codex/activacion-correo-zoho. Responsable: Codex; revisión documental independiente antes de integrar.
- El usuario generó y pegó su contraseña de aplicación en el formulario privado. El último estado local confirma ok=true: Zoho aceptó TLS/autenticación y el configurador guardó el correo y reinició el CRM correctamente. Comprobación posterior de solo lectura: healthz correcto y entorno root:root 0600. No se leyó ni publicó la credencial. La aplicación sigue en ffff9b0 con el configurador separado del PR #40.
- Desde Recupera tu acceso en el HTTPS público de LAZO se solicitó un único enlace para el correo de la cuenta propietaria. La web mostró su respuesta genérica prevista; el registro de correo pasó a accepted y descartó su cuerpo cifrado. Pedir el enlace no cambió la contraseña ni inició una sesión.
- Entrega real comprobada en el Gmail conectado del propietario: una búsqueda restringida por remitente, destinatario, asunto Recupera tu acceso a LAZO, fecha posterior a la solicitud y etiqueta INBOX encontró el mensaje. Se consultaron únicamente identificadores, sin abrir el cuerpo ni el enlace de recuperación, y sin marcarlo como leído. La aceptación SMTP y la llegada a la bandeja se verificaron por separado. No se enviaron invitaciones reales a otras personas ni se atribuye esta prueba a ese recorrido.
- Copia cifrada posterior al guardado descargada en Windows: lazo-20261119T031212Z.tar.gz.age (nombre en UTC). Recuperación aislada correcta del release ffff9b0: hashes y SQLite íntegros, clave maestra compatible con la conexión existente y cero solicitudes a proveedores durante la comprobación. La extracción temporal se eliminó. La configuración de correo queda incluida en el entorno privado de la copia cifrada; no se sustituyó la base activa.

### Recursos visuales completos de la app (18 de noviembre de 2026)

- El usuario señaló que la pantalla se ve mal. Reserva: recursos públicos de app-crm, su mapa estático, prueba de paquete y este tablero; rama codex/estilos-app-autonoma. Responsable: Codex; revisión independiente antes de integrar. Comprobación pública: styles.css y crm.css devolvían 500 y el navegador calculaba Times New Roman. El servidor buscaba esos recursos y marca.svg en la carpeta hermana interfaz, ausente en la publicación que empaqueta solo app-crm. Se preparan copias sin cambios dentro de la propia app y una regresión sobre un paquete sin esa carpeta hermana. No se rediseñan ni se modifican originales, datos, credenciales, servicios ajenos o Meta.
- Implementado en 42a5bc0: las tres copias coinciden por SHA-256 con sus originales; prueba de paquete correcta en Windows Node 24 y OVH Node 22.23.4, con diez recursos HTTP 200/MIME válido y .env 404. Navegador aislado con datos/Meta/SMTP ficticios: tipografía calculada Manrope y recorridos de Conversaciones, Contactos y Ventas; en 390×844 no se observó desbordamiento horizontal. Vista de escritorio y capturas revisadas; viewport restaurado y pestaña de QA cerrada. Revisión estática independiente sin bloqueantes; pendientes integración y publicación.
- PR #43 integrado en main 5a7b484 tras revisión independiente final de 04e93dc. Publicado en /opt/lazo-crm/releases/5a7b484 con respaldo consistente previo, comparación del paquete con el candidato validado y ffff9b0 conservado para recuperación. Se reinició únicamente lazo-crm; healthz correcto. Demo, Caddyfile y configurador privado de correo conservan su destino o hash, entorno 0600 y los demás servicios comprobados activos.
- HTTPS con DNS normal desde PowerShell: styles.css, crm.css y marca.svg devuelven 200, MIME correcto y SHA-256 idéntico a main; demo principal 200, revisión Meta y contactos sin sesión 401, .env 404. Navegador público recargado: Manrope calculada, cuatro hojas accesibles y logotipo cargado. Captura de acceso publicada guardada fuera de Git; el recorrido autenticado corresponde a QA ficticio, sin entrar en la empresa real. Servidor local de QA detenido. No se reenviaron mensajes ni se cambiaron credenciales o configuración de Meta. Reserva de este registro: docs/COORDINACION.md, rama codex/publicacion-estilos-completos.

### Órbita en la entrada habitual de LAZO (18 de noviembre de 2026)

- El usuario mostró /app/ en su sesión y señaló que seguía igual; la presentación Órbita solo se activaba con visual=1. Reserva: app-crm/public/visual-preview.js, index.html, documentación visual y este tablero; rama codex/orbita-por-defecto. Responsable: Codex; revisión independiente antes de integrar. Se activa la presentación en la entrada habitual y todos sus módulos, manteniendo visual=0 para comparar la vista clásica, el control de movimiento y el isotipo provisional. Solo cambia la presentación; datos, permisos, credenciales y acciones permanecen en su implementación actual.
- QA aislado de 8322ff1, sin query visual en la entrada: Órbita presente en el acceso y en Conversaciones, Contactos, Ventas, Estadísticas y Ajustes; escena volumétrica presente y sin desbordamiento horizontal del documento en 1818×910, tamaño tomado de la captura del usuario. visual=0 desactiva la presentación y visual=1 mantiene compatibilidad. Captura de bandeja con datos ficticios fuera de Git; viewport restaurado y pestaña QA cerrada. Sintaxis y prueba existente de paquete correctas. Revisión estática independiente del código sin bloqueantes; publicación pendiente.
- PR #45 integrado en main c50375d tras revisión independiente final de 28739c3. Publicado en /opt/lazo-crm/releases/c50375d: artefacto comprobado por SHA-256, backend idéntico a la release anterior, dependencias fijadas sin cambios y prueba de paquete en Node 22 correcta antes de activar. Respaldo consistente previo, 5a7b484 conservada para recuperación y reinicio únicamente de lazo-crm; salud correcta, entorno 0600, Caddy/demo/configurador de correo preservados y demás servicios comprobados activos.
- HTTPS público con DNS normal: visual-preview.js devuelve 200 y coincide con main por SHA-256. Navegador en /app/ sin query confirma Órbita activa y Manrope; la comprobación autenticada de los cinco módulos corresponde al QA ficticio, sin entrar en la cuenta real del usuario. Se conserva un enlace a visual=0 y la compatibilidad con visual=1. Servidor local de QA detenido; capturas fuera de Git. Reserva de este registro: docs/COORDINACION.md, rama codex/publicacion-orbita-principal.

### Laboratorio independiente de flujos con Astryx (19 de noviembre de 2026)

- El usuario autorizó una prueba del nuevo editor de flujos con React y Astryx antes de decidir su adopción. Reserva: laboratorio-flujos/ y este tablero; rama codex/prueba-flujos-astryx. Responsable: Codex. Se conservan app-crm/, app-meta/, interfaz/ y branding/lienzo/; no se migra ni se publica sobre el CRM activo.
- Alcance: lienzo de nodos conectables, biblioteca de bloques, propiedades, borrador en este navegador y simulación con datos ficticios. La referencia funcional procede de una inspección de solo lectura de SendyPRO; no se copian sus textos, archivos, datos, grafos ni diseño. No se conecta WhatsApp, no se envían mensajes y no se añade marketing. Pendientes implementación, compilación, pruebas del simulador y revisión visual/independiente.
- Implementado en laboratorio-flujos/: React 19.3.1, Astryx 0.7.16 y React Flow 13.0.2 fijados; marco canvas-editor adaptado, tema Órbita con Manrope local y copia del isotipo provisional, siete tipos de bloque, edición/conexión, borrador local, modos claro/oscuro, paneles móviles y simulador con reloj virtual. Once pruebas del modelo y compilación correctas; auditoría de dependencias de ejecución sin vulnerabilidades detectadas. Astryx doctor --built .: cero fallos, con advertencias documentadas de estilo inline y shim Windows. El bundle principal ronda 289 kB gzip y CSS 54 kB gzip; adopción general y optimización siguen sujetas a evaluación.
- QA de Chrome en el HTTP local: dos ramas simuladas, variables y espera virtual; movimiento con teclado, arrastre de conexiones y reconexión, borrado de arista conservando nodos, recuperación del borrador tras recarga, edición/eliminación desde el panel móvil, temas y ausencia de desbordamiento horizontal en escritorio y 390×844. Viewport restaurado; captura con datos ficticios fuera de Git. Revisión independiente estática del código: P1 de Changeset 13 y P2 de presupuesto de borrador/resaltado corregidos y comprobados, sin bloqueantes adicionales identificados. La revisión no equivale a aprobar el diseño ni a probar automatizaciones reales.
- Vista previa compilada abierta en 127.0.0.1:8771, limitada a esta computadora. Instrucciones en laboratorio-flujos/README.md. CRM publicado y su backend permanecen sin cambios; sin despliegue público, cambios en Meta, credenciales ni motor de automatización conectado. Se entrega mediante PR para evaluar esta prueba antes de adoptar la biblioteca.

### Publicación del laboratorio en el dominio LAZO (19 de noviembre de 2026)

- El usuario solicita publicar siempre los avances en lazo.espacio-sereno.com e informa que todavía no hay usuarios. Reserva: enlace en app-crm/public/visual-preview.js, README del laboratorio y este tablero; rama codex/publicacion-laboratorio-flujos. Responsable: Codex. PR #47 integrado tras la revisión independiente ya registrada. Se prepara /flujos/ como publicación estática y un enlace visible en la presentación Órbita; conservar datos y servicios existentes.
- Publicado el candidato 85d9740 en /var/www/lazo/releases/flujos-85d9740 y /opt/lazo-crm/releases/flujos-85d9740. Copia cifrada mediante el servicio de respaldo antes de activar; releases anteriores conservadas y enlaces sustituidos atómicamente. La nueva release del CRM copia c50375d y cambia únicamente el JS de presentación para el enlace; comparación de src/ idéntica, sin migraciones ni cambios de entorno, datos, DNS o configuración de Meta. Reinicio únicamente de lazo-crm y salud correcta. Caddyfile conserva SHA-256 b12a6864fb2134f2211b1f65e518b547e1f8b63b095675914577d83bc6277de8.
- HTTPS público normal desde Windows: /flujos/ y /app/ devuelven 200; JS/CSS compilados coinciden por SHA-256 con el paquete local y /flujos/.env devuelve 404. Chrome renderiza el editor público, y el enlace visible Flujos · laboratorio de /app/ lleva a /flujos/; sin errores en la consola de esa navegación. Captura con datos ficticios fuera de Git. El laboratorio publicado continúa simulando y guardando únicamente en cada navegador. Revisión independiente del enlace y documentación apta; preferencia del usuario: publicar los próximos avances en este dominio.

### Órbita como única presentación (19 de noviembre de 2026)

- Usuario pide retirar Ver vista clásica y Pausar animaciones, dejar Órbita como única presentación y animaciones siempre activas. Reserva: app-crm/public/visual-preview.js, VISUAL-PREVIEW.md y este tablero; rama codex/orbita-unica, worktree lazo-orbita. Responsable: Codex. Se ignora el antiguo visual=0 y se conserva el CSS base del que depende Órbita. La automatización continúa en la rama codex/flujos-servidor, sin publicar su backend incompleto.
- Revisión independiente estática apta y sintaxis correcta. Publicado 7e8490a en /opt/lazo-crm/releases/orbita-7e8490a, con respaldo cifrado previo y release flujos-85d9740 conservada. Backend src/ idéntico; salud correcta tras reiniciar únicamente lazo-crm y Caddyfile sin cambios. Chrome en /app/?visual=0 confirma Órbita, clase motion-on, animación orbita-ambient y ausencia de ambos controles; captura fuera de Git. No se modificaron datos ni la demo de branding.

### Flujos persistentes y primera automatización (19 de noviembre de 2026)

- Usuario autoriza los puntos 1–3: guardar flujos por empresa en el servidor, activar/pausar con borrador independiente y ejecutar Inicio → bienvenida → etiqueta → asesor con la cuenta de WhatsApp de prueba. Reserva: app-crm/src/, pruebas de flujos, laboratorio-flujos/ y este tablero; rama codex/flujos-servidor. Responsable: Codex. Pendientes implementación, pruebas aisladas, revisión independiente, migración sobre copia y publicación en el dominio LAZO. Condiciones/esperas/seguimientos reales quedan para la siguiente fase; seguirán disponibles en la simulación y no se activarán como si tuvieran ejecución real.
- Implementados borradores y versión activa por empresa con revisión optimista, activar/pausar e historial; cola transaccional al recibir webhook válido, deduplicación, límite de una bienvenida por minuto/contacto, generación de activación, cancelación por baja/pausa, verificación del rol y capacidad de etiquetas antes del envío. Un reinicio o respuesta de red incierta no provoca reintento automático. Modelo puro compartido entre editor y servidor; UI usa la sesión, contexto y CSRF del CRM y permite seleccionar un miembro real de la empresa.
- Revisión independiente final apta tras corregir claim efectivo, invalidación por generación, cancelación por baja y cómputo exacto de etiquetas con tildes. CRM: 56 pruebas aprobadas y una omitida por Windows; 57/57 en Node 22.23.4 de OVH, proveedores simulados. Once pruebas del modelo del editor, compilación y Astryx doctor sin fallos. La comprobación de navegador de la versión anterior está registrada por separado; el control del navegador dejó de estar disponible para esta actualización, por lo que no se atribuye una nueva comprobación visual de sus botones. El intento de abrir la URL en Codex quedó encolado.
- Migración comprobada en instantánea privada de la base real: huella de todas las filas anteriores idéntica, SQLite íntegro y ambas tablas nuevas vacías; instantánea eliminada. Publicado efca8dd en /opt/lazo-crm/releases/flows-efca8dd y /var/www/lazo/releases/flows-efca8dd, con respaldo cifrado previo, releases anteriores conservadas y sustitución atómica. Salud correcta; entorno 0600, Caddyfile y dependencias fijadas sin cambios. Conserva Órbita única y sus animaciones del PR #49. HTTPS público normal: CRM/editor 200, API de flujos sin sesión 401, .env 404 y JS/CSS publicados idénticos por SHA-256 al build.
- Preparada y activada una única Bienvenida automática en la empresa de la conexión de prueba y asignada al propietario existente, conservando cualquier configuración previa. Consulta real de plantillas a Meta correcta; sin imprimir ni modificar credenciales. El usuario envió un nuevo Hola: se comprobó un único recorrido done, etiqueta Interesado presente, responsable igual al propietario y mensaje automático con estado delivered sin error. Esto acredita entrega por el webhook de Meta; no se simularon mensajes entrantes para abrir la ventana de envío. Los puntos 1–3 quedan publicados y comprobados; condiciones/esperas/seguimientos reales siguen fuera de esta entrega.
