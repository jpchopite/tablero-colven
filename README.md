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

## Acceso con clave

El tablero pide la clave del equipo. Con «Recordar en este dispositivo» (marcado por defecto) la clave queda guardada en ese navegador (`tb-team-key`) y esa computadora o teléfono entra directo las próximas veces; sin marcarlo, se pide de nuevo al cerrar el navegador.
«Cerrar sesión en este dispositivo» (en Opciones y al pie de la página) borra la clave guardada. Si la clave cambia, todos los dispositivos la vuelven a pedir.

Antes el tablero abría sin clave con `OPEN_KEY`, registrada en `private.open_keys`. Ahora `OPEN_KEY = ""`; para que esa clave vieja deje de servir también en el servidor, hay que vaciar `private.open_keys` en Supabase.

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
- Descargar carpetas: clic derecho en una carpeta (o en el fondo de una carpeta abierta) → «Descargar (.zip)», o «Descargar» en la barra de selección con varios elementos. La página arma el .zip en el navegador (sin comprimir, con las subcarpetas, también las vacías) a partir de los enlaces firmados de cada archivo; los anexos van junto a su archivo, los accesos directos a archivos traen el original y los accesos directos a carpetas se omiten. Por encima de 500 MB pide confirmar.

## Facturación

La sección «Facturación» (`#facturacion`) calcula el precio por campo de los contratos CPPH de las subcuencas Barinas (Maporal, Silvestre, Hato Viejo, Sinco Zona 2 y Sinco Zona 3) y Apure (Guafita y La Victoria), y el monto a facturar por subcuenca, igual que el libro «Cálculo Factura».

- Premisas de cada mes:
  - Marcadores internacionales (Mars, Brent, Dubái y Omán), de Platts.
  - Factor K por crudo y factor AGA por campo, de la resolución del ministerio (cerca del 15).
  - IPC de EE.UU., que ajusta el ACC.
  - Producción del acta y °API por campo. El °API decide el crudo: Merey 16, Mesa 30 o Santa Bárbara.
  - Factores de ponderación, que vienen en el oficio anual del ministerio.
- El IPC (CPI-U sin ajuste estacional, serie `CUUR0000SA0`) se trae solo del BLS y queda guardado en el dispositivo (`tb-cpi`). El ACC de cada punto de entrega es el de enero de 2024 (base 308,417) multiplicado por IPC del mes / 308,417. El de enero de 2024 se compone de 0,0045 $/bl por km, más 0,9778 de manejo y 0,25 de honorarios.
- Precio por mercado:
  - Merey 16: 0,9 × Mars (Golfo y Caribe), 0,85 × Brent (Europa) y 0,9 × promedio Dubái–Omán (Asia).
  - Mesa 30: Mars, 0,95 × Brent y el promedio Dubái–Omán, sin descuento.
  - A cada uno se le suma K y AGA y se le resta el ACC. El precio del campo es la suma ponderada por los factores.
- Volumen a pagar:
  - Si la producción del acta de la subcuenca está por debajo del tope, se paga la producción por encima de la base diaria. Ese excedente se reparte entre los campos según su peso en el acta.
  - Desde el tope en adelante se paga la participación económica de toda la producción.
  - Barinas: base 4.400 b/d, tope 9.200, participación 53 %. Apure: base 3.700, tope 8.800, participación 58 %.
- Los meses se guardan con «Guardar» en la configuración del tablero (`fact`), para que todo el equipo vea las mismas cifras. Lo que se escribe queda como borrador en el dispositivo hasta guardar. Un mes nuevo empieza en blanco: solo trae el IPC del BLS y los factores de ponderación del mismo año (son anuales). Septiembre de 2026 trae los valores del Excel.
- «Cómo se calcula»: al elegir un campo (o tocar su fila en «Precio por campo»), muestra su fórmula con los números del mes: barriles a pagar según el acta y el tope, precio en cada mercado (marcador + K + AGA − ACC) por su factor de ponderación, el ACC con el IPC, y el monto. Cada número con borde punteado lleva a la casilla de donde sale; si falta un dato, dice «falta».
- Documentos del mes: «Subir documento» pide el archivo y luego su tipo (Factor K, Marcadores internacionales, Factor AGA o Acta de fiscalización); cada tipo tiene además su propio «Subir». «Vincular» elige un archivo que ya está en Documentos y lo agrega como acceso directo, sin copiarlo; quitarlo solo quita el vínculo. Los archivos se guardan en Documentos › Facturación › <mes> › <tipo>, así que también se ven y se buscan en Documentos; «Quitar» los manda a la papelera de Documentos. Los documentos no llenan las cifras solos.
- «Importar Excel»: elige el Excel «Cálculo Factura» del mes y llena todo de una vez: producción y °API del acta, marcadores, K, AGA, factores de ponderación (hoja «0._Datos») y el IPC (hoja «0.1_ACC», fila del mes). Se lee en el navegador con SheetJS, sin subir el archivo; los datos se buscan por sus etiquetas, no por celdas fijas. Si el Excel es de otro mes, se abre ese mes. Todo entra en amarillo, sin guardar.
- Llenar las cifras con Claude (con la cuenta de Claude de cada persona, sin costo aparte): «Copiar instrucciones» en el tipo copia un mensaje para ese tipo y ese mes; se pega en Claude junto con el documento, y la respuesta de Claude (un JSON) se pega en «Pegar valores». Del acta se toman la producción del mes (bls/mes) y el °API de cada campo. El IPC del ACC no necesita documento: se trae solo del BLS. Cada número entra a su casilla del mes como borrador, en amarillo, con la nota de Claude; nada se guarda hasta «Guardar», y «Descartar» lo quita. Una respuesta de otro mes se rechaza. Funciona también con documentos escaneados, porque los lee Claude.

## Opciones y tema

Las secciones van en una barra arriba, como la navegación de un sitio, con el logo sobre un bloque azul; Buscar, Actividad y «Opciones» están en esa barra como íconos, junto a «Nueva tarea». «Opciones» reúne el tema (claro, oscuro o igual que el dispositivo), cambiar de persona, equipo y nombre del tablero, recordatorios, actualizar datos, instalar la app (cuando el navegador lo permite), atajos de teclado y «Acerca de».
El tema se guarda en cada dispositivo (`tb-theme` en el navegador); sin elección, el tablero sigue el modo del dispositivo.

## Diseño

El tablero tiene un solo diseño, «Corporativo» (`designs.css`, activado por `design.js`): Inicio abre con la foto de la oficina (`assets/oficina/inicio.webp`, provisional) y las cifras en una franja blanca; las demás secciones abren con su nombre como título grande; la página termina en un pie azul con el logo. En claro, la página es gris suave y cada bloque va en blanco; en oscuro usa tres niveles de azul. El logo de Colven va siempre sobre el azul de la marca.

Los diseños anteriores (Original, Aire, Línea, el dock y las propuestas B y C) están en `archivo/disenos` y no se cargan.

## Reuniones que se repiten

Una reunión (o evento) puede repetirse con las mismas opciones que las tareas: cada día, semana, mes (también «Varios días» o «el cuarto lunes»), trimestre o año, con una fecha final opcional.

- Se guarda una sola fila en `meetings` con `repeat` (la regla), `until` (último día o vacío) y `skip` (fechas quitadas). La página muestra una reunión por fecha.
- Al cambiar o borrar una fecha se pregunta «Solo esta» o «Esta y las siguientes». «Solo esta» guarda esa fecha como fila propia con `seriesId` y `occ` (la fecha original) y la agrega a `skip`; así cada fecha puede tener sus propios acuerdos. «Esta y las siguientes» cierra la serie el día anterior (`until`) y empieza una nueva.
- Arrastrar una fecha en el calendario mueve solo esa fecha.
- No hizo falta cambiar Supabase: todo vive en el JSON de cada reunión.

## Agregar una reunión a tu calendario

El calendario suscrito por enlace (función `calendario` en Supabase) se actualiza solo, pero no trae avisos, y Google Calendar no da recordatorios para calendarios suscritos (y los revisa cada pocas horas).

- Sincronizado y con avisos en Android: la app ICSx⁵ se suscribe al enlace (botón «Suscribirse en este teléfono», un enlace `webcal://`), lo revisa cada 15 minutos y agrega un aviso predeterminado a cada reunión; el calendario se ve en Google Calendar y Samsung Calendar. En iPhone el mismo botón abre la suscripción del Calendario.

Para una copia suelta de una reunión, cada reunión tiene dos botones:

- «Agregar a Google Calendar»: abre Google Calendar con la reunión ya escrita (hora de Caracas, lugar o enlace, temas). Queda como evento propio y usa los recordatorios de esa persona. Una reunión que se repite se agrega como serie («Agregar la serie…») desde esa fecha, con su fecha final.
- «Otro calendario (.ics)»: descarga un archivo para Samsung Calendar, iPhone u Outlook con avisos 1 hora, 30 y 10 minutos antes (los de todo el día, a las 7:00).
- Son copias: si la reunión cambia en el tablero, hay que agregarla de nuevo. Las fechas sueltas cambiadas o quitadas de una serie no se copian.

## Recordatorios de reuniones

El botón «Avisos» del Calendario (o Opciones → «Recordatorios de reuniones») activa avisos en cada teléfono o computadora: un resumen a las 7:00 con las reuniones y eventos del día, y avisos 1 hora, 30 minutos y 10 minutos antes de cada reunión (cada uno se puede apagar), de «las mías» (las que tienen a esa persona en «Del equipo»; las que no tienen a nadie marcado avisan a todos) o de todas. Llegan aunque el tablero esté cerrado.

- Android: Chrome. iPhone y iPad: solo con el tablero agregado a la pantalla de inicio (iOS 16.4 o más reciente).
- Cada dispositivo es una fila de `push_subs` (la página la guarda con `push_sub_set`, que exige la clave del equipo). `push_sent` evita avisar dos veces la misma fecha.
- La función `recordatorios` (código en `supabase/functions/recordatorios/`) corre cada minuto con un trabajo de `pg_cron`, calcula las fechas de las reuniones que se repiten igual que la página y envía los avisos (web push con claves VAPID; la función crea el par en su primera llamada y lo guarda en la tabla `push_keys`, que solo ella puede leer con la clave de servicio; la página le pide la pública). `sw.js` los muestra y al tocarlos abre el calendario.
- Los avisos previos son para reuniones y eventos con hora; los de todo el día solo salen en el resumen de las 7:00, que no se envía si ese día no hay nada. Lo cancelado o realizado no avisa. La hora es la de Caracas (UTC-4).
- Cada dispositivo guarda `leads` (60, 30, 10) y `morning` en `push_subs`. Si alguien activa los avisos 25 minutos antes de una reunión, recibe solo el aviso más reciente (30 min), no todos los atrasados.
- Los avisos previos funcionan como una alarma: vibran, se quedan hasta que se cierran y traen «Posponer 5 min» y «Listo». Al tocarlos, el tablero muestra la reunión en pantalla completa (parámetro `?alarma=` o un mensaje de `sw.js` si ya está abierto); si el tablero está abierto cuando llega el aviso, suena y vibra. «Posponer 5 min» guarda el aviso en `push_sent` como `pospuesto@<hora>@<aviso>` y la función lo vuelve a enviar a los 5 minutos.
- Que el aviso aparezca encima de la pantalla en Android depende del teléfono: Ajustes → Apps → Chrome → Notificaciones → Sitios → jpchopite.github.io → «Mostrar en pantalla» («Ventana emergente» en Samsung). El panel de recordatorios lo explica en Android.
- El ícono pequeño de la barra de estado es `assets/badge-96.png`: Android solo usa su transparencia, por eso es la espiral en blanco sobre fondo transparente.
- La configuración de Supabase está en `supabase/recordatorios.sql`.
