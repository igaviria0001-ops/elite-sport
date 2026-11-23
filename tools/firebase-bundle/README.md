# Cómo se generó js/vendor/firebase.js

Firebase va empaquetado dentro de la app (un solo archivo) para no depender de otros servidores y para que el service worker lo guarde y la app abra sin internet.

```bash
npm install firebase esbuild
npx esbuild fb-entry.js --bundle --format=esm --minify --target=es2019 --legal-comments=none \
  --alias:re2js=./re2js-shim.js --outfile=../../js/vendor/firebase.js
```

- `fb-entry.js`: las funciones de Firebase que usa la app.
- `re2js-shim.js`: reemplazo liviano de una librería de expresiones regulares que Firestore solo usa en «pipelines» (la app no los usa). Ahorra unos 150 KB.

Versión empaquetada: firebase 13.4.0.
