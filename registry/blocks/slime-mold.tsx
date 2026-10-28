import * as React from "react"

import { cn } from "@/lib/utils"
import { hash, useAsciiCanvas, type AsciiGrid } from "@/hooks/use-ascii-canvas"

// SlimeMold: Physarum in ASCII, behind the content. Thousands of cells each
// leave a trail and steer toward the strongest trail just ahead of them; no
// one plans anything, yet the trails pull together into veins and the veins
// into a network that keeps rebuilding itself. Food draws it in: the network
// reaches out to each piece, links them by short paths, eats it, and lets
// the old veins fade. The trail is drawn as halftone in one colour, a dot per
// cell growing with the trail on it; food is a mark in the ink. Click to drop
// food.
//
//   <SlimeMold className="h-96" onEat={setEaten} />

type Food = { c: number; r: number; left: number }

type Mold = {
  cols: number
  rows: number
  n: number
  x: Float32Array
  y: Float32Array
  heading: Float32Array
  /** Which trail steps hold a cell: one each, so the veins stay thin and apart. */
  taken: Uint8Array
  trail: Float32Array
  /** Scratch for the blur. */
  next: Float32Array
  food: Food[]
  clicks: { c: number; r: number }[]
  /** Leftover time, run in fixed steps. */
  acc: number
  eaten: number
  onEat?: (eaten: number) => void
}

/** The trail is kept finer than the drawing: this many steps a cell, each way. */
const SUB = 2
/** How far ahead a cell senses (in trail steps), at what angle, and how hard it turns. */
const SENSE = 9
const ANGLE = 0.785
const TURN = 0.785
const SPEED = 1
const DEPOSIT = 1
const DECAY = 0.9
const FOOD = 1500

function sense(m: Mold, i: number, a: number) {
  const c = Math.floor(m.x[i] + Math.cos(a) * SENSE)
  const r = Math.floor(m.y[i] + Math.sin(a) * SENSE)
  if (c < 0 || r < 0 || c >= m.cols || r >= m.rows) return -1
  return m.trail[r * m.cols + c]
}

function tick(m: Mold) {
  const { cols, rows, x, y, heading, taken, trail } = m

  for (const f of m.food) {
    // Food smells: it keeps laying trail where it lies.
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const c = f.c + dc
        const r = f.r + dr
        if (c >= 0 && r >= 0 && c < cols && r < rows) trail[r * cols + c] += 3
      }
  }

  for (let i = 0; i < m.n; i++) {
    const h = heading[i]
    const left = sense(m, i, h - ANGLE)
    const ahead = sense(m, i, h)
    const right = sense(m, i, h + ANGLE)
    const jitter = hash(i, x[i], y[i]) - 0.5
    if (ahead >= left && ahead >= right) heading[i] += jitter * 0.2
    else if (left > right) heading[i] -= TURN
    else if (right > left) heading[i] += TURN
    else heading[i] += jitter * TURN * 2

    const nx = x[i] + Math.cos(heading[i]) * SPEED
    const ny = y[i] + Math.sin(heading[i]) * SPEED
    const to = Math.floor(ny) * cols + Math.floor(nx)
    const from = Math.floor(y[i]) * cols + Math.floor(x[i])
    // Off the edge, or somebody already there: stay put and face a new way.
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || (to !== from && taken[to])) {
      heading[i] = hash(i, nx, ny) * Math.PI * 2
      continue
    }
    taken[from] = 0
    taken[to] = 1
    x[i] = nx
    y[i] = ny
    trail[to] += DEPOSIT
  }

  // The trail spreads a little and fades.
  const next = m.next
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      let sum = 0
      for (let dr = -1; dr <= 1; dr++) {
        const rr = Math.min(rows - 1, Math.max(0, r + dr)) * cols
        for (let dc = -1; dc <= 1; dc++) sum += trail[rr + Math.min(cols - 1, Math.max(0, c + dc))]
      }
      next[r * cols + c] = (sum / 9) * DECAY
    }
  m.trail = next
  m.next = trail

  // Where the network has reached the food, it eats.
  for (const f of m.food) {
    for (let dr = -2; dr <= 2; dr++)
      for (let dc = -2; dc <= 2; dc++) {
        const c = f.c + dc
        const r = f.r + dr
        if (c >= 0 && r >= 0 && c < cols && r < rows) f.left -= m.taken[r * cols + c]
      }
  }
  const before = m.food.length
  m.food = m.food.filter((f) => f.left > 0)
  if (m.food.length < before) {
    m.eaten += before - m.food.length
    m.onEat?.(m.eaten)
  }
}

function step(m: Mold, dt: number) {
  for (const c of m.clicks.splice(0)) m.food.push({ ...c, left: FOOD })
  m.acc = Math.min(0.1, m.acc + dt)
  while (m.acc >= 1 / 60) {
    m.acc -= 1 / 60
    tick(m)
  }
}

function draw(g: AsciiGrid, m: Mold, accent: string) {
  const { cell, cols, rows, ctx } = g
  // Each drawn cell takes the trail of the steps under it; only what stands
  // above the field's own average shows, so the veins read and the haze doesn't.
  const sums = new Float32Array(cols * rows)
  let total = 0, lit = 0
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      let t = 0
      for (let dr = 0; dr < SUB; dr++)
        for (let dc = 0; dc < SUB; dc++) {
          const sr = r * SUB + dr
          const sc = c * SUB + dc
          if (sr < m.rows && sc < m.cols) t += m.trail[sr * m.cols + sc]
        }
      sums[r * cols + c] = t
      if (t > 0.5) {
        total += t
        lit++
      }
    }
  const mean = lit ? total / lit : 1
  ctx.fillStyle = accent
  for (let k = 0; k < sums.length; k++) {
    const l = Math.min(1, (sums[k] / mean - 1) / 1.5)
    if (l < 0.2) continue
    ctx.globalAlpha = 0.2 + 0.8 * l
    ctx.beginPath()
    ctx.arc((k % cols) * cell + cell / 2, Math.floor(k / cols) * cell + cell / 2, cell * (0.08 + 0.4 * l), 0, Math.PI * 2)
    ctx.fill()
  }
  // Food, shrinking as it's eaten.
  for (const f of m.food) g.glyph(Math.floor(f.c / SUB), Math.floor(f.r / SUB), f.left > FOOD / 2 ? "●" : "•", g.ink, 0.9)
}

export function SlimeMold({
  count,
  accent = "oklch(0.8 0.15 90)",
  cell = 10,
  onEat,
  children,
  className,
}: {
  /** How many cells crawl; defaults to as many as the field holds, up to 14,000. */
  count?: number
  /** The network's colour; food stays in the ink. */
  accent?: string
  cell?: number
  /** Called with the running total each time a piece of food is eaten. */
  onEat?: (eaten: number) => void
  children?: React.ReactNode
  className?: string
}) {
  const eat = React.useRef(onEat)
  React.useEffect(() => {
    eat.current = onEat
  })

  const { canvas, scene } = useAsciiCanvas<Mold>({
    cell,
    init: ({ width, height }, prev) => {
      const cols = Math.ceil(width / cell) * SUB
      const rows = Math.ceil(height / cell) * SUB
      if (prev && prev.cols === cols && prev.rows === rows) return prev
      const n = count ?? Math.max(2000, Math.min(14000, Math.round(cols * rows * 0.1)))
      const m: Mold = {
        cols,
        rows,
        n,
        x: new Float32Array(n),
        y: new Float32Array(n),
        heading: new Float32Array(n),
        taken: new Uint8Array(cols * rows),
        trail: new Float32Array(cols * rows),
        next: new Float32Array(cols * rows),
        // A few pieces to start, so it has somewhere to go.
        food: [0.2, 0.5, 0.8].map((k, i) => ({ c: Math.round(cols * k), r: Math.round(rows * (i === 1 ? 0.78 : 0.25)), left: FOOD })),
        clicks: [],
        acc: 0,
        eaten: prev?.eaten ?? 0,
        onEat: (k) => eat.current?.(k),
      }
      // It starts scattered everywhere; the veins draw themselves out of it.
      for (let i = 0; i < n; i++) {
        m.x[i] = hash(i, 1, 5) * cols
        m.y[i] = hash(i, 2, 5) * rows
        m.heading[i] = hash(i, 3, 5) * Math.PI * 2
        m.taken[Math.floor(m.y[i]) * cols + Math.floor(m.x[i])] = 1
      }
      return m
    },
    step,
    draw: (g, m) => draw(g, m, accent),
  })

  return (
    <div
      data-slot="slime-mold"
      className={cn("relative isolate overflow-hidden", className)}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("a,button,input,select,textarea,[role=button]")) return
        const m = scene.current
        if (!m) return
        const box = e.currentTarget.getBoundingClientRect()
        m.clicks.push({ c: Math.floor(((e.clientX - box.left) / cell) * SUB), r: Math.floor(((e.clientY - box.top) / cell) * SUB) })
      }}
    >
      <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 -z-10 size-full text-foreground" />
      {children}
    </div>
  )
}
