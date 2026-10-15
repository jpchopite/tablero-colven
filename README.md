# Tablero de tareas del equipo

Tablero compartido para tres personas: columnas de estado, fechas, tareas que se repiten y un registro de quién movió qué.

- Página: https://jpchopite.github.io/tablero-colven/
- Los datos viven en Supabase (proyecto `tablero-colven`). Las tablas no se pueden leer directamente: todo pasa por funciones que exigen la clave del equipo, guardada solo cifrada.
- La clave no está en este repositorio. Para cambiarla, pídeselo a Claude o ejecuta en Supabase:
  `update private.config set key_hash = extensions.crypt('NUEVA-CLAVE', extensions.gen_salt('bf', 10));`

## Adjuntos

Los archivos de las tarjetas se guardan en el almacenamiento privado `adjuntos` de Supabase (máximo 25 MB por archivo, 30 por tarjeta).
La función `adjuntos` comprueba la clave del equipo antes de dar enlaces temporales para subir, ver o descargar.
Al quitar un adjunto, el archivo guardado se borra solo si ninguna tarjeta (ni una en la papelera) lo usa.

## Acceso abierto (temporal)

Por ahora el tablero abre sin pedir clave: la página lleva su propia clave de acceso (`OPEN_KEY` en index.html), registrada en `private.open_keys`.
La clave del equipo sigue funcionando. Para volver a pedirla:

1. En index.html, deja `OPEN_KEY = ""`.
2. En Supabase, ejecuta `delete from private.open_keys;`

## App instalable y sin conexión

`manifest.webmanifest` y `sw.js` permiten instalar el tablero como app (ícono de Colven en la pantalla de inicio).
La página se pide de nuevo cada vez que hay señal; sin señal se muestra la última copia guardada en el dispositivo, solo para consultar.

## Mantener activa la base de datos

El plan gratuito de Supabase pausa un proyecto tras unos 7 días sin actividad.
`.github/workflows/mantener-activa.yml` llama cada 3 días a `public.ping()`, una función que no lee nada del tablero.
Se puede ejecutar a mano desde la pestaña Actions de GitHub.

## Archivo y papelera

Las tarjetas archivadas (o terminadas hace más de 30 días) salen del tablero y se ven en «Archivo».
Las borradas van a la papelera y se eliminan solas a los 30 días.
