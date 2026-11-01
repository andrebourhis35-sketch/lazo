# Ícono de la app para Meta · PROVISIONAL

**Estado: provisional.** El isotipo A refinado sigue pendiente de aprobación del usuario. Este ícono solo sirve para la revisión de la app en Meta y deberá regenerarse si el isotipo cambia.

| Archivo | Descripción |
|---|---|
| `icono-app-1024-PROVISIONAL.png` | PNG de 1024×1024 px para el panel de la app en Meta |
| `icono-app-1024.html` | Fuente del PNG |

## Origen y fidelidad

- Fuente: `branding/lienzo/Definitivo.dc.html`, composición "Ícono de app · 64 px" del panel oscuro.
- El bloque `<defs>` del SVG (degradados, anillo, esfera, `sym3d`) se copia sin cambios con un script, no a mano.
- Fondo, `viewBox` (`36 -6 332 332`) y color del tablero se conservan tal cual. Solo cambia la escala: 64 px → 1024 px (×16), símbolo de 54 px → 864 px.
- Se omiten el radio de 16 px y el borde de 1 px del tablero, porque cada plataforma aplica su propia máscara a un ícono cuadrado.
- No se rediseñó nada. `branding/lienzo/` no se modificó.

## Cómo regenerarlo

Con Google Chrome instalado (Windows):

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1024,1024 --screenshot="<ruta>\icono-app-1024-PROVISIONAL.png" "file:///<ruta>/icono-app-1024.html"
```

Verificado el 1 de noviembre de 2026: el PNG mide 1024×1024 y se revisó a la vista.
