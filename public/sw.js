// Service worker mínimo — solo lo necesario para que la app sea instalable
// (Chrome exige un SW registrado con un handler de 'fetch'). Sin soporte
// offline ni cacheo: no se pidió, y esto es un passthrough puro.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Passthrough intencional: sin esto, Chrome no considera la app
  // instalable. No se responde nada propio.
});
