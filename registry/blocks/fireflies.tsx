import * as React from "react"

import { cn } from "@/lib/utils"
import { hash, useAsciiCanvas, type AsciiGrid } from "@/hooks/use-ascii-canvas"

// Fireflies: a field at dusk in ASCII, behind the content. Each firefly keeps
// its own time and flashes when its clock runs out; a flash nudges the clocks
// of the ones close by (forward if they were nearly due, back if they just
// went), so they drift into step the way real fireflies do: in patches first,
// waves of light crossing the field, then the whole field at once. The glow
// is halftone, a dot per cell growing with the light on it. Click and the
// ones near you flash, the rest lose the beat, and it comes back from there.
//
//   <Fireflies className="h-96" onSync={setInStep} />

type Fly = {
  x: number
  y: number
  heading: number
  /** Where the clock is, 0 to 1; it flashes at 1. */
  phase: number
  /** Seconds per beat, a little different for each. */
  period: number
  /** Seconds since its last flash. */
  since: number
}

type Pulse = { x: number; y: number; age: number }

type Field = {
  width: number
  height: number
  flies: Fly[]
  pulses: Pulse[]
  /** Clicks waiting for the next step. */
  clicks: { x: number; y: number }[]
  /** Seconds until the next sync reading. */
  read: number
  sync: number
  onSync?: (percent: number) => void
}

/** How far a flash is seen, and how hard it pulls. */
const REACH = 120
const PULL = 0.11
const SPOKEN = 160

function flash(field: Field, first: Fly) {
  // A flash can bring a neighbour to its own; run the cascade to the end.
  const queue = [first]
  const fired = new Set<Fly>([first])
  while (queue.length) {
    const f = queue.pop()!
    f.phase = 0
    f.since = 0
    for (const o of field.flies) {
      if (fired.has(o)) continue
      if (Math.hypot(o.x - f.x, o.y - f.y) > REACH) continue
      // Nearly due: pulled forward. Just gone: held back.
      o.phase = Math.max(0, o.phase - (PULL * Math.sin(2 * Math.PI * o.phase)) / (2 * Math.PI) + (o.phase > 0.5 ? PULL * 0.15 : 0))
      if (o.phase >= 1) {
        fired.add(o)
        queue.push(o)
      }
    }
  }
}

function step(field: Field, dt: number, time: number) {
  const { flies, width, height } = field

  for (const c of field.clicks.splice(0)) {
    field.pulses.push({ x: c.x, y: c.y, age: 0 })
    // The ones near you flash together; everyone else loses the beat.
    const near = flies.filter((f) => Math.hypot(f.x - c.x, f.y - c.y) < SPOKEN)
    for (const f of flies) if (!near.includes(f)) f.phase = Math.random()
    for (const f of near) {
      f.phase = 0
      f.since = 0
    }
  }
  for (const p of field.pulses) p.age += dt
  field.pulses = field.pulses.filter((p) => p.age < 1.2)

  for (const f of flies) {
    // A slow wander, a little bob, and back in from the edges.
    f.heading += (hash(f.period * 97, time * 0.7 | 0, 3) - 0.5) * 1.6 * dt
    const speed = 9 + Math.sin(time * 0.6 + f.period * 40) * 4
    f.x += Math.cos(f.heading) * speed * dt
    f.y += (Math.sin(f.heading) * speed + Math.sin(time * 1.3 + f.period * 20) * 5) * dt
    if (f.x < 10 || f.x > width - 10 || f.y < 10 || f.y > height - 10) {
      const back = Math.atan2(height * 0.55 - f.y, width / 2 - f.x)
      f.heading += Math.atan2(Math.sin(back - f.heading), Math.cos(back - f.heading)) * Math.min(1, dt * 2)
    }
    f.since += dt
    f.phase += dt / f.period
    // Now and then one forgets the beat, so the field never freezes in step.
    if (hash(f.x, f.y, time) < dt * 0.006) f.phase = Math.random()
  }
  for (const f of flies) if (f.phase >= 1) flash(field, f)

  // How in step the field is: the length of the mean of every clock on a circle.
  field.read -= dt
  if (field.read <= 0) {
    field.read = 0.5
    let cx = 0, cy = 0
    for (const f of flies) {
      cx += Math.cos(2 * Math.PI * f.phase)
      cy += Math.sin(2 * Math.PI * f.phase)
    }
    const sync = Math.round((Math.hypot(cx, cy) / Math.max(1, flies.length)) * 100)
    if (sync !== field.sync) {
      field.sync = sync
      field.onSync?.(sync)
    }
  }
}

/** Light from one flash, `t` seconds after it: a quick rise, a slower fade. */
function glow(t: number) {
  return t < 0.08 ? t / 0.08 : Math.exp(-(t - 0.08) / 0.2)
}

function draw(g: AsciiGrid, field: Field, accent: string) {
  const { cell, cols, rows, ctx } = g
  const light = new Float32Array(cols * rows)
  const R = 3
  for (const f of field.flies) {
    const c0 = Math.floor(f.x / cell)
    const r0 = Math.floor(f.y / cell)
    const b = glow(f.since)
    // A dark firefly is still there, a speck in the ink.
    g.dot(c0, r0, g.ink, 0.22)
    if (b < 0.03) continue
    for (let r = r0 - R; r <= r0 + R; r++)
      for (let c = c0 - R; c <= c0 + R; c++) {
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue
        const d2 = (c - c0) ** 2 + (r - r0) ** 2
        if (d2 > R * R) continue
        light[r * cols + c] += b * Math.exp(-d2 / 2.4)
      }
  }

  // Halftone glow: a dot per lit cell, bigger and brighter with more light.
  ctx.fillStyle = accent
  for (let k = 0; k < light.length; k++) {
    const l = Math.min(1, light[k])
    if (l < 0.05) continue
    ctx.globalAlpha = 0.25 + 0.75 * l
    ctx.beginPath()
    ctx.arc((k % cols) * cell + cell / 2, Math.floor(k / cols) * cell + cell / 2, cell * (0.1 + 0.4 * l), 0, Math.PI * 2)
    ctx.fill()
  }

  // A click's own flash: a ring of light running out and fading.
  for (const p of field.pulses) {
    const radius = 20 + p.age * 260
    const a = (1 - p.age / 1.2) * 0.7
    const around = Math.max(12, Math.round((radius * 2 * Math.PI) / (cell * 1.6)))
    for (let i = 0; i < around; i++) {
      const t = (i / around) * Math.PI * 2
      g.glyph(Math.floor((p.x + Math.cos(t) * radius) / cell), Math.floor((p.y + Math.sin(t) * radius) / cell), "·", accent, a)
    }
  }
}

export function Fireflies({
  count,
  accent = "oklch(0.8 0.17 105)",
  cell = 10,
  onSync,
  children,
  className,
}: {
  /** How many fireflies; defaults to as many as the field holds, up to 220. */
  count?: number
  /** The light's colour; dark fireflies stay in the ink. */
  accent?: string
  cell?: number
  /** Called with how in step the field is, 0–100, as it changes. */
  onSync?: (percent: number) => void
  children?: React.ReactNode
  className?: string
}) {
  const sync = React.useRef(onSync)
  React.useEffect(() => {
    sync.current = onSync
  })

  const { canvas, scene } = useAsciiCanvas<Field>({
    cell,
    init: ({ width, height }, prev) => {
      const n = count ?? Math.max(40, Math.min(220, Math.round((width * height) / 7000)))
      if (prev && prev.flies.length === n) return { ...prev, width, height }
      const flies: Fly[] = Array.from({ length: n }, (_, i) => {
        const phase = hash(i, 4, 9)
        const period = 1.5 + (hash(i, 5, 9) - 0.5) * 0.12
        return {
          x: width * (0.04 + hash(i, 1, 9) * 0.92),
          // More of them low, over the grass.
          y: height * (0.12 + Math.sqrt(hash(i, 2, 9)) * 0.84),
          heading: hash(i, 3, 9) * Math.PI * 2,
          phase,
          period,
          since: phase * period,
        }
      })
      return { width, height, flies, pulses: [], clicks: [], read: 0, sync: -1, onSync: (p) => sync.current?.(p) }
    },
    step,
    draw: (g, field) => draw(g, field, accent),
  })

  return (
    <div
      data-slot="fireflies"
      className={cn("relative isolate overflow-hidden", className)}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("a,button,input,select,textarea,[role=button]")) return
        const field = scene.current
        if (!field) return
        const box = e.currentTarget.getBoundingClientRect()
        field.clicks.push({ x: e.clientX - box.left, y: e.clientY - box.top })
      }}
    >
      <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 -z-10 size-full text-foreground" />
      {children}
    </div>
  )
}
