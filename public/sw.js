// The playground's service worker: reloads come from the device, not the
// network. The page (the same index.html for every route) is answered from
// the cache at once and refreshed in the background; when a deploy changed
// it, the open tabs are told so they can pick it up. Built files carry a
// hash in their name, so once cached they are served from here forever.
// The registry (/r/*) and anything off this origin pass straight through.

const SHELL = "uia-shell-v1"
const ASSETS = "uia-assets-v1"
// The root: every route serves the same page (asking for /index.html redirects here).
const PAGE = "/"

self.addEventListener("install", () => self.skipWaiting())

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

async function refreshPage() {
  const res = await fetch(PAGE, { cache: "no-cache" })
  if (!res.ok) return res
  const cache = await caches.open(SHELL)
  const old = await cache.match(PAGE)
  const changed = !old || (await old.clone().text()) !== (await res.clone().text())
  await cache.put(PAGE, res.clone())
  if (old && changed) {
    for (const client of await self.clients.matchAll({ type: "window" })) client.postMessage({ type: "uia:updated" })
  }
  return res
}

self.addEventListener("fetch", (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/r/")) return

  if (req.mode === "navigate") {
    const fresh = refreshPage()
    event.waitUntil(fresh.catch(() => {}))
    event.respondWith(
      caches.match(PAGE).then((hit) => hit ?? fresh.catch(() => fetch(req)))
    )
    return
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      })
    )
  }
})
