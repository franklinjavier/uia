import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
