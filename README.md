# Elite Independiente

App web (instalable en el celular) para administrar el club **Elite Independiente**: categorías, plantel y alineaciones, partidos, entrenamientos, asistencia y pagos. Todo se sincroniza en vivo entre los celulares de los anfitriones, los jugadores y las familias.

**App:** https://igaviria0001-ops.github.io/elite-sport/

## Qué hace

- **Registro con foto y nombre real.** La primera vez cada persona pone su foto (con recorte) y su nombre y apellido; se rechazan nombres falsos, con números o groserías. La sesión queda guardada en el celular.
- **Anfitriones protegidos.** El acceso de anfitrión está en una esquina discreta y pide un código una sola vez por celular. Tiene límite de intentos con bloqueo creciente (15 min, 1 h, 6 h, 24 h). El código no está en el código de la app: vive solo en las reglas de Firebase, y el servidor rechaza cualquier cambio de quien no sea anfitrión.
- **Categorías:** plantel con foto, número y posición, cuota mensual, alineación en cancha (Fútbol 5 a 11) y suplentes.
- **Partidos:** rival con escudo, lugar, fecha y hora, categoría, uniforme, marcador (Ganado / Empate / Perdido) y edición.
- **Entrenamientos:** tipo (técnico, táctico, físico, porteros, definición, partido de práctica, recuperación), qué se trabaja, repetición semanal y fotos.
- **Asistencia:** presente, tarde o ausente por día, con «Todos presentes». Cada jugador ve la suya.
- **Pagos:** mes a mes, con un toque por jugador, totales recaudados y pendientes, filtros, búsqueda, historial del año, plazo de pago y meses sin cobro. Cada jugador ve solo sus propios pagos.
- **Recordatorios de pago:** del 1 al día del plazo el anfitrión ve una tarjeta para recordar por WhatsApp a cada acudiente (mensaje listo, un toque por persona) o al grupo del club. Quien debe ve una franja «Recuerda pagar» en todas las pantallas y un aviso grande al abrir la app, que desaparecen apenas se registra su pago.
- **Personas:** quién se registró, agregarlo al plantel o vincularlo con su ficha, y manejo de anfitriones.
- **Funciona sin internet** con lo último que cargó; los cambios se envían solos al volver la conexión.
- **Registro de cambios** y **copia de seguridad** para anfitriones.

## Actualizaciones

Cuando se publica una versión nueva, todos los celulares se actualizan solos en pocos minutos, sin perder datos ni la sesión: esperan a que todo esté guardado y a que nadie esté escribiendo, y luego recargan. Los detalles para quien haga cambios están en [CLAUDE.md](CLAUDE.md) y las pruebas en [pruebas/](pruebas/README.md).

## Cómo ponerla en línea

Ver **[GUIA.md](GUIA.md)**: crear el proyecto gratis de Firebase, pegar `firestore.rules`, poner la configuración en `js/config.js` y activar GitHub Pages.

Mientras `js/config.js` esté vacío, la app corre en **modo local** (solo en ese aparato, sin sincronizar). En ese modo el código de prueba para anfitrión es `DEMO`. Para forzarlo aunque haya configuración: agregar `?local` a la dirección.

## Estructura

```
index.html              página principal
css/app.css             estilos
js/main.js              arranque y dibujo de la pantalla
js/state.js             datos sincronizados, rol y lecturas en vivo
js/views.js             pantallas
js/actions.js           lo que pasa al tocar algo
js/onboard.js           registro, recorte de foto, código de anfitrión y perfil
js/backend.js           conexión con Firebase (Firestore + sesión anónima) y fotos
js/local.js             modo local (imita Firebase, con las mismas reglas)
js/config.js            configuración de Firebase
js/vendor/firebase.js   Firebase empaquetado (no depende de otros servidores)
firestore.rules         reglas de seguridad (aquí está el código de anfitrión)
sw.js, manifest.webmanifest   app instalable y apertura sin internet
assets/                 escudo, uniformes, íconos y letras (Barlow)
tools/firebase-bundle/  cómo se generó js/vendor/firebase.js
tools/version.mjs       marca una versión nueva (correr antes de publicar)
version.json, js/version.js   versión publicada / versión que trae el código
pruebas/                pruebas automáticas
```

## Datos en Firestore

| Colección | Qué guarda | Quién la ve | Quién la cambia |
|---|---|---|---|
| `users` | perfil de cada persona (nombre, foto, categoría pedida) | todos | cada uno el suyo; anfitriones |
| `tels` | WhatsApp del acudiente que paga | cada uno el suyo; anfitriones | cada uno el suyo; anfitriones |
| `club` | plazo de pago, meses sin cobro, mensaje de recordatorio | todos | anfitriones |
| `cats`, `players`, `matches`, `rivals`, `train`, `kits`, `att` | datos del club | todos | anfitriones |
| `pay` | pagos por jugador y mes | anfitriones; cada jugador el suyo | anfitriones |
| `log` | registro de cambios | anfitriones | anfitriones |
| `img` | fotos (cada una se descarga una sola vez y queda en el celular) | todos | quien la sube |
| `hostkeys/{código}/members` | anfitriones | anfitriones | quien sabe el código |
