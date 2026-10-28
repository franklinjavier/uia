import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "../registry/theme/index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@/components/ui/tooltip"

// Production: a service worker answers reloads from the device (public/sw.js).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js")
  const loaded = performance.now()
  navigator.serviceWorker.addEventListener("message", (e) => {
    // A new deploy, noticed while this page was just opening: take it now.
    if (e.data?.type === "uia:updated" && performance.now() - loaded < 5000) window.location.reload()
  })
}
// A chunk the open page knows from an older deploy is gone: reload once.
window.addEventListener("vite:preloadError", () => {
  if (sessionStorage.getItem("uia:reloaded")) return
  sessionStorage.setItem("uia:reloaded", "1")
  window.location.reload()
})
window.setTimeout(() => sessionStorage.removeItem("uia:reloaded"), 10_000)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
)
