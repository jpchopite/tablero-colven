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
