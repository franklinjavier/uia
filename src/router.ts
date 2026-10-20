import * as React from "react"

// The playground's router: real paths on the History API, no dependency.
// `/fleet`, `/davinci2/rules`. Query flags (`?bare`) ride along on every
// navigation. Production serves index.html for unknown paths (wrangler.jsonc).

const NAVIGATE = "uia:navigate"

export function navigate(to: string, { replace = false } = {}) {
  const url = to + window.location.search
  if (url === window.location.pathname + window.location.search) return
  window.history[replace ? "replaceState" : "pushState"](null, "", url)
  window.dispatchEvent(new Event(NAVIGATE))
}

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange)
  window.addEventListener(NAVIGATE, onChange)
  return () => {
    window.removeEventListener("popstate", onChange)
    window.removeEventListener(NAVIGATE, onChange)
  }
}

/** The path split into segments: `/davinci2/threads/blog` → ["davinci2", "threads", "blog"]. */
export function usePath(): string[] {
  const path = React.useSyncExternalStore(subscribe, () => window.location.pathname)
  return React.useMemo(() => path.split("/").filter(Boolean).map(decodeURIComponent), [path])
}
