# Publicación de la demo LAZO en OVH

Entrega comprobada el 14 de noviembre de 2026:

- https://lazo.espacio-sereno.com/
- https://lazo.espacio-sereno.com/interfaz/

Ambas rutas muestran el mismo prototipo de Conversaciones, Contactos y Ventas. Los registros permanecen en localStorage del navegador y se comparten entre ambas rutas del mismo origen. La demo no tiene cuentas ni almacenamiento en el servidor; no introducir datos reales de clientes.

## Versión publicada

El PR #23 incorporó la interfaz a main en 911ee12. El ajuste de URLs de recursos y registro de publicación se presenta en el PR #24. El artefacto publicado se construyó desde 1281f43; los cambios posteriores de esta entrega son documentación.

Se despliegan únicamente index.html, styles.css, app.js, marca.svg, crm.css, crm.js y demo-model.js. Cada archivo se copia también dentro de interfaz/ para permitir las dos entradas. Se excluyen configuración privada, repositorio Git, documentación, pruebas y app-meta.

Las seis URLs de recursos incluyen ?v=20261114. Al cambiar recursos en una entrega posterior, actualizar su versión para que los navegadores soliciten los archivos nuevos.

## Despliegue y recuperación

Caddy sirve /var/www/lazo/current. La publicación prepara una carpeta de release completa, verifica su inventario y SHA-256 y cambia el enlace current de forma atómica. No requiere reiniciar Caddy ni modificar su configuración.

- Release activa de esta entrega: /var/www/lazo/releases/demo-20261114-1281f43.
- Release anterior conservada: /var/www/lazo/releases/118462e.
- Respaldo independiente y manifiestos: /var/www/lazo/backups/20261114-before-demo-911ee12.

Para recuperar la versión anterior, comprobar primero las rutas y cambiar current por un enlace temporal a la release anterior mediante un reemplazo atómico. No borrar releases ni copiar archivos encima de la versión activa. Verificar después HTTPS usando DNS normal desde un equipo externo.

La instancia de revisión de Meta utiliza otro directorio y dominio. Esta entrega no edita esa instancia, Caddyfile, DNS ni credenciales.

## Evidencia

- Cuatro pruebas del modelo y sintaxis JS correctas antes de la publicación; revisión independiente sin bloqueantes.
- HTTP 200 y comparación SHA-256 de las 14 copias estáticas por HTTPS público, incluidos los recursos versionados.
- Chrome: navegación de las tres vistas, búsqueda por correo, apertura de conversación, cambio de etapa y persistencia al recargar; etapa de prueba restituida. Consola capturada sin errores ni advertencias.
- La raíz y /interfaz/ muestran la versión nueva. Las rutas .env devuelven 404.
- URL de revisión Meta: 401 sin credenciales. Política de privacidad: 200. Servicios Caddy, revisión Meta, Folio y AI Business HQ activos; Caddyfile conserva el mismo SHA-256.
