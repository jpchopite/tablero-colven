# Diseños archivados

No se cargan en el tablero; se guardan por si se quieren volver a probar.

- `skins.js` y `skins.css`: el menú «Diseño del tablero» (Opciones), los diseños Aire y Línea y el dock de secciones. Sin ellos el tablero usaba su diseño original, que sigue siendo la base de `index.html`.
- `propuestas-a-b-c.css`: las tres propuestas del rediseño tal como se compararon: A Corporativo (la elegida, hoy en `designs.css`), B Energía y C Financiero.

Para probarlos en una copia local: copiar `skins.js` y `skins.css` a la raíz, cambiar en `index.html` la línea de `design.js` por `<link rel="stylesheet" href="skins.css?v=4"><script src="skins.js?v=7"></script>`, y si se quieren B o C, cargar `propuestas-a-b-c.css` en lugar de `designs.css` y abrir el tablero con `?design=b` o `?design=c`.
