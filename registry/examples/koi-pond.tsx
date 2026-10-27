import * as React from "react"

import { KoiPond } from "@/components/blocks/koi-pond"

// Example: the pond as a page's backdrop. A short line types itself in, the
// text stays readable over the water, and the corner counts what was eaten.

const LINE = "in a pond of patient things, cast a little food"

export function KoiPondExample() {
  const [fed, setFed] = React.useState(0)
  const [typed, setTyped] = React.useState(0)

  React.useEffect(() => {
    if (typed >= LINE.length) return
    const id = window.setTimeout(() => setTyped((n) => n + 1), typed === 0 ? 500 : 38)
    return () => window.clearTimeout(id)
  }, [typed])

  return (
    <KoiPond className="h-svh w-full cursor-crosshair" onFeed={setFed}>
      <div className="pointer-events-none relative mx-auto flex h-full max-w-xl flex-col justify-center gap-6 px-6">
        <p className="font-mono text-sm text-muted-foreground">
          {LINE.slice(0, typed)}
          <span className="ml-0.5 inline-block h-[1.1em] w-[0.55em] translate-y-[0.2em] animate-pulse bg-foreground/70" />
        </p>
        <p className="max-w-md text-sm text-foreground">
          Click anywhere to drop food. The koi turn for it.
        </p>
      </div>
      <span className="pointer-events-none absolute top-5 right-6 eyebrow text-muted-foreground tabular-nums">
        {fed} fed
      </span>
    </KoiPond>
  )
}
