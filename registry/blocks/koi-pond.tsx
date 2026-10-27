import * as React from "react"

import { cn } from "@/lib/utils"
import { hash, stroke, useAsciiCanvas, type AsciiGrid } from "@/hooks/use-ascii-canvas"

// KoiPond: koi drawn on a cell grid, swimming under whatever sits on top.
// Bodies are small rounded blocks in the ink with patches in the accent,
// eyes are punched-out cells, whiskers and fins are ASCII strokes. Click to
// drop food: rings spread in ASCII, the nearest koi turn for it, and
// `onFeed` reports how many were eaten. Reduced motion shows one still frame.
//
//   <KoiPond className="h-96" count={6} onFeed={setFed}>
//     <p className="relative">over the water</p>
//   </KoiPond>

type Vec = [number, number]

type Koi = {
  spine: Vec[]
  heading: number
  speed: number
  /** Body length in px. */
  length: number
  turn: number
  turnTo: number
  retarget: number
  seed: number
  /** Patches, in body space: s along (0 head → 1 tail), l across, r radius (fractions of length). */
  patches: { s: number; l: number; r: number }[]
}

type Food = { x: number; y: number; age: number }
type Ring = { x: number; y: number; age: number }

type Pond = {
  width: number
  height: number
  koi: Koi[]
  food: Food[]
  rings: Ring[]
  fed: number
  /** Set by the block so `step` can report a meal. */
  onEat?: (fed: number) => void
}

const NODES = 14
const FOOD_LIFE = 14
const RING_LIFE = 1.8

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Half the body's width at s, as a fraction of length; the tail fan starts at 0.78. */
function half(s: number) {
  if (s < 0.1) return 0.05 + 0.075 * Math.pow(s / 0.1, 0.55)
  if (s < 0.34) return 0.125 + 0.008 * Math.sin(((s - 0.1) / 0.24) * Math.PI)
  if (s < 0.78) return 0.125 - 0.095 * smooth(0.34, 0.78, s)
  return 0.028 + 0.09 * ((s - 0.78) / 0.22)
}

function spawn(width: number, height: number, i: number, n: number): Koi {
  const r = (k: number) => hash(i + 1, k, n)
  const length = Math.max(150, Math.min(300, Math.sqrt(width * height) * 0.3)) * (0.7 + r(1) * 0.4)
  const heading = r(2) * Math.PI * 2
  const x = width * (0.15 + r(3) * 0.7)
  const y = height * (0.15 + r(4) * 0.7)
  const seg = length / (NODES - 1)
  const patches = Array.from({ length: 2 + Math.floor(r(5) * 3) }, (_, k) => ({
    s: 0.04 + r(10 + k) * 0.6,
    l: (r(20 + k) - 0.5) * 0.16,
    r: 0.06 + r(30 + k) * 0.06,
  }))
  return {
    spine: Array.from({ length: NODES }, (_, k): Vec => [
      x - Math.cos(heading) * seg * k,
      y - Math.sin(heading) * seg * k,
    ]),
    heading,
    speed: 22 + r(6) * 10,
    length,
    turn: 0,
    turnTo: 0,
    retarget: r(7) * 3,
    seed: r(8) * 100,
    patches,
  }
}

function step(p: Pond, dt: number, time: number) {
  for (const f of p.food) f.age += dt
  p.food = p.food.filter((f) => f.age < FOOD_LIFE)
  for (const r of p.rings) r.age += dt
  p.rings = p.rings.filter((r) => r.age < RING_LIFE)

  for (const k of p.koi) {
    const [hx, hy] = k.spine[0]
    // Wander: drift towards a new gentle turn now and then.
    k.retarget -= dt
    if (k.retarget < 0) {
      k.turnTo = (hash(k.seed, time, 3) - 0.5) * 1.1
      k.retarget = 2 + hash(k.seed, time, 4) * 3
    }
    let want = k.turnTo
    let speed = 22 + (k.seed % 1) * 10

    // Food within reach wins.
    let best: Food | null = null
    let bestD = Math.min(p.width, p.height) * 0.6
    for (const f of p.food) {
      const d = Math.hypot(f.x - hx, f.y - hy)
      if (d < bestD) {
        bestD = d
        best = f
      }
    }
    const towards = (x: number, y: number) => {
      let d = Math.atan2(y - hy, x - hx) - k.heading
      d = Math.atan2(Math.sin(d), Math.cos(d))
      return Math.max(-2.2, Math.min(2.2, d * 2.4))
    }
    if (best) {
      want = towards(best.x, best.y)
      speed = 64
      if (bestD < 12) {
        p.food = p.food.filter((f) => f !== best)
        p.fed += 1
        p.onEat?.(p.fed)
      }
    } else {
      // Keep most of the body in the pond: turn home near the edges.
      const m = k.length * 0.2
      if (hx < m || hy < m || hx > p.width - m || hy > p.height - m)
        want = towards(p.width / 2, p.height / 2) * 0.7
    }

    k.turn += (want - k.turn) * Math.min(1, dt * 2)
    k.speed += (speed - k.speed) * Math.min(1, dt * 1.5)
    // A slow sway from the tail beat.
    k.heading += (k.turn + Math.sin(time * 3.2 + k.seed) * 0.35) * dt
    k.spine[0] = [hx + Math.cos(k.heading) * k.speed * dt, hy + Math.sin(k.heading) * k.speed * dt]

    // Follow the leader: each node keeps its distance to the one ahead.
    const seg = k.length / (NODES - 1)
    for (let i = 1; i < NODES; i++) {
      const [ax, ay] = k.spine[i - 1]
      const [bx, by] = k.spine[i]
      const d = Math.hypot(ax - bx, ay - by) || 1
      k.spine[i] = [ax - ((ax - bx) / d) * seg, ay - ((ay - by) / d) * seg]
    }
  }
}

/** Where a point sits on the body: s along it, signed l across it (both px), or null. */
function locate(k: Koi, x: number, y: number) {
  let best = Infinity
  let s = 0
  let l = 0
  for (let i = 0; i < NODES - 1; i++) {
    const [ax, ay] = k.spine[i]
    const [bx, by] = k.spine[i + 1]
    const vx = bx - ax
    const vy = by - ay
    const len2 = vx * vx + vy * vy || 1
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2))
    const px = ax + vx * t
    const py = ay + vy * t
    const d = Math.hypot(x - px, y - py)
    if (d < best) {
      best = d
      s = (i + t) / (NODES - 1)
      l = Math.sign(vx * (y - ay) - vy * (x - ax)) * d
    }
  }
  return { s, l, d: best }
}

/** A point at s along the body, pushed `across` px sideways, and the body's direction there. */
function at(k: Koi, s: number, across: number) {
  const f = s * (NODES - 1)
  const i = Math.min(NODES - 2, Math.floor(f))
  const t = f - i
  const [ax, ay] = k.spine[i]
  const [bx, by] = k.spine[i + 1]
  const dir = Math.atan2(ay - by, ax - bx)
  const x = ax + (bx - ax) * t - Math.sin(dir) * across
  const y = ay + (by - ay) * t + Math.cos(dir) * across
  return { x, y, dir }
}

function draw(g: AsciiGrid, p: Pond, accent: string) {
  const { cell } = g
  const cellOf = (x: number, y: number): Vec => [Math.floor(x / cell), Math.floor(y / cell)]
  const line = (x: number, y: number, angle: number, cells: number, alpha: number) => {
    const char = stroke(angle)
    let prev = ""
    for (let i = 1; i <= cells; i++) {
      const [c, r] = cellOf(x + Math.cos(angle) * cell * i, y + Math.sin(angle) * cell * i)
      if (`${c},${r}` === prev) continue
      prev = `${c},${r}`
      g.glyph(c, r, char, g.ink, alpha)
    }
  }

  // Rings first, under the koi.
  for (const ring of p.rings) {
    const life = ring.age / RING_LIFE
    const radius = cell * 0.8 + ring.age * 42
    const alpha = (1 - life) * 0.55
    const seen = new Set<string>()
    for (let a = 0; a < Math.PI * 2; a += (cell * 0.8) / radius) {
      const [c, r] = cellOf(ring.x + Math.cos(a) * radius, ring.y + Math.sin(a) * radius)
      const key = `${c},${r}`
      if (seen.has(key)) continue
      seen.add(key)
      g.glyph(c, r, hash(c, r, 9) > 0.55 ? "·" : stroke(a + Math.PI / 2), g.ink, alpha)
    }
  }
  for (const f of p.food) {
    const [c, r] = cellOf(f.x, f.y)
    g.dot(c, r, accent, Math.min(1, (FOOD_LIFE - f.age) / 3))
  }

  for (const k of p.koi) {
    const L = k.length
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [x, y] of k.spine) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
    }
    const pad = L * 0.16
    const [c0, r0] = cellOf(x0 - pad, y0 - pad)
    const [c1, r1] = cellOf(x1 + pad, y1 + pad)

    for (let r = Math.max(0, r0); r <= Math.min(g.rows, r1); r++)
      for (let c = Math.max(0, c0); c <= Math.min(g.cols, c1); c++) {
        const { s, l } = locate(k, (c + 0.5) * cell, (r + 0.5) * cell)
        const w = half(s) * L
        const n = hash(c, r, k.seed)
        if (Math.abs(l) > w + (n - 0.5) * cell * 0.35) continue
        const edge = Math.abs(l) / Math.max(1, w)
        if (s > 0.78) {
          // The tail fan: wispy, fading into the water.
          const fade = 1 - (s - 0.78) / 0.22
          if (n < 0.25 + edge * 0.3) continue
          g.block(c, r, g.ink, 0.12 + fade * 0.3)
          continue
        }
        const patch = k.patches.some((q) => {
          const ds = (s - q.s) * L
          const dl = l - q.l * L
          return Math.hypot(ds, dl) < q.r * L + (n - 0.5) * cell
        })
        const shade = 0.5 + n * 0.22 - edge * 0.18 - smooth(0.5, 0.78, s) * 0.2
        g.block(c, r, patch ? accent : g.ink, patch ? 0.8 + n * 0.2 : shade)
      }

    // Eyes, whiskers, pectoral fins and the trailing tail strokes.
    const head = at(k, 0.06, 0)
    for (const side of [-1, 1]) {
      const eye = at(k, 0.07, side * half(0.07) * L * 0.62)
      const [ec, er] = cellOf(eye.x, eye.y)
      g.clear(ec, er)
      g.glyph(ec, er, "o", g.ink, 0.95)

      const nose = at(k, 0, side * half(0.02) * L * 0.5)
      line(nose.x, nose.y, head.dir + side * 0.45, 2, 0.6)

      const flap = Math.sin(g.time * 4 + k.seed + side) * 0.35
      const fin = at(k, 0.2, side * half(0.2) * L)
      line(fin.x, fin.y, fin.dir + Math.PI + side * (1.9 + flap) * -1, 3, 0.55)

      const tail = at(k, 0.98, side * half(0.98) * L * 0.6)
      line(tail.x, tail.y, tail.dir + Math.PI + side * 0.3, 2, 0.32)
    }
  }
}

export function KoiPond({
  count = 6,
  accent = "oklch(0.7 0.15 52)",
  cell = 10,
  onFeed,
  children,
  className,
}: {
  /** The most koi; a small pond holds fewer. */
  count?: number
  /** The patches and the food: the koi's own colour, not a UI meaning. */
  accent?: string
  /** Cell pitch in px. */
  cell?: number
  /** Called with the running total each time a koi eats. */
  onFeed?: (fed: number) => void
  children?: React.ReactNode
  className?: string
}) {
  const feed = React.useRef(onFeed)
  React.useEffect(() => {
    feed.current = onFeed
  })
  const { canvas, scene } = useAsciiCanvas<Pond>({
    cell,
    init: ({ width, height }, prev) => {
      // A small pond holds fewer koi, so a phone isn't a tangle.
      const n = Math.max(2, Math.min(count, Math.round((width * height) / 110000)))
      if (prev && prev.koi.length === n) return { ...prev, width, height }
      return {
        width,
        height,
        koi: Array.from({ length: n }, (_, i) => spawn(width, height, i, n)),
        food: [],
        rings: [],
        fed: prev?.fed ?? 0,
        onEat: (n) => feed.current?.(n),
      }
    },
    step,
    draw: (g, p) => draw(g, p, accent),
  })


  return (
    <div
      data-slot="koi-pond"
      className={cn("relative isolate overflow-hidden", className)}
      onPointerDown={(e) => {
        // Text and controls on top keep their clicks.
        if ((e.target as HTMLElement).closest("a,button,input,select,textarea,[role=button]")) return
        const p = scene.current
        if (!p) return
        const box = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - box.left
        const y = e.clientY - box.top
        p.rings.push({ x, y, age: 0 })
        for (let i = 0; i < 3; i++)
          p.food.push({ x: x + (Math.random() - 0.5) * cell * 3, y: y + (Math.random() - 0.5) * cell * 3, age: 0 })
      }}
    >
      <canvas
        ref={canvas}
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 size-full text-foreground"
      />
      {children}
    </div>
  )
}
