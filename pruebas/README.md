# Pruebas automáticas

Corren la app en **modo local** (servidor simulado con las mismas reglas que Firebase) con varias personas a la vez (`?who=nombre` = un celular distinto). Cada prueba levanta su propio servidor local.

Necesitan Node 18+, Python 3 y Playwright con Chrome (`npm i playwright`; si Chrome no está en `/usr/bin/google-chrome`, indicar la ruta con `CHROME=/ruta/al/chrome`).

| Prueba | Qué comprueba |
|---|---|
| `node pruebas/flow.mjs` | Registro (nombre real, foto), código de anfitrión y límite de intentos, categorías, alineación, partidos, entrenos con fotos, aprobar jugadores, pagos, asistencia, permisos (un jugador no puede escribir ni ver pagos ajenos), sesión guardada, quitar anfitrión en vivo. |
| `node pruebas/extra.mjs` | Editar partido/entreno, cambio de formación, borrar categoría en cascada, código antes del registro, persona borrada vuelve al registro. |
| `node pruebas/update.mjs` | Publicar versiones nuevas con la app abierta: no recarga si alguien escribe, se actualiza sola después, conserva sesión, rol y datos, se repara si otra app borra copias, sin bucles. |
| `node pruebas/borrar.mjs` | Un anfitrión se borra a sí mismo y borra a otra persona: no queda su nombre en Personas, plantel, alineación, pagos, registro ni anfitriones; lo que creó para el club se conserva. |
| `node pruebas/install.mjs` | Que Chrome la considere instalable y que abra sin internet. |

Las capturas quedan en `/tmp/elite-capturas-*.png`.
