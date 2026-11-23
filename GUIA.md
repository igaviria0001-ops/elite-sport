# Guía: poner Elite Independiente en línea

Son 3 partes. Hay que hacerlas una sola vez y toman unos 10 minutos.

---

## Parte 1 · Firebase (la base de datos gratis de Google)

Ahí se guardan los datos y desde ahí se sincronizan todos los celulares. El plan gratis alcanza de sobra para un club y **no pide tarjeta**.

1. Entra a **https://console.firebase.google.com** con tu cuenta de Google.
2. **Crear un proyecto** → nombre: `elite-sport` → cuando pregunte por **Google Analytics**, desactívalo (no hace falta) → **Crear proyecto**.
3. **Activar el inicio de sesión anónimo** (así cada celular queda identificado sin pedir correo ni clave):
   - En el menú de la izquierda busca **Authentication** (puede estar dentro de *Compilación / Build* o de *Seguridad / Security*) → **Comenzar**.
   - Pestaña **Método de acceso** → **Anónimo** → actívalo → **Guardar**.
4. **Crear la base de datos**:
   - En el menú de la izquierda busca **Firestore Database** (puede estar dentro de *Compilación / Build* o de *Databases & Storage*) → **Crear base de datos**.
   - Si pregunta la edición, elige **Standard** (no Enterprise). El ID de la base de datos déjalo como **(default)**: si le pones otro nombre, la app no la encuentra.
   - Ubicación: `southamerica-east1 (São Paulo)` (o la que sugiera). Esto no se puede cambiar después.
   - Elige **Modo de producción** → **Crear**.
5. **Pegar las reglas de seguridad** (aquí vive el código del anfitrión):
   - En Firestore, pestaña **Reglas**.
   - Borra todo lo que hay y pega el contenido completo del archivo `firestore.rules`.
   - **Publicar**.
6. **Registrar la app web**:
   - Arriba a la izquierda, ⚙ → **Configuración del proyecto**.
   - Abajo, en **Tus apps**, toca el ícono web **`</>`** → apodo: `Elite Independiente` → **no** marques Hosting → **Registrar app**.
   - Aparece un bloque que empieza con `const firebaseConfig = {`. **Cópialo y mándaselo a Claude** (o pégalo tú en `js/config.js`).

> Esos datos de `firebaseConfig` no son secretos: Firebase los diseñó para ir dentro de la app. Lo que protege la información son las reglas del paso 5.

---

## Parte 2 · GitHub (donde vive la app)

1. En GitHub, crea un repositorio **nuevo, vacío y público** llamado **`elite-sport`** (sin README ni nada más).
2. Avísale a Claude con un «listo» y él sube todo.
3. En el repositorio: **Settings → Pages** → *Source*: **Deploy from a branch** → *Branch*: **main** y carpeta **/ (root)** → **Save**.
4. En 1 o 2 minutos la app queda en:
   **https://igaviria0001-ops.github.io/elite-sport/**

---

## Parte 3 · Primer uso

1. Abre el enlace en tu celular. Regístrate con tu foto y tu nombre.
2. Toca **Acceso de anfitrión** (abajo del todo en Inicio, o la llavecita 🔑 en la esquina de la pantalla de registro) y escribe el código **CH67**. Solo te lo pide esa vez en ese celular.
3. Crea las categorías, los jugadores, los partidos y los entrenamientos.
4. Comparte el enlace con los jugadores y las familias. Cada uno se registra con foto y nombre real, y te aparece en **Personas** para agregarlo al plantel con un toque.
5. Para tenerla como app: botón **Instalar la app en el celular** (en Inicio).

---

## Preguntas frecuentes

**¿Cómo cambio el código de anfitrión?**
En Firebase → Firestore → Reglas, cambia `CH67` por el nuevo código en las **dos** líneas marcadas con «CÓDIGO» y publica. Los anfitriones actuales tendrán que escribir el código nuevo una vez.

**¿Cómo le quito el rol a un anfitrión?**
En la app: **Personas → Anfitriones → Quitar**.

**¿Qué pasa si alguien se queda sin internet?**
La app sigue funcionando con lo último que cargó. Los cambios del anfitrión se guardan en el celular y se envían solos cuando vuelve la conexión (arriba se ve «Sin conexión» o «Guardando…»).

**¿Y si un jugador cambia de celular o borra los datos del navegador?**
Se registra otra vez. El anfitrión lo vincula a su ficha en **Personas → Vincular…** y borra el registro viejo.

**¿Copia de seguridad?**
Como anfitrión: toca tu foto (arriba a la derecha) → **Descargar copia de seguridad**.
