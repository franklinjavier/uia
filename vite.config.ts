import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

// Lists every built file in /precache.json, so the service worker
// (public/sw.js) can fetch them all once the first page is up: opening
// another example then never waits on the network. Big files (the code
// highlighter's grammars) stay on demand.
function precacheList(): Plugin {
  return {
    name: "uia-precache-list",
    apply: "build",
    generateBundle(_, bundle) {
      const size = (o: (typeof bundle)[string]) => (o.type === "chunk" ? o.code.length : o.source.length)
      const built = Object.values(bundle).filter((o) => o.fileName.startsWith("assets/"))
      // `all`: what this deploy serves (older files can go); `eager`: what to fetch ahead.
      const list = {
        all: built.map((o) => `/${o.fileName}`),
        eager: built.filter((o) => size(o) < 150_000).map((o) => `/${o.fileName}`),
      }
      this.emitFile({ type: "asset", fileName: "precache.json", source: JSON.stringify(list) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), precacheList()],
  // Reachable from the tailnet for testing on the phone.
  server: { allowedHosts: [".ts.net"] },
  // Imports keep the paths a consumer's project uses (`@/components/ui/…`,
  // `@/lib/…`); in this repo they live under registry/ (what ships).
  resolve: {
    alias: [
      { find: /^@\/components\//, replacement: resolve(import.meta.dirname, "registry") + "/" },
      { find: /^@\/lib\//, replacement: resolve(import.meta.dirname, "registry/lib") + "/" },
      { find: /^@\/hooks\//, replacement: resolve(import.meta.dirname, "registry/hooks") + "/" },
      { find: /^@\/examples\//, replacement: resolve(import.meta.dirname, "registry/examples") + "/" },
    ],
  },
})
