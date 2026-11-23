/* Service worker de Tickets 811: guarda los archivos de esta pagina para que abra sin senal.
   Si cambias cualquier archivo, sube de numero la version (v811-1 -> v811-3) para forzar la actualizacion. */
var V = 'v811-6';
var FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return Promise.all(FILES.map(function (f) { return c.add(f).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);
  if (u.origin !== location.origin) return;               // lo de Google no se toca

  if (r.mode === 'navigate') {                            // la pagina: primero internet (version nueva), si no hay, la guardada
    e.respondWith(new Promise(function (ok) {
      var done = false;
      var guardada = function () { return caches.match('./index.html').then(function (m) { return m || Response.error(); }); };
      var t = setTimeout(function () { if (!done) { done = true; guardada().then(ok); } }, 4000);   // senal muy lenta: usa la guardada
      fetch(r.url.split('?')[0], { cache: 'no-cache' }).then(function (res) {
        if (done) return;
        done = true; clearTimeout(t);
        if (res && res.ok) { var cp = res.clone(); caches.open(V).then(function (c) { c.put('./index.html', cp); }); ok(res); }
        else guardada().then(ok);
      }).catch(function () { if (!done) { done = true; clearTimeout(t); guardada().then(ok); } });
    }));
    return;
  }

  e.respondWith(caches.match(r, { ignoreSearch: true }).then(function (m) {   // lo demas: guardado, y se renueva por detras
    var red = fetch(r).then(function (res) {
      if (res && res.ok) { var cp = res.clone(); caches.open(V).then(function (c) { c.put(r, cp); }); }
      return res;
    });
    if (m) { red.catch(function () {}); return m; }
    return red;
  }));
});
