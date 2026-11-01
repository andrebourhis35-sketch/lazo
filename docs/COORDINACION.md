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
| Claude | App mínima (backend Node.js + interfaz) | app-meta/ | claude/app-revision-meta | Revisado por Codex (`/codex:review --base main`, 2 hallazgos P2 corregidos); 15 pruebas locales con Meta simulada |
| Claude | Ícono 1024×1024 provisional desde el isotipo A | branding/app-meta/ | claude/app-revision-meta | Generado y revisado a la vista; provisional |
| Claude | Guion de videos y lista de verificación | docs/meta-revision/ | claude/app-revision-meta | Listo para revisión |
| Claude | Configuración del repositorio (LF, credenciales fuera del repo) | .gitattributes, .gitignore, este tablero | claude/app-revision-meta | Listo |
| Codex | Páginas legales (borradores para revisión de abogado) | docs/legal/ | claude/app-revision-meta (delegado por Claude) | Borradores entregados; Claude comprobó LF, HTML y enlaces; pendiente de abogado |
| Codex | Revisión del PR con `/codex:review --base main` (la ejecuta el usuario) | — | — | Pendiente |
| Usuario | Aprobar isotipo definitivo; completar datos legales; credenciales en `.env` local | — | — | Pendiente |

Las fuentes de `branding/lienzo/`, la landing, el CRM de diseño e `interfaz/` no se modifican.
