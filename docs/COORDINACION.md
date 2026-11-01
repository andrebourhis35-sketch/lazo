# Coordinación Codex y Claude

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
