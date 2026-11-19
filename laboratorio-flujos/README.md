# LAZO · Laboratorio de flujos

Editor React 19.3.1, Astryx 0.7.16 y React Flow 13.0.2, publicado en https://lazo.espacio-sereno.com/flujos/.

Con una sesión de propietario o administrador de LAZO, permite guardar borradores por empresa en el servidor, activar una versión y pausarla, elegir asesores y consultar las últimas ejecuciones. La primera automatización real admite Inicio → Mensaje → Etiqueta → Asesor → Finalizar con la cuenta de WhatsApp de prueba. Condiciones y esperas siguen limitadas a simulación y no se pueden activar como ejecución real.

Sin sesión se conserva la simulación local. El guardado local no publica ni activa un flujo. Los borradores locales pertenecen a este navegador; los guardados en el servidor se recuperan desde la cuenta de la empresa. Las credenciales de WhatsApp nunca llegan al editor.

## Abrir en Windows

Con Node 22.13 o superior, desde PowerShell:

```powershell
cd 'C:\Users\acer\OneDrive\Documents\ChatGPT\05 - CRM\lazo\laboratorio-flujos'
npm ci
npm run build
npm run preview
```

Abrir la dirección indicada: http://127.0.0.1:8771/. El servidor escucha únicamente en esta computadora. Mantener esa terminal abierta y usar Ctrl+C para detenerlo. Si el puerto ya está ocupado por esta prueba, utilizar la ventana existente. Para desarrollar con recarga automática se puede usar `npm run dev` en su lugar.

## Qué se puede probar

- Añadir, seleccionar, mover, editar, duplicar y eliminar bloques. Las teclas de dirección también mueven el bloque enfocado; Delete elimina la selección.
- Arrastrar desde una salida hasta la entrada de otro bloque. Una conexión nueva sustituye el destino anterior de esa salida; no crea dos envíos paralelos. Se rechazan ciclos y conexiones hacia Inicio.
- Configurar inicio por palabra clave, mensajes con `{{nombre}}`, condiciones de dos salidas, esperas, etiquetas, asignación y finalización.
- Guardar el borrador en el almacenamiento local del navegador y recuperarlo al recargar. El modo claro/oscuro también se conserva localmente. Los cambios de selección no cuentan como edición; mover o eliminar sí.
- Simular «Quiero el catálogo» y «Prefiero un asesor». El recorrido muestra textos personalizados, decisiones, tiempo virtual, etiquetas y responsable. Solo se resaltan las conexiones realmente recorridas.
- Usar los paneles desplegables en pantallas pequeñas. El lienzo se desplaza y amplía; los botones de vista general permiten localizar todo el recorrido.

## Alcance de ejecución

Guardar un borrador no altera la versión que está activa. «Activar versión guardada» comienza a procesar mensajes nuevos; «Pausar flujo» evita nuevas ejecuciones. Un envío ya iniciado puede completarse. La comparación de revisiones evita sobrescrituras entre pestañas. Al cambiar la sesión o empresa se bloquean peticiones del contexto anterior y se debe recargar.

La condición del simulador usa la respuesta ficticia escrita por el usuario. Sus tiempos son virtuales: «Probar flujo» no manda mensajes reales. La ejecución real se realiza exclusivamente en el servidor y respeta la ventana real de WhatsApp y el destinatario de prueba. No hay marketing ni campañas.

Admite hasta 80 bloques y 160 conexiones en borradores; para la primera ejecución real se limita a veinte bloques y exactamente un mensaje, sin condiciones ni esperas. Un flujo activo por empresa y una bienvenida por minuto/contacto. Consultar [backend](../app-crm/README.md#flujos-de-bienvenida-por-empresa) para estados, cancelación, recuperación incierta y límites.

## Validación realizada

```powershell
npm test
npm run build
npm run astryx -- doctor --built . --json
npm audit --omit=dev
```

- Once pruebas del modelo: dos ramas, variables, reloj virtual, sustitución de conexiones, rechazo de ciclos, incompletos, borradores manipulados, capacidad máxima y resaltado exacto del recorrido.
- QA de Chrome sobre la compilación: ambas ramas; selección/movimiento con teclado; conexión y reconexión por arrastre; eliminación de arista conservando los nueve nodos; guardado y recuperación tras recarga; edición/eliminación de un bloque ficticio desde panel móvil; modos claro/oscuro. Sin desbordamiento horizontal del documento en escritorio y 390×844. El viewport se restableció al terminar.
- Astryx doctor: cero fallos. Conserva advertencias de estilos inline (usados con tokens en el prototipo) y de identificación del shim `.cmd` en Windows. La invocación fijada `npm run astryx -- ...` utiliza el paquete correcto.
- Auditoría de dependencias de ejecución: cero vulnerabilidades detectadas al preparar esta prueba; no es una garantía sobre futuras versiones.
- Compilación aproximada: JS principal 897 kB / 289 kB gzip; CSS 334 kB / 54 kB gzip; fuente latina Manrope 25 kB. Vite avisa del tamaño del chunk y de una directiva de `react-compiler-runtime`. La vista previa comprobada usa los artefactos compilados. Conviene evaluar partición/carga diferida y coste de Astryx antes de extender su uso.

La revisión independiente identificó y permitió corregir el contrato `NodeChangeset`/`EdgeChangeset` de React Flow 13, selección y deselección, protección de la serialización, límite del borrador y resaltado de aristas. No sustituye la revisión del usuario de su apariencia.

## Origen y licencias

Se partió de `astryx template canvas-editor src/CanvasEditor.tsx`, conservando su estructura de cabecera, biblioteca, lienzo, inspector y pie mediante `Layout`. Se sustituyeron la herramienta de diseño gráfico, sus contenidos y sus controles por el editor original de LAZO; los estilos usan componentes y tokens del tema `lazoTheme`.

La inspección de SendyPRO fue de solo lectura y se usó únicamente como referencia de capacidades. No se importaron flujos, mensajes, prompts, imágenes, datos comerciales o código de SendyPRO.

El recurso `public/marca.svg` procede del isotipo provisional existente `app-crm/public/marca-volumen.svg`; no se rediseñó ni se considera aprobado definitivamente. Manrope se sirve desde el propio paquete. Se incluyen avisos de Astryx (MIT) y Manrope (SIL OFL) en `public/licenses/`. Las demás dependencias conservan sus licencias en los paquetes originales.

Referencias: [Astryx](https://github.com/meta/astryx), [React Flow 13](https://reactflow.dev/learn/troubleshooting/migrate-to-v13).
