import * as React from "react"

import { cn } from "@/lib/utils"
import { hash, stroke, useAsciiCanvas, type AsciiGrid } from "@/hooks/use-ascii-canvas"

// Ocean: predators hunting bait schools, all in ASCII, under the content.
// Bait fish are single strokes that school and scatter. Predators are
// shaded with a glyph ramp: sparse glyphs where the light falls, dense ones
// in shadow, so the texture reads as a body. Two kinds:
//   shark   — a few long bodies, shaded tiles with their glyphs, cruising and
//             lunging at stragglers; every second one is a hammerhead
//   piranha — a pack of short fast bodies that turn on prey together
// Click: sharks get a new school; piranhas get blood in the water and go into
// a frenzy, tearing through it. `onEat` reports the fish eaten so far.
//
//   <Ocean predator="piranha" className="h-96" onEat={setEaten} />

type Vec = [number, number]
type Kind = "shark" | "piranha"

type Bait = { x: number; y: number; vx: number; vy: number; alarm: number; alive: boolean; back: number }
type Hunter = {
  spine: Vec[]
  heading: number
  speed: number
  length: number
  turn: number
  turnTo: number
  retarget: number
  seed: number
  target: Bait | null
  /** Seconds left before it hunts again. */
  full: number
  /** A hammerhead among the sharks. */
  hammer: boolean
  /** The spine as drawn: the swim path plus a wave that grows towards the tail. */
  body: Vec[]
  /** Tail-beat phase. */
  phase: number
  /** The muted hues scattered over a shark's tiles. */
  tints: string[]
  /** 1 near the surface → 0.55 deep: deeper sharks are smaller and dimmer, and pass under. */
  depth: number
}
type Splash = { x: number; y: number; age: number; seed: number }
/** A cloud of blood, for the piranhas. */
type Blood = { x: number; y: number; age: number; seed: number }

type Water = {
  width: number
  height: number
  bait: Bait[]
  hunters: Hunter[]
  splashes: Splash[]
  blood: Blood[]
  /** Disturbed water behind the swimmers, per cell, fading. */
  wake: Map<number, number>
  cell: number
  cols: number
  eaten: number
  onEat?: (eaten: number) => void
}

const NODES = 16
const RAMP = ":;t%SX8#@"
const FIN = "%;tS:"
const SPLASH_LIFE = 0.9
/** Hues for the tinted tiles, as in the reference: violet, rose, sage, olive, slate blue, teal, clay. */
const HUES = [300, 350, 150, 110, 255, 200, 55]
const BLOOD_LIFE = 4.5

/** A fin as a triangle in body space: leading root, trailing root, tip (s), and how far the tip reaches past the body (fraction of length). */
type Fin = [number, number, number, number]

type Profile = {
  /** Half-width of the body at s (0 snout → 1 tail), as a fraction of length. */
  body: (s: number) => number
  fins: Fin[]
  /** Where the dorsal fin rides on the back, drawn bright down the middle. */
  ridge?: [number, number]
  /** Where the gill slits cut across the flanks. */
  gills?: [number, number]
  /** The eyes: s along, and how far out (fraction of length). */
  eye: [number, number]
  cruise: number
  chase: number
  /** Speed in a frenzy (piranhas in blood). */
  frenzy: number
  /** Max turn, rad/s. */
  agility: number
  reach: number
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const PROFILES: Record<Kind, Profile> = {
  shark: {
    // Blunt snout, widest behind the gills, a long taper to the tail.
    body: (s) =>
      s < 0.13
        ? 0.09 * Math.pow(Math.sin(((s / 0.13) * Math.PI) / 2), 0.95)
        : s < 0.3
          ? 0.09 + 0.016 * smooth(0.13, 0.3, s)
          : s < 0.86
            ? 0.019 + 0.087 * Math.pow(1 - (s - 0.3) / 0.56, 1.25)
            : 0.016,
    fins: [
      [0.15, 0.43, 0.55, 0.26], // pectorals, swept back: what makes it a shark from above
      [0.57, 0.65, 0.69, 0.085], // pelvics
      [0.86, 0.99, 1.1, 0.11], // the forked tail
    ],
    ridge: [0.33, 0.47],
    gills: [0.19, 0.29],
    eye: [0.09, 0.055],
    cruise: 30,
    chase: 74,
    frenzy: 74,
    agility: 1.4,
    reach: 0.12,
  },
  piranha: {
    body: (s) => (s < 0.8 ? 0.2 * Math.pow(Math.sin(((s + 0.04) / 0.84) * Math.PI), 0.7) : 0.03),
    fins: [
      [0.3, 0.45, 0.52, 0.08],
      [0.8, 0.98, 1.12, 0.17],
    ],
    eye: [0.14, 0.13],
    cruise: 44,
    chase: 120,
    frenzy: 230,
    agility: 5,
    reach: 0.3,
  },
}

/** The hammerhead: the same shark under a wide flat head, eyes out on its tips. */
const HAMMER: Profile = {
  ...PROFILES.shark,
  body: (s) =>
    Math.max(PROFILES.shark.body(s), s < 0.08 ? 0.2 * smooth(0, 0.012, s) * (1 - smooth(0.05, 0.08, s)) : 0),
  eye: [0.035, 0.19],
}

/** Is (s, a) inside a fin triangle whose base sits on the spine? */
function inFin([s0, s1, tip, reach]: Fin, body: (s: number) => number, s: number, a: number, bank = 1) {
  reach *= bank
  const ax = s0, ay = 0
  const bx = s1, by = 0
  const cx = tip, cy = body(Math.min(1, tip)) + reach
  const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
  const u = ((by - cy) * (s - cx) + (cx - bx) * (a - cy)) / d
  const v = ((cy - ay) * (s - cx) + (ax - cx) * (a - cy)) / d
  return u >= 0 && v >= 0 && u + v <= 1
}

function spawnHunter(kind: Kind, width: number, height: number, i: number, n: number): Hunter {
  const r = (k: number) => hash(i + 1, k, n * 7 + (kind === "shark" ? 1 : 2))
  const unit = Math.sqrt(width * height)
  const length =
    kind === "shark"
      ? Math.max(180, Math.min(420, unit * 0.48)) * (1 - (i % 3) * 0.14)
      : Math.max(100, Math.min(160, unit * 0.16)) * (0.8 + r(1) * 0.3)
  const heading = r(2) * Math.PI * 2
  const x = width * (0.15 + r(3) * 0.7)
  const y = height * (0.15 + r(4) * 0.7)
  const seg = length / (NODES - 1)
  return {
    spine: Array.from({ length: NODES }, (_, k): Vec => [x - Math.cos(heading) * seg * k, y - Math.sin(heading) * seg * k]),
    heading,
    speed: PROFILES[kind].cruise,
    length,
    turn: 0,
    turnTo: 0,
    retarget: r(5) * 2,
    seed: r(6) * 100,
    // Every second shark is a hammerhead.
    hammer: kind === "shark" && i % 2 === 1,
    body: [],
    phase: r(8) * 10,
    depth: kind === "shark" ? 1 - (i % 3) * 0.2 : 1,
    tints: [0, 1, 2].map((k) => `oklch(0.72 0.1 ${HUES[Math.floor(r(20 + k) * HUES.length)]})`),
    target: null,
    full: r(7) * 3,
  }
}

function school(x: number, y: number, n: number, seed: number): Bait[] {
  const a = hash(seed, n, 1) * Math.PI * 2
  return Array.from({ length: n }, (_, i) => ({
    x: x + (hash(seed, i, 2) - 0.5) * 60,
    y: y + (hash(seed, i, 3) - 0.5) * 40,
    vx: Math.cos(a) * 30,
    vy: Math.sin(a) * 30,
    alarm: 0,
    alive: true,
    back: 0,
  }))
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

function step(kind: Kind, w: Water, dt: number, time: number) {
  const P = PROFILES[kind]
  for (const [k, v] of w.wake) {
    const next = v * Math.exp(-dt * 0.9)
    if (next < 0.04) w.wake.delete(k)
    else w.wake.set(k, next)
  }
  for (const s of w.splashes) s.age += dt
  w.splashes = w.splashes.filter((s) => s.age < SPLASH_LIFE)
  for (const b of w.blood) b.age += dt
  w.blood = w.blood.filter((b) => b.age < BLOOD_LIFE)

  // Bait: separation, alignment, cohesion; scatter from any head close by.
  const live = w.bait.filter((b) => b.alive)
  for (const b of w.bait) {
    if (!b.alive) {
      b.back -= dt
      if (b.back <= 0) {
        // Swim back in from an edge.
        const side = hash(b.x, time, 5) < 0.5
        b.x = side ? -10 : w.width + 10
        b.y = w.height * (0.1 + hash(b.y, time, 6) * 0.8)
        b.vx = side ? 30 : -30
        b.vy = 0
        b.alive = true
        b.alarm = 0
      }
      continue
    }
    let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, n = 0
    for (const o of live) {
      if (o === b) continue
      const dx = o.x - b.x
      const dy = o.y - b.y
      const d2 = dx * dx + dy * dy
      if (d2 > 2500) continue
      n++
      ax += o.vx; ay += o.vy; cx += dx; cy += dy
      if (d2 < 160) { sx -= dx / (d2 + 1) * 40; sy -= dy / (d2 + 1) * 40 }
      b.alarm = Math.max(b.alarm, o.alarm * 0.92)
    }
    let fx = 0, fy = 0
    if (n) {
      fx += (ax / n - b.vx) * 1.4 + cx / n * 0.6 + sx * 6
      fy += (ay / n - b.vy) * 1.4 + cy / n * 0.6 + sy * 6
    }
    for (const h of w.hunters) {
      const [hx, hy] = h.spine[0]
      const dx = b.x - hx
      const dy = b.y - hy
      const d = Math.hypot(dx, dy) || 1
      const fear = h.length * (kind === "shark" ? 0.55 : 1.4)
      if (d < fear) {
        b.alarm = 1
        fx += (dx / d) * 260 * (1 - d / fear)
        fy += (dy / d) * 260 * (1 - d / fear)
      }
    }
    // Wander, and stay level-ish.
    fx += (hash(b.x | 0, time | 0, 7) - 0.5) * 30
    fy += (hash(b.y | 0, time | 0, 8) - 0.5) * 30 - b.vy * 0.6
    b.vx += fx * dt
    b.vy += fy * dt
    const v = Math.hypot(b.vx, b.vy) || 1
    const top = 34 + b.alarm * 50
    const low = 16
    const k = v > top ? top / v : v < low ? low / v : 1
    b.vx *= k
    b.vy *= k
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.alarm = Math.max(0, b.alarm - dt * 0.5)
    // Wrap: schools leave one side and come back on the other.
    if (b.x < -20) b.x = w.width + 20
    if (b.x > w.width + 20) b.x = -20
    if (b.y < -20) b.y = w.height + 20
    if (b.y > w.height + 20) b.y = -20
  }

  for (const h of w.hunters) {
    const [hx, hy] = h.spine[0]
    h.full = Math.max(0, h.full - dt)
    h.retarget -= dt
    if (h.retarget < 0) {
      h.turnTo = (hash(h.seed, time, 3) - 0.5) * (kind === "shark" ? 0.45 : 2.4)
      h.retarget = 1.5 + hash(h.seed, time, 4) * 2.5
    }
    let want = h.turnTo
    let speed = P.cruise

    if (h.target && !h.target.alive) h.target = null
    if (!h.target && h.full === 0) {
      // Stragglers first: the fish with the fewest neighbours nearby.
      let best: Bait | null = null
      let score = Infinity
      const range = kind === "shark" ? h.length * 1.6 : 320
      for (const b of live) {
        const d = Math.hypot(b.x - hx, b.y - hy)
        if (d > range) continue
        const ahead = Math.cos(Math.atan2(b.y - hy, b.x - hx) - h.heading)
        const crowd = live.filter((o) => Math.abs(o.x - b.x) < 30 && Math.abs(o.y - b.y) < 30).length
        const sc = d * (1.6 - ahead * 0.6) + crowd * 18
        if (sc < score) {
          score = sc
          best = b
        }
      }
      h.target = best
    }
    const towards = (x: number, y: number) =>
      Math.max(-P.agility, Math.min(P.agility, wrapAngle(Math.atan2(y - hy, x - hx) - h.heading) * 3))
    // Blood in the water: every piranha goes mad for it, tearing through the cloud.
    const cloud = w.blood[w.blood.length - 1]
    if (cloud) {
      const spin = (h.seed % 2 > 1 ? 1 : -1) * (time * 5 + h.seed)
      const rad = 8 + (h.seed % 1) * 34
      want = towards(cloud.x + Math.cos(spin) * rad, cloud.y + Math.sin(spin) * rad) * 1.6
      speed = P.frenzy
    } else if (h.target) {
      // Aim where the fish will be, not where it is; close in, then a short burst.
      const gap = Math.hypot(h.target.x - hx, h.target.y - hy)
      const lead = Math.min(1.2, gap / P.chase)
      want = towards(h.target.x + h.target.vx * lead, h.target.y + h.target.vy * lead)
      speed = gap < h.length * 0.45 ? P.chase * 1.6 : P.chase
      if (Math.hypot(h.target.x - hx, h.target.y - hy) < Math.max(10, h.length * P.reach * 0.5)) {
        h.target.alive = false
        h.target.back = 4 + hash(h.seed, time, 9) * 4
        w.splashes.push({ x: h.target.x, y: h.target.y, age: 0, seed: hash(hx, hy, time) })
        w.eaten += 1
        w.onEat?.(w.eaten)
        h.target = null
        h.full = kind === "shark" ? 4 + hash(h.seed, time, 2) * 4 : 0.6
      }
    } else if (kind === "piranha") {
      // The pack keeps together.
      let mx = 0, my = 0
      for (const o of w.hunters) { mx += o.spine[0][0]; my += o.spine[0][1] }
      mx /= w.hunters.length
      my /= w.hunters.length
      if (Math.hypot(mx - hx, my - hy) > 90) want = want * 0.4 + towards(mx, my) * 0.6
    }
    // Personal space, so a pack reads as separate bodies.
    for (const o of w.hunters) {
      if (o === h) continue
      const dx = hx - o.spine[0][0]
      const dy = hy - o.spine[0][1]
      const d = Math.hypot(dx, dy)
      if (d < h.length * 0.9 && d > 0) want += wrapAngle(Math.atan2(dy, dx) - h.heading) * (1 - d / (h.length * 0.9)) * 2
    }
    // Sharks always turn wide; a tight turn folds the body out of shape.
    const cap = P.agility * (cloud ? 1.6 : 1) * (kind === "shark" ? (h.target ? 0.6 : 0.45) : 1)
    want = Math.max(-cap, Math.min(cap, want))
    const m = h.length * 0.3
    if (!h.target && !cloud && (hx < m || hy < m || hx > w.width - m || hy > w.height - m))
      want = towards(w.width / 2, w.height / 2) * 0.8

    h.turn += (want - h.turn) * Math.min(1, dt * (kind === "shark" ? 0.9 : cloud ? 10 : 6))
    h.speed += (speed - h.speed) * Math.min(1, dt * (kind === "shark" ? 0.8 : cloud ? 5 : 3))
    const beat = kind === "shark" ? 2.2 : cloud ? 16 : 9
    h.heading += (h.turn + Math.sin(time * beat + h.seed) * (kind === "shark" ? 0 : 0.6)) * dt
    h.spine[0] = [hx + Math.cos(h.heading) * h.speed * dt, hy + Math.sin(h.heading) * h.speed * dt]
    const seg = h.length / (NODES - 1)
    for (let i = 1; i < NODES; i++) {
      const [ax, ay] = h.spine[i - 1]
      const [bx, by] = h.spine[i]
      const d = Math.hypot(ax - bx, ay - by) || 1
      h.spine[i] = [ax - ((ax - bx) / d) * seg, ay - ((ay - by) / d) * seg]
    }

    // Leave a wake: the water behind the body stirs, then settles.
    for (let i = Math.floor(NODES * 0.55); i < NODES; i += 2) {
      const [x, y] = h.spine[i]
      const key = Math.floor(y / w.cell) * w.cols + Math.floor(x / w.cell)
      w.wake.set(key, Math.min(1, (w.wake.get(key) ?? 0) + dt * (h.speed / 40) * h.depth))
    }

    // The swim: a wave runs head to tail, small at the head and wide at the
    // tail, faster when the fish is in a hurry. Drawn, not steered, so the
    // path stays smooth.
    h.phase += dt * beat * (0.55 + (0.45 * h.speed) / P.cruise)
    const amp = h.length * (kind === "shark" ? 0.045 : 0.05)
    h.body = h.spine.map(([x, y], i): Vec => {
      const k = i / (NODES - 1)
      const [ax, ay] = h.spine[Math.max(0, i - 1)]
      const [bx, by] = h.spine[Math.min(NODES - 1, i + 1)]
      const dir = Math.atan2(by - ay, bx - ax)
      const off = amp * Math.pow(k, 1.6) * Math.sin(h.phase - k * 4.2)
      return [x - Math.sin(dir) * off, y + Math.cos(dir) * off]
    })
  }
}

/** Where a point sits on a spine: s along (0–1) and signed distance across (px). */
function locate(spine: Vec[], x: number, y: number) {
  let best = Infinity
  let s = 0
  let l = 0
  for (let i = 0; i < NODES - 1; i++) {
    const [ax, ay] = spine[i]
    const [bx, by] = spine[i + 1]
    const vx = bx - ax
    const vy = by - ay
    const len2 = vx * vx + vy * vy || 1
    // The last segment runs on past the tail, so a tail fin can reach beyond it.
    const t = Math.max(0, Math.min(i === NODES - 2 ? 2.5 : 1, ((x - ax) * vx + (y - ay) * vy) / len2))
    const d = Math.hypot(x - (ax + vx * t), y - (ay + vy * t))
    if (d < best) {
      best = d
      s = (i + t) / (NODES - 1)
      l = Math.sign(vx * (y - ay) - vy * (x - ax)) * d
    }
  }
  return { s, l }
}

function point(spine: Vec[], s: number, across: number) {
  const f = s * (NODES - 1)
  const i = Math.min(NODES - 2, Math.floor(f))
  const t = f - i
  const [ax, ay] = spine[i]
  const [bx, by] = spine[i + 1]
  const dir = Math.atan2(ay - by, ax - bx)
  return { x: ax + (bx - ax) * t - Math.sin(dir) * across, y: ay + (by - ay) * t + Math.cos(dir) * across, dir }
}

function draw(kind: Kind, g: AsciiGrid, w: Water, accent: string) {
  const { cell } = g
  const cellOf = (x: number, y: number): Vec => [Math.floor(x / cell), Math.floor(y / cell)]

  for (const [k, v] of w.wake) {
    const c = k % w.cols
    const r = Math.floor(k / w.cols)
    g.glyph(c, r, v > 0.5 ? "~" : hash(c, r, 3) > 0.5 ? "·" : "-", g.ink, Math.min(0.32, v * 0.4))
  }

  for (const b of w.bait) {
    if (!b.alive) continue
    const [c, r] = cellOf(b.x, b.y)
    g.glyph(c, r, stroke(Math.atan2(b.vy, b.vx)), g.ink, 0.36 + b.alarm * 0.45)
  }

  // Blood: a dense red bloom that thins and spreads as it fades.
  for (const b of w.blood) {
    const t = b.age / BLOOD_LIFE
    const radius = cell * 1.5 + Math.sqrt(t) * cell * 7
    const seen = new Set<string>()
    for (let i = 0; i < 46; i++) {
      const a = hash(b.seed, i, 1) * Math.PI * 2 + t * (hash(b.seed, i, 4) - 0.5)
      const d = radius * Math.sqrt(hash(b.seed, i, 2))
      const [c, r] = cellOf(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d + t * cell * 2)
      if (seen.has(`${c},${r}`)) continue
      seen.add(`${c},${r}`)
      const k = Math.min(RAMP.length - 1, Math.floor((1 - d / radius) * (1 - t) * RAMP.length))
      g.glyph(c, r, RAMP[k], accent, Math.pow(1 - t, 0.7) * (0.5 + (1 - d / radius) * 0.5))
    }
  }

  for (const h of [...w.hunters].sort((a, b) => a.depth - b.depth)) {
    const P = h.hammer ? HAMMER : PROFILES[kind]
    const L = h.length
    const fade = 0.4 + 0.6 * h.depth
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    const spine = h.body.length ? h.body : h.spine
    for (const [x, y] of spine) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
    }
    const pad = L * 0.42
    const [c0, r0] = cellOf(x0 - pad, y0 - pad)
    const [c1, r1] = cellOf(x1 + pad, y1 + pad)
    for (let r = Math.max(0, r0); r <= Math.min(g.rows, r1); r++)
      for (let c = Math.max(0, c0); c <= Math.min(g.cols, c1); c++) {
        const { s, l } = locate(spine, (c + 0.5) * cell, (r + 0.5) * cell)
        const body = P.body(s) * L
        // Texture lives in body space, so it travels with the fish instead
        // of flickering as the body slides over the grid.
        const bi = Math.round((s * L) / cell)
        const bj = Math.round(l / cell)
        const n = hash(bi, bj, h.seed)
        const a = Math.abs(l)
        if (a <= body + cell * 0.45) {
          // Soft edge: a cell half over the body is half there.
          const cover = Math.max(0, Math.min(1, (body - a) / cell + 0.6))
          if (cover <= 0.05) continue
          // Light from one side: bright flank sparse, far flank dense.
          const u = l / Math.max(1, body)
          const light = Math.max(0, Math.min(1, 0.62 - u * 0.32 - Math.abs(u) * Math.abs(u) * 0.3 + (n - 0.5) * 0.18))
          const char = RAMP[Math.min(RAMP.length - 1, Math.max(2, Math.floor((1 - light) * RAMP.length)))]
          const tail = smooth(0.6, 1, s)
          // The dorsal fin, seen from above: a bright dense line down the back.
          const ridge = P.ridge && s > P.ridge[0] && s < P.ridge[1] && Math.abs(u) < 0.12
          if (kind === "shark") {
            // Sharks are tiles: a block shaded by the light with its glyph on
            // top, and a few tiles in the shark's own muted hues that shift
            // slowly, like light through water.
            const t = hash(bi, bj, h.seed + Math.floor(g.time * 0.7 + n * 3))
            const tint = t < 0.16 ? h.tints[Math.floor(t * 100) % h.tints.length] : null
            g.block(c, r, tint ?? g.ink, (tint ? 0.42 : 0.17 + (1 - light) * 0.3) * (1 - tail * 0.4) * cover * fade)
          }
          g.glyph(c, r, ridge ? "8" : char, g.ink, (ridge ? 0.9 : 0.95 - tail * 0.3) * cover * fade)
          continue
        }
        // Into a turn the inner fin tucks and the outer one spreads (l < 0 is the fish's right).
        const lean = Math.max(-1, Math.min(1, h.turn / P.agility)) * 0.55
        if (P.fins.some((f, i) => inFin(f, P.body, s, a / L, i === 0 ? 1 + lean * Math.sign(l) : 1))) {
          const char = FIN[Math.floor(n * FIN.length)]

          // Piranhas wear their colour on the fins.
          // Fins stay lighter than the body, so the silhouette reads.
          g.glyph(c, r, kind === "piranha" ? char : ":;.'"[Math.floor(n * 4)], kind === "piranha" ? accent : g.ink, (kind === "piranha" ? 0.9 : 0.5) * fade)
        }
      }

    // Gill slits: short strokes across each flank.
    if (P.gills) {
      const [g0, g1] = P.gills
      for (let k = 0; k < 4; k++) {
        const gs = g0 + ((g1 - g0) * k) / 3
        for (const side of [-1, 1])
          for (const f of [0.55, 0.85]) {
            const q = point(spine, gs, side * P.body(gs) * L * f)
            const [qc, qr] = cellOf(q.x, q.y)
            // Drawn over the tile, never through it: a punched cell reads as a hole.
            g.block(qc, qr, g.ink, 0.22 * fade)
            g.glyph(qc, qr, stroke(q.dir + Math.PI / 2), g.ink, 0.85 * fade)
          }
      }
    }

    // Eyes; piranhas show their teeth.
    for (const side of [-1, 1]) {
      const eye = point(spine, P.eye[0], side * P.eye[1] * L)
      const [ec, er] = cellOf(eye.x, eye.y)
      g.clear(ec, er)
      g.glyph(ec, er, kind === "shark" ? "." : "o", g.ink, 1)
    }
    if (kind === "piranha") {
      const jaw = point(spine, 0.01, 0)
      const [jc, jr] = cellOf(jaw.x + Math.cos(jaw.dir) * cell * 0.6, jaw.y + Math.sin(jaw.dir) * cell * 0.6)
      g.glyph(jc, jr, "v", g.ink, h.target || w.blood.length ? 1 : 0.6)
    }
  }

  // Splashes where something was eaten.
  for (const s of w.splashes) {
    const t = s.age / SPLASH_LIFE
    for (let i = 0; i < 7; i++) {
      const a = hash(s.seed, i, 1) * Math.PI * 2
      const d = (6 + hash(s.seed, i, 2) * 22) * Math.sqrt(t)
      const [c, r] = cellOf(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d)
      g.glyph(c, r, "*'.,`"[i % 5], kind === "piranha" ? accent : g.ink, (1 - t) * 0.8)
    }
  }
}

export function Ocean({
  predator = "shark",
  count,
  accent = "oklch(0.62 0.2 25)",
  cell = 10,
  onEat,
  children,
  className,
}: {
  predator?: Kind
  /** How many hunters; defaults to 3 sharks or a pack of 8 piranhas, fewer in a small ocean. */
  count?: number
  /** The piranhas' fins, splashes and blood; sharks stay in the ink. */
  accent?: string
  cell?: number
  onEat?: (eaten: number) => void
  children?: React.ReactNode
  className?: string
}) {
  const eat = React.useRef(onEat)
  React.useEffect(() => {
    eat.current = onEat
  })
  const want = count ?? (predator === "shark" ? 3 : 8)

  const { canvas, scene } = useAsciiCanvas<Water & { kind: Kind }>({
    cell,
    init: ({ width, height }, prev) => {
      const area = width * height
      const n = Math.max(predator === "shark" ? 1 : 3, Math.min(want, Math.round(area / (predator === "shark" ? 200000 : 60000))))
      if (prev && prev.kind === predator && prev.hunters.length === n)
        return { ...prev, width, height, cols: Math.ceil(width / cell), wake: new Map() }
      const schools = Math.max(2, Math.round(area / 160000))
      return {
        kind: predator,
        width,
        height,
        hunters: Array.from({ length: n }, (_, i) => spawnHunter(predator, width, height, i, n)),
        bait: Array.from({ length: schools }, (_, i) =>
          school(width * (0.2 + hash(i, 1, 9) * 0.6), height * (0.2 + hash(i, 2, 9) * 0.6), 16, i + 1)
        ).flat(),
        splashes: [],
        blood: [],
        wake: new Map(),
        cell,
        cols: Math.ceil(width / cell),
        eaten: prev?.eaten ?? 0,
        onEat: (k) => eat.current?.(k),
      }
    },
    step: (w, dt, time) => step(w.kind, w, dt, time),
    draw: (g, w) => draw(w.kind, g, w, accent),
  })

  return (
    <div
      data-slot="ocean"
      className={cn("relative isolate overflow-hidden", className)}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("a,button,input,select,textarea,[role=button]")) return
        const w = scene.current
        if (!w) return
        const box = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - box.left
        const y = e.clientY - box.top
        // Piranhas get blood; sharks get a new school, and the oldest fish make room.
        if (w.kind === "piranha") {
          w.blood.push({ x, y, age: 0, seed: Math.random() * 1000 })
          return
        }
        const fresh = school(x, y, 12, Math.random() * 1000)
        w.bait.push(...fresh)
        if (w.bait.length > 160) w.bait.splice(0, w.bait.length - 160)
      }}
    >
      <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 -z-10 size-full text-foreground" />
      {children}
    </div>
  )
}
