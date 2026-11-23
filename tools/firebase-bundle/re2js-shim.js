// Reemplazo liviano de re2js: Firestore solo lo usa en "pipelines" (no usados por la app).
export const RE2JS = {
  compile(p) {
    const r = new RegExp(p);
    return { matches: (s) => new RegExp('^(?:' + p + ')$').test(s), test: (s) => r.test(s) };
  }
};
