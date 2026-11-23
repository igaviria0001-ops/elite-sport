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
  apiKey: "AIzaSyBpcaxwTMF3VVYD66Wdr8kwcamREeN1bvc",
  authDomain: "elite-sport-ea360.firebaseapp.com",
  projectId: "elite-sport-ea360",
  storageBucket: "elite-sport-ea360.firebasestorage.app",
  messagingSenderId: "518353180582",
  appId: "1:518353180582:web:08e23ed5a98eed6bea6167"
};
