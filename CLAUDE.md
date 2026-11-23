# Elite Independiente — instrucciones para cambios futuros

App web del club Elite Independiente (aparte de GameHub). Vive en https://igaviria0001-ops.github.io/elite-sport/ (GitHub Pages, rama `main`, raíz). Datos en Firebase, proyecto `elite-sport-ea360` (Firestore + sesión anónima). El código de anfitrión vive solo en `firestore.rules` (nunca en el código de la app). Ignacio autorizó publicar `js/config.js` con los datos de Firebase en este repositorio público (esos datos no son secretos).

## Regla de oro: una actualización nunca puede borrar datos ni cerrar sesiones

Los celulares se actualizan solos (revisan `version.json`) y, durante unos minutos, conviven aparatos con la versión vieja y la nueva. Por eso:

1. **Datos del servidor (Firestore):** no renombrar ni borrar colecciones ni campos (`users`, `cats`, `players`, `matches`, `rivals`, `train`, `kits`, `att`, `pay`, `log`, `img`, `hostkeys/{código}/members`). Lo nuevo se agrega como campo opcional con valor por defecto. Si de verdad hay que cambiar la forma de algo, el código nuevo debe leer el formato viejo y el nuevo.
2. **Sesión:** no tocar `initializeAuth` ni su persistencia (IndexedDB + localStorage), el nombre de la app de Firebase (`[DEFAULT]`) ni `js/config.js`. Cambiar eso cierra la sesión de todos.
3. **Datos del aparato:** no renombrar las claves `es_*` de localStorage (`hk` anfitrión, `me` perfil, `lock` intentos, `tab`, `fcat`, `dv`, `upd`, `paypop` aviso de pago del día) ni la base IndexedDB `es-img`. Si hace falta cambiarlas, subir `DATA_V` en `js/main.js` y escribir la migración en `migrate()`.
4. **Reglas (`firestore.rules`):** deben seguir funcionando con la versión anterior de la app. Claude no puede publicarlas: hay que darle a Ignacio el texto completo para pegar en Firebase → Firestore → Reglas → Publicar, y avisarle.
5. **Dominio compartido:** todas las apps de igaviria0001-ops.github.io comparten localStorage, IndexedDB y caché. Usar siempre el prefijo `es_` / `es-` / `elite-sport-`, y el service worker solo borra sus propias copias (`elite-sport-…`).

## Pagos y recordatorios

- `pay/{jugador}`: `m.{AAAA-MM}` = pago registrado `{t, by, v}`; `tel` = WhatsApp del acudiente (solo lo ven anfitriones y el propio jugador); `rem.{AAAA-MM}` = cuándo se le recordó por WhatsApp.
- `club/main`: `due` = día límite de pago (1–28, por defecto 5), `free.{AAAA-MM}` = mes que no se cobra, `msg` = mensaje de recordatorio propio (`{jugador}`, `{mes}`, `{valor}`, `{fecha}`).
- WhatsApp no deja enviar mensajes sin que alguien toque «Enviar» (salvo con la API de WhatsApp Business, que es de pago y necesita servidor): la app abre `wa.me` con el mensaje listo.
- El jugador que debe ve una franja en todas las pantallas y un aviso grande una vez al día; desaparece al registrar el pago.
- En pruebas (`?who=…`) se puede simular la fecha con `&hoy=AAAA-MM-DD`.

## Cómo publicar un cambio

1. Hacer el cambio.
2. Correr las pruebas (ver `pruebas/README.md`): `flow`, `extra`, `borrar`, `pagos`, `update`, `install`. Todas deben pasar.
3. `node tools/version.mjs` (marca la versión nueva: `version.json`, `js/version.js` y el nombre de caché de `sw.js`). **Sin esto los celulares no se enteran de la actualización.**
4. Commit y `git push origin main`.
5. Confirmar que GitHub Pages publicó: `https://api.github.com/repos/igaviria0001-ops/elite-sport/actions/runs?per_page=1` (debe salir el commit con `completed` / `success`).

## Cómo se actualizan los aparatos (js/main.js)

- Revisan `version.json` al abrir, al volver a la app y cada 3 minutos.
- Si hay versión nueva, recargan solos **solo** cuando todo está guardado en el servidor, no hay ventanas abiertas y nadie está escribiendo (si la app está en segundo plano, de una vez). Después muestran «App actualizada ✓».
- El service worker pide siempre al servidor la versión más nueva (`cache: 'no-cache'`) y guarda copia para abrir sin internet.
- Si algo no arranca, la app ofrece «Reparar y recargar» (borra solo la copia de archivos, nunca datos ni sesión).
