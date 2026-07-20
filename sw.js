/* ayatulkuran — servis calisani (cevrimdisi kullanim)
   Yeni surum yayinlarken asagidaki SURUM satirini degistirin; eski onbellek silinir. */
const SURUM = 'v1.8.1';
const AD    = 'ayatulkuran-' + SURUM;

const CEKIRDEK = [
  '/', '/index.html', '/manifest.json',
  '/icon-192.png', '/icon-512.png', '/og.png'
];

const VERI = /raw\.githubusercontent\.com\/.+\.(json|md)/;   // ayet verisi, esma, hakkinda
const ATLA = /googletagmanager|google-analytics|visitorbadge/;

// Veri adresleri ?t=zaman ile geliyor; onbellege sorgusuz adresle yaziyoruz,
// yoksa her istek ayri kayit olur ve cevrimdisi eslesme hic tutmaz.
// Onbellekten donen yanita isaret koyariz; uygulama boylece gercekten
// baglantisi mi var yoksa kayitli veriyi mi okuyor, ayirt edebilir.
function isaretle(y) {
  if (!y) return y;
  const h = new Headers(y.headers);
  h.set('X-Onbellek', '1');
  return new Response(y.body, { status: y.status, statusText: y.statusText, headers: h });
}

function anahtar(url) {
  const u = new URL(url);
  return new Request(u.origin + u.pathname, { mode: 'cors' });
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(AD)
      .then(c => Promise.allSettled(CEKIRDEK.map(y => c.add(y))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(x => x !== AD).map(x => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (ATLA.test(u.hostname)) return;                      // olcum istekleri onbelleklenmez

  // 1) Sayfalar: once ag (yeni surum aninda gelsin), internet yoksa onbellek
  if (r.mode === 'navigate' || (r.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(r).then(y => { const k = y.clone(); caches.open(AD).then(c => c.put(r, k)); return y; })
              .catch(() => caches.match(r).then(x => isaretle(x || undefined) ||
                        caches.match('/index.html').then(isaretle)))
    );
    return;
  }

  // 2) Veri: once ag, internet yoksa onbellek (sorgusuz adresle)
  if (VERI.test(r.url)) {
    const a = anahtar(r.url);
    e.respondWith(
      fetch(r).then(y => { const k = y.clone(); caches.open(AD).then(c => c.put(a, k)); return y; })
              .catch(() => caches.match(a).then(isaretle))
    );
    return;
  }

  // 3) Kendi dosyalarimiz (simgeler, sure sayfalari): once onbellek, arkada tazele
  if (u.origin === location.origin) {
    e.respondWith(
      caches.match(r).then(x => {
        const ag = fetch(r).then(y => { const k = y.clone(); caches.open(AD).then(c => c.put(r, k)); return y; })
                           .catch(() => x);
        return x || ag;
      })
    );
  }
});
