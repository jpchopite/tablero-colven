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

## Columnas

Por hacer, En curso, Esperando a alguien, Lista para entregar y Hecho.
«Lista para entregar» (estado `ready`) es para trabajo terminado cuya fecha de entrega aún no llega: se ordena por fecha y muestra «Entregar hoy» o el atraso cuando llega el día. Sigue contando como tarea abierta; al entregarla se marca como hecha.

## Archivo y papelera

Las tarjetas archivadas (o terminadas hace más de 30 días) salen del tablero y se ven en «Archivo».
Las borradas van a la papelera y se eliminan solas a los 30 días.

## Documentos

La sección «Documentos» (`#documentos`) guarda carpetas y archivos del equipo, fuera de las tarjetas.

- Cada carpeta o archivo es una fila de la tabla `docs` (tipo, nombre, carpeta padre, color). Los archivos van al mismo almacenamiento privado `adjuntos`, bajo `docs/`, con un máximo de 50 MB cada uno.
- Funciones: `doc_set` (crear, renombrar, mover), `doc_delete_many` (a la papelera), `doc_restore_many` y `doc_purge_many` (eliminar para siempre). Todas exigen la clave del equipo.
- Lo borrado queda 30 días en la papelera de documentos; una carpeta se restaura con todo lo que tenía. Pasado ese plazo, la página elimina el archivo guardado la próxima vez que alguien la abre (`board_load` sigue enviando lo borrado hasta 45 días para eso).
- El plan gratuito de Supabase da 1 GB de almacenamiento en total, compartido entre documentos y adjuntos de tarjetas.
- Accesos directos: filas `type: "link"` con `target` (el id del original). Si el original se borra, el acceso directo queda «roto» y ofrece restaurarlo o borrarse.
- Acceso rápido: carpetas o archivos con `pinnedAt`; lo ven todos.
- Copiar crea filas nuevas que apuntan al mismo archivo guardado; el archivo solo se elimina cuando ya nadie lo usa (`attachment_in_use`).

## Opciones y tema

El botón «Opciones» del encabezado reúne el tema (claro, oscuro o igual que el dispositivo), cambiar de persona, equipo y nombre del tablero, actualizar datos, instalar la app, atajos de teclado y «Acerca de».
El botón de sol o luna cambia entre modo claro y oscuro. La elección se guarda en cada dispositivo (`tb-theme` en el navegador); sin elección, el tablero sigue el modo del dispositivo.

## Reuniones que se repiten

Una reunión (o evento) puede repetirse con las mismas opciones que las tareas: cada día, semana, mes (también «Varios días» o «el cuarto lunes»), trimestre o año, con una fecha final opcional.

- Se guarda una sola fila en `meetings` con `repeat` (la regla), `until` (último día o vacío) y `skip` (fechas quitadas). La página muestra una reunión por fecha.
- Al cambiar o borrar una fecha se pregunta «Solo esta» o «Esta y las siguientes». «Solo esta» guarda esa fecha como fila propia con `seriesId` y `occ` (la fecha original) y la agrega a `skip`; así cada fecha puede tener sus propios acuerdos. «Esta y las siguientes» cierra la serie el día anterior (`until`) y empieza una nueva.
- Arrastrar una fecha en el calendario mueve solo esa fecha.
- No hizo falta cambiar Supabase: todo vive en el JSON de cada reunión.
