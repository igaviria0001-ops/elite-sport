// ─────────────────────────────────────────────────────────────────────────────
//  Conexión con Firebase (la base de datos en línea de la app).
//
//  Pega aquí los datos de tu proyecto: Firebase → ⚙ Configuración del proyecto
//  → «Tus apps» → la app web → «Configuración del SDK» → «Config».
//
//  Estos datos NO son secretos (Firebase los diseñó para ir dentro de la app).
//  Lo que protege la información son las reglas de seguridad (firestore.rules),
//  y ahí vive también el código de anfitrión: nunca aparece en la app.
//
//  Mientras esto esté vacío, la app funciona en «modo local» (solo en ese
//  aparato, sin sincronizar), útil para probar el diseño.
// ─────────────────────────────────────────────────────────────────────────────
export const FIREBASE = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
