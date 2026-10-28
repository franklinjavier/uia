import * as React from "react"

import { cn } from "@/lib/utils"
import { hash, stroke, useAsciiCanvas, type AsciiGrid } from "@/hooks/use-ascii-canvas"

// Murmuration: a starling flock as ASCII, behind the content. Each bird
// follows its seven nearest neighbours (as real starlings do), drifts about
// a slowly wandering roost, and the cloud is drawn as halftone: a dot per
// cell that grows with the birds in it, so the flock reads as one cloud
// folding over itself. Click and a hawk dives in from there:
// birds near it bolt, the alarm runs through the flock in a wave, and the
// cloud splits and pours back together. Now and then a hawk comes anyway.
//
//   <Murmuration className="h-96" onHawk={setHawks} />

type Hawk = { x: number; y: number; vx: number; vy: number; age: number }

type Sky = {
  width: number
  height: number
  n: number
  x: Float32Array
  y: Float32Array
  /** Depth: the flock flies in 3D and is drawn flat, so its sheets fold into dense bands. */
  z: Float32Array
  vx: Float32Array
  vy: Float32Array
  vz: Float32Array
  alarm: Float32Array
  hawks: Hawk[]
  /** Seconds until a hawk comes on its own. */
  next: number
  passes: number
  onHawk?: (passes: number) => void
}

const NEIGHBOURS = 7
const SEE = 30
const PERSONAL = 14
const BIN = 30

function hawkFrom(sky: Sky, x: number, y: number): Hawk {
  // Aim at the thick of the flock.
  let cx = 0, cy = 0
  for (let i = 0; i < sky.n; i += 7) { cx += sky.x[i]; cy += sky.y[i] }
  const m = Math.ceil(sky.n / 7)
  cx /= m
  cy /= m
  const a = Math.atan2(cy - y, cx - x)
  return { x, y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, age: 0 }
}

function step(sky: Sky, dt: number, time: number) {
  const { n, x, y, z, vx, vy, vz, alarm, width, height } = sky

  // Hawks: home in for a moment, then carry straight through and away.
  sky.next -= dt
  if (sky.next <= 0) {
    const side = hash(time, 1, 2) < 0.5
    sky.hawks.push(hawkFrom(sky, side ? -20 : width + 20, height * (0.15 + hash(time, 3, 4) * 0.5)))
    sky.next = 14 + hash(time, 5, 6) * 10
  }
  for (const h of sky.hawks) {
    // A hawk new this frame, from a click or on its own, counts once.
    if (h.age === 0) {
      sky.passes += 1
      sky.onHawk?.(sky.passes)
    }
    h.age += dt
    h.x += h.vx * dt
    h.y += h.vy * dt
  }
  sky.hawks = sky.hawks.filter((h) => h.age < 6 && h.x > -60 && h.x < width + 60 && h.y > -60 && h.y < height + 60)

  // Bin the birds so each only looks at the ones close by.
  const cols = Math.ceil(width / BIN) + 2
  const rows = Math.ceil(height / BIN) + 2
  const head = new Int32Array(cols * rows).fill(-1)
  const next = new Int32Array(n)
  const binOf = (i: number) =>
    (Math.min(rows - 1, Math.max(0, Math.floor(y[i] / BIN) + 1))) * cols + Math.min(cols - 1, Math.max(0, Math.floor(x[i] / BIN) + 1))
  for (let i = 0; i < n; i++) {
    const b = binOf(i)
    next[i] = head[b]
    head[b] = i
  }

  // The roost wanders, so the cloud keeps changing shape.
  const rx = width * (0.5 + Math.cos(time * 0.11) * 0.2 + Math.cos(time * 0.27) * 0.06)
  const ry = height * (0.42 + Math.sin(time * 0.17) * 0.14)

  for (let i = 0; i < n; i++) {
    let ax = 0, ay = 0, az = 0, cx = 0, cy = 0, cz = 0, sx = 0, sy = 0, sz = 0, seen = 0, fear = 0
    const b = binOf(i)
    const bx = b % cols
    const by = Math.floor(b / cols)
    search: for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        const gx = bx + ox
        const gy = by + oy
        if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue
        for (let j = head[gy * cols + gx]; j !== -1; j = next[j]) {
          if (j === i) continue
          const dx = x[j] - x[i]
          const dy = y[j] - y[i]
          const dz = z[j] - z[i]
          const d2 = dx * dx + dy * dy + dz * dz
          if (d2 > SEE * SEE) continue
          ax += vx[j]; ay += vy[j]; az += vz[j]; cx += dx; cy += dy; cz += dz
          if (d2 < PERSONAL * PERSONAL) { sx -= dx / (d2 + 1); sy -= dy / (d2 + 1); sz -= dz / (d2 + 1) }
          fear = Math.max(fear, alarm[j])
          // Seven neighbours is what a starling tracks.
          if (++seen >= NEIGHBOURS) break search
        }
      }

    let fx = 0, fy = 0, fz = 0
    if (seen) {
      fx += (ax / seen - vx[i]) * 1.5 + (cx / seen) * 0.5 + sx * 480
      fy += (ay / seen - vy[i]) * 1.5 + (cy / seen) * 0.5 + sy * 480
      fz += (az / seen - vz[i]) * 1.5 + (cz / seen) * 0.5 + sz * 480
    }
    // The roost holds the cloud loosely: free inside, pulled back from out past it.
    const reach = Math.min(width, height) * 0.38
    const ddx = rx - x[i]
    const ddy = ry - y[i]
    const ddz = -z[i] * 1.4
    const dd = Math.hypot(ddx, ddy, ddz) || 1
    if (dd > reach) {
      fx += (ddx / dd) * (dd - reach) * 1.6
      fy += (ddy / dd) * (dd - reach) * 1.6
      fz += (ddz / dd) * (dd - reach) * 1.6
    }
    // Hard walls far out, so nobody leaves for good.
    const m = 40
    if (x[i] < m) fx += (m - x[i]) * 4
    if (x[i] > width - m) fx -= (x[i] - width + m) * 4
    if (y[i] < m) fy += (m - y[i]) * 4
    if (y[i] > height - m) fy -= (y[i] - height + m) * 4

    // The alarm passes from bird to bird, a little weaker each time.
    alarm[i] = Math.max(alarm[i] * Math.exp(-dt * 1.4), fear * 0.86)
    for (const h of sky.hawks) {
      const dx = x[i] - h.x
      const dy = y[i] - h.y
      const d = Math.hypot(dx, dy) || 1
      if (d < 110) {
        alarm[i] = 1
        fx += (dx / d) * 1400 * (1 - d / 110)
        fy += (dy / d) * 1400 * (1 - d / 110)
      }
    }
    fx += (hash(i, time * 2 | 0, 1) - 0.5) * 40
    fy += (hash(i, time * 2 | 0, 2) - 0.5) * 40

    fz += (hash(i, time * 2 | 0, 3) - 0.5) * 40
    vx[i] += fx * dt
    vy[i] += fy * dt
    vz[i] += fz * dt
    const v = Math.hypot(vx[i], vy[i], vz[i]) || 1
    const top = 115 + alarm[i] * 110
    const low = 60
    const k = v > top ? top / v : v < low ? low / v : 1
    vx[i] *= k
    vy[i] *= k
    vz[i] *= k
    x[i] += vx[i] * dt
    y[i] += vy[i] * dt
    z[i] += vz[i] * dt
  }
}

function draw(g: AsciiGrid, sky: Sky, accent: string) {
  const { cell, cols, rows } = g
  const count = new Uint16Array(cols * rows)
  const scared = new Float32Array(cols * rows)
  for (let i = 0; i < sky.n; i++) {
    const c = Math.floor(sky.x[i] / cell)
    const r = Math.floor(sky.y[i] / cell)
    if (c < 0 || r < 0 || c >= cols || r >= rows) continue
    const k = r * cols + c
    count[k]++
    scared[k] = Math.max(scared[k], sky.alarm[i])
  }
  for (let k = 0; k < count.length; k++) {
    const m = count[k]
    if (!m) continue
    const c = k % cols
    const r = Math.floor(k / cols)
    // Halftone: a dot per cell that grows with the birds in it, so the flock
    // reads as one dark cloud with soft folds, not as a rain of strokes.
    const size = cell * (0.16 + 0.34 * Math.min(1, Math.sqrt(m / 20)))
    g.ctx.globalAlpha = Math.min(1, 0.3 + m * 0.05 + scared[k] * 0.15)
    g.ctx.fillStyle = g.ink
    g.ctx.beginPath()
    g.ctx.arc(c * cell + cell / 2, r * cell + cell / 2, size, 0, Math.PI * 2)
    g.ctx.fill()
  }

  for (const h of sky.hawks) {
    const a = Math.atan2(h.vy, h.vx)
    const c = Math.floor(h.x / cell)
    const r = Math.floor(h.y / cell)
    g.glyph(c, r, "v", accent, 1)
    // Swept wings either side, trailing back.
    for (const side of [-1, 1])
      for (let k = 1; k <= 2; k++) {
        const wa = a + Math.PI + side * 0.9
        const wc = Math.floor((h.x + Math.cos(wa) * cell * k) / cell)
        const wr = Math.floor((h.y + Math.sin(wa) * cell * k) / cell)
        g.glyph(wc, wr, stroke(wa), accent, 0.9)
      }
  }
}

export function Murmuration({
  count,
  accent = "oklch(0.66 0.15 45)",
  cell = 10,
  onHawk,
  children,
  className,
}: {
  /** How many starlings; defaults to as many as the sky holds, up to 2,600. */
  count?: number
  /** The hawk's colour; the flock stays in the ink. */
  accent?: string
  cell?: number
  /** Called with the running total each time a hawk comes through. */
  onHawk?: (passes: number) => void
  children?: React.ReactNode
  className?: string
}) {
  const hawk = React.useRef(onHawk)
  React.useEffect(() => {
    hawk.current = onHawk
  })

  const { canvas, scene } = useAsciiCanvas<Sky>({
    cell,
    init: ({ width, height }, prev) => {
      const n = count ?? Math.max(700, Math.min(2600, Math.round((width * height) / 520)))
      if (prev && prev.n === n) return { ...prev, width, height }
      const sky: Sky = {
        width,
        height,
        n,
        x: new Float32Array(n),
        y: new Float32Array(n),
        z: new Float32Array(n),
        vx: new Float32Array(n),
        vy: new Float32Array(n),
        vz: new Float32Array(n),
        alarm: new Float32Array(n),
        hawks: [],
        next: 10,
        passes: prev?.passes ?? 0,
        onHawk: (k) => hawk.current?.(k),
      }
      // Start as a long loose ribbon, all heading roughly one way.
      for (let i = 0; i < n; i++) {
        const t = hash(i, 1, 7)
        sky.x[i] = width * (0.2 + t * 0.6) + (hash(i, 2, 7) - 0.5) * 60
        sky.y[i] = height * (0.4 + Math.sin(t * 6) * 0.08) + (hash(i, 3, 7) - 0.5) * 50
        sky.vx[i] = 100
        sky.vy[i] = (hash(i, 4, 7) - 0.5) * 30
        sky.z[i] = (hash(i, 5, 7) - 0.5) * 120
        sky.vz[i] = (hash(i, 6, 7) - 0.5) * 40
      }
      return sky
    },
    step,
    draw: (g, sky) => draw(g, sky, accent),
  })

  return (
    <div
      data-slot="murmuration"
      className={cn("relative isolate overflow-hidden", className)}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("a,button,input,select,textarea,[role=button]")) return
        const sky = scene.current
        if (!sky) return
        const box = e.currentTarget.getBoundingClientRect()
        sky.hawks.push(hawkFrom(sky, e.clientX - box.left, e.clientY - box.top))
      }}
    >
      <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 -z-10 size-full text-foreground" />
      {children}
    </div>
  )
}
