import * as React from "react"

import { cn } from "@/lib/utils"
import { hash, useAsciiCanvas, type AsciiGrid } from "@/hooks/use-ascii-canvas"

// Aurora: the northern lights in ASCII, behind the content. Three curtains
// hang over a treeline, each a sharp lower edge with rays rising off it and
// fading upward, folding slowly as the edge swings. The light is halftone
// in one colour, an upright bar per cell that widens with it, with stars in
// the dark between. Click and a substorm breaks out there: the light flares,
// the brightening runs out along the curtains both ways, and the sky dances
// faster until it calms. Now and then one comes on its own.
//
//   <Aurora className="h-96" onKp={setKp} />

type Storm = { x: number; age: number }

type Sky = {
  width: number
  height: number
  storms: Storm[]
  /** Clicks waiting for the next step. */
  clicks: number[]
  /** How stirred up the sky is; climbs with each storm, settles slowly. */
  activity: number
  /** The curtains' own clock, running faster while the sky is stirred. */
  t: number
  time: number
  /** Seconds until a storm comes on its own. */
  next: number
  kp: number
  onKp?: (kp: number) => void
}

function step(sky: Sky, dt: number, time: number) {
  for (const x of sky.clicks.splice(0)) sky.storms.push({ x, age: 0 })
  sky.next -= dt
  if (sky.next <= 0) {
    sky.storms.push({ x: sky.width * (0.15 + hash(time, 1, 8) * 0.7), age: 0 })
    sky.next = 20 + hash(time, 2, 8) * 15
  }
  for (const s of sky.storms) {
    if (s.age === 0) sky.activity = Math.min(6, sky.activity + 1.3)
    s.age += dt
  }
  sky.storms = sky.storms.filter((s) => s.age < 8)
  sky.activity *= Math.exp(-dt / 14)
  sky.t += dt * (1 + sky.activity * 0.45)
  sky.time = time

  const kp = Math.max(0, Math.min(9, Math.round(1 + sky.activity * 1.4)))
  if (kp !== sky.kp) {
    sky.kp = kp
    sky.onKp?.(kp)
  }
}

/** Where the treeline starts, from the bottom, for column `c`: spruce over low hills. */
function treeline(c: number, rows: number) {
  let top = rows * 0.035 + Math.sin(c * 0.05) * rows * 0.012 + Math.sin(c * 0.013 + 2) * rows * 0.015
  let tree = 0
  for (let j = c - 3; j <= c + 3; j++) {
    if (hash(j, 9, 9) > 0.35) continue
    tree = Math.max(tree, 2 + hash(j, 10, 9) * 4 - Math.abs(c - j) * 2)
  }
  top += tree
  return Math.round(top)
}

function draw(g: AsciiGrid, sky: Sky, accent: string) {
  const { cell, cols, rows } = g
  const H = sky.height
  const T = sky.t
  const stir = sky.activity / (1 + sky.activity)

  for (let c = 0; c < cols; c++) {
    const x = c * cell + cell / 2
    // A storm's brightening runs out from where it broke, both ways along the curtains.
    let boost = 0
    for (const s of sky.storms) {
      const front = Math.abs(x - s.x) - 170 * s.age
      boost += Math.exp(-(front * front) / (2 * 90 * 90)) * Math.exp(-s.age / 3) * 1.4
      boost += Math.exp(-((x - s.x) ** 2) / (2 * 60 * 60)) * Math.exp(-s.age / 1.2)
    }
    const ground = rows - treeline(c, rows)

    for (let r = 0; r < ground; r++) {
      const y = r * cell + cell / 2
      let light = 0
      for (let b = 0; b < 3; b++) {
        const swing = 1 + stir * 0.6
        const edge =
          H * (0.32 + 0.12 * b) +
          H * 0.09 * swing * Math.sin(x * 0.004 + T * 0.15 + b * 2) +
          H * 0.035 * swing * Math.sin(x * 0.012 - T * 0.27 + b)
        const tall = H * (0.13 + 0.07 * Math.sin(x * 0.006 + T * 0.1 + b * 3)) * (1 + boost * 0.3)
        // Each curtain comes and goes along its length.
        const reach = Math.max(0, Math.sin(x * 0.0035 + T * 0.04 + b * 2.1) * 0.7 + 0.45)
        // Rays: fine bright stripes that drift along the curtain.
        const rays = 0.15 + 0.85 * Math.pow(0.5 + 0.5 * Math.sin(x * 0.08 + T * 0.6 + 3 * Math.sin(x * 0.013 + T * 0.2 + b)), 4)
        const strength = [1, 0.75, 0.55][b] * (0.8 + stir * 0.5) * reach * rays * (1 + boost)
        const d = edge - y
        // Brightest at the lower edge, fading upward, cut off sharply below.
        light += strength * (d >= 0 ? Math.exp(-d / tall) * (1.25 - 0.6 * Math.exp(-d / 6)) : 0.65 * Math.exp(d / 4))
      }

      if (light < 0.12) {
        // Stars in the dark between the curtains, twinkling.
        if (hash(c, r, 7) < 0.012) g.dot(c, r, g.ink, 0.2 + 0.15 * Math.sin(sky.time * 2 + c * r))
        continue
      }
      // Halftone shaped like the rays: an upright bar per cell, wider with more light.
      const l = Math.min(1, light)
      const w = cell * (0.1 + 0.4 * l)
      g.ctx.globalAlpha = 0.3 + 0.7 * l
      g.ctx.fillStyle = accent
      g.ctx.fillRect(c * cell + (cell - w) / 2, r * cell + cell * 0.1, w, cell * 0.8)
    }

    // The treeline, as halftone in the ink.
    for (let r = ground; r < rows; r++) g.dot(c, r, g.ink, 0.22)
  }
}

export function Aurora({
  accent = "oklch(0.78 0.16 160)",
  cell = 10,
  onKp,
  children,
  className,
}: {
  /** The light's colour; stars and trees stay in the ink. */
  accent?: string
  cell?: number
  /** Called with how stirred the sky is, as a Kp index 0–9, as it changes. */
  onKp?: (kp: number) => void
  children?: React.ReactNode
  className?: string
}) {
  const kp = React.useRef(onKp)
  React.useEffect(() => {
    kp.current = onKp
  })

  const { canvas, scene } = useAsciiCanvas<Sky>({
    cell,
    init: ({ width, height }, prev) =>
      prev
        ? { ...prev, width, height }
        : { width, height, storms: [], clicks: [], activity: 0.6, t: 0, time: 0, next: 12, kp: -1, onKp: (k) => kp.current?.(k) },
    step,
    draw: (g, sky) => draw(g, sky, accent),
  })

  return (
    <div
      data-slot="aurora"
      className={cn("relative isolate overflow-hidden", className)}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("a,button,input,select,textarea,[role=button]")) return
        const sky = scene.current
        if (!sky) return
        sky.clicks.push(e.clientX - e.currentTarget.getBoundingClientRect().left)
      }}
    >
      <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 -z-10 size-full text-foreground" />
      {children}
    </div>
  )
}
