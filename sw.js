const CACHE = "btb-v6";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.url.includes("supabase.co")) return; // Supabase immer live
  const isDoc = req.mode === "navigate" || req.url.endsWith("/") || req.url.endsWith("index.html");
  if (isDoc) {
    // Netzwerk zuerst -> immer aktuelle App; offline aus Cache
    e.respondWith(
      fetch(req).then((resp) => { const c = resp.clone(); caches.open(CACHE).then((x) => x.put("./index.html", c)).catch(() => {}); return resp; })
        .catch(() => caches.match(req).then((h) => h || caches.match("./index.html")))
    );
    return;
  }
  // Assets (React/Tailwind/jsPDF u.a.): Cache zuerst, sonst Netz und cachen
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((resp) => { const c = resp.clone(); caches.open(CACHE).then((x) => x.put(req, c)).catch(() => {}); return resp; }).catch(() => caches.match("./index.html")))
  );
});
