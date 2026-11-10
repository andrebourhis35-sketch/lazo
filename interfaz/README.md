# LAZO · Interfaz de la plataforma

Prototipo navegable con datos ficticios. Retoma la bandeja del PR #3 y añade Contactos y Ventas, según la elección del usuario del 10 de noviembre de 2026.

## Abrir en Windows

Desde la raíz del repositorio, servir únicamente esta carpeta (no la raíz, que podría contener configuración privada):

```powershell
python -m http.server 8774 --bind 127.0.0.1 --directory interfaz
```

Abrir http://127.0.0.1:8774/. No necesita compilación ni paquetes. Manrope se solicita a Google Fonts y tiene alternativa de sistema.

## Qué se puede probar

- Conversaciones: búsqueda, filtros, borradores por contacto, mensajes simulados, resolver/reabrir, notas internas y etapa comercial.
- Contactos: búsqueda por nombre, correo o ciudad, alta de contactos ficticios y acceso a su conversación.
- Ventas: cuatro etapas, cambio mediante selector accesible, contadores y acceso al mismo contacto. Se representa una oportunidad por contacto; no hay importes ni facturación.
- Las tres vistas comparten los datos del navegador (`lazo-conversaciones-demo-v1`). Se conservan al recargar; no se sincronizan entre equipos o cuentas. Restablecer demo recupera los seis contactos originales.
- Navegación adaptada a móvil, tabla y tablero desplazables horizontalmente.

## Límites

No conecta WhatsApp, IA, usuarios ni base de datos. No introducir información real de clientes. La sugerencia es un texto predefinido y enviar solo añade el mensaje al prototipo. Automatizaciones, Agentes IA y Reportes están deshabilitados. El símbolo es provisional, no aprobado; las fuentes branding/lienzo y la app que revisa Meta se conservan.

## Validación

```powershell
node --test interfaz/test/demo-model.test.mjs
node --check interfaz/app.js
node --check interfaz/crm.js
```

Prueba manual: crear un contacto ficticio, buscarlo, abrir su conversación, añadir mensaje y nota, cambiar etapa desde Ventas, recargar y comprobar contacto/mensaje/nota/etapa. Comprobar navegación a 390 px de ancho.
