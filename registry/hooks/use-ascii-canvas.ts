import * as React from "react"
import { useReducedMotion } from "motion/react"

// useAsciiCanvas: the shared engine under uia's ASCII animations. It sizes a
// canvas to its box on a fixed cell grid (crisp at any DPR), reads the ink
// from CSS so light and dark just work, runs one rAF loop that sleeps while
// the canvas is off screen or the tab is hidden, and draws a single still
// frame under reduced motion. Each animation only writes `step` and `draw`.
//
//   const { canvas, scene } = useAsciiCanvas({ cell: 10, init, step, draw })
//   <canvas ref={canvas} className="absolute inset-0 size-full text-foreground" />
//
// `scene` is the live scene, for pointer handlers that add to it.

export type AsciiGrid = {
  ctx: CanvasRenderingContext2D
  /** Canvas size in CSS pixels. */
  width: number
  height: number
  /** Cell pitch in CSS pixels, and the grid in cells. */
  cell: number
  cols: number
  rows: number
  /** The canvas's computed `color`: the ink every glyph and cell is drawn in. */
  ink: string
  /** The page's background, for glyphs cut into a tile. */
  paper: string
  /** Seconds since start. */
  time: number
  /** Fill one cell as a small rounded square. */
  block: (col: number, row: number, color: string, alpha: number) => void
  /** Draw one glyph centred in a cell. */
  glyph: (col: number, row: number, char: string, color: string, alpha: number) => void
  /** A small dot centred in a cell. */
  dot: (col: number, row: number, color: string, alpha: number) => void
  /** Punch a cell back to the page (an eye, a gap). */
  clear: (col: number, row: number) => void
}

/** Deterministic 0–1 noise for a cell (or any three numbers). */
export function hash(a: number, b: number, c: number) {
  const h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453
  return h - Math.floor(h)
}

/** The ASCII stroke that follows a direction (radians, screen space, y down). */
export function stroke(angle: number) {
  const a = ((angle % Math.PI) + Math.PI) % Math.PI
  if (a < Math.PI / 8 || a > (7 * Math.PI) / 8) return "-"
  if (a < (3 * Math.PI) / 8) return "\\"
  if (a < (5 * Math.PI) / 8) return "|"
  return "/"
}

export function useAsciiCanvas<S>({
  cell = 10,
  init,
  step,
  draw,
}: {
  cell?: number
  /** Builds the scene for a grid size; runs again when the box resizes. */
  init: (size: { width: number; height: number; cols: number; rows: number }, prev: S | null) => S
  /** Advances the scene by `dt` seconds. */
  step: (scene: S, dt: number, time: number) => void
  draw: (grid: AsciiGrid, scene: S) => void
}) {
  const reduced = useReducedMotion()
  const canvas = React.useRef<HTMLCanvasElement | null>(null)
  const scene = React.useRef<S | null>(null)
  // The latest callbacks, so the loop never restarts for a new closure.
  const fns = React.useRef({ init, step, draw })
  React.useLayoutEffect(() => {
    fns.current = { init, step, draw }
  })

  React.useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext("2d")
    if (!ctx) return

    let width = 0
    let height = 0
    let ink = "currentColor"
    let paper = "transparent"
    let visible = true
    let raf = 0
    let last = 0
    let time = 0

    const font = `600 ${Math.round(cell * 1.1)}px var(--font-mono, ui-monospace), ui-monospace, monospace`
    const api = {} as Pick<AsciiGrid, "dot" | "clear">
    const grid = (): AsciiGrid => ({
      ...api,
      ctx,
      width,
      height,
      cell,
      cols: Math.ceil(width / cell),
      rows: Math.ceil(height / cell),
      ink,
      paper,
      time,
      block: (c, r, color, alpha) => {
        if (alpha <= 0.01) return
        ctx.globalAlpha = Math.min(1, alpha)
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.roundRect(c * cell + 0.5, r * cell + 0.5, cell - 1, cell - 1, cell * 0.16)
        ctx.fill()
      },
      glyph: (c, r, char, color, alpha) => {
        if (alpha <= 0.01) return
        ctx.globalAlpha = Math.min(1, alpha)
        ctx.fillStyle = color
        ctx.fillText(char, c * cell + cell / 2, r * cell + cell / 2 + 0.5)
      },
    })

    Object.assign(api, {
      dot: (c: number, r: number, color: string, alpha: number) => {
        if (alpha <= 0.01) return
        ctx.globalAlpha = Math.min(1, alpha)
        ctx.fillStyle = color
        const d = Math.max(2, cell * 0.3)
        ctx.fillRect(c * cell + (cell - d) / 2, r * cell + (cell - d) / 2, d, d)
      },
      clear: (c: number, r: number) => ctx.clearRect(c * cell, r * cell, cell, cell),
    })

    const paint = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, el.width, el.height)
      const dpr = el.width / Math.max(1, width)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = font
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      if (scene.current) fns.current.draw(grid(), scene.current)
      ctx.globalAlpha = 1
    }

    const readInk = () => {
      ink = getComputedStyle(el).color || "currentColor"
      paper = getComputedStyle(document.documentElement).getPropertyValue("--background").trim() || "transparent"
    }

    const resize = () => {
      const box = el.getBoundingClientRect()
      width = Math.max(1, Math.round(box.width))
      height = Math.max(1, Math.round(box.height))
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      el.width = Math.round(width * dpr)
      el.height = Math.round(height * dpr)
      scene.current = fns.current.init(
        { width, height, cols: Math.ceil(width / cell), rows: Math.ceil(height / cell) },
        scene.current
      )
      readInk()
      paint()
    }

    const frame = (now: number) => {
      raf = 0
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      time += dt
      if (scene.current) fns.current.step(scene.current, dt, time)
      paint()
      schedule()
    }
    const schedule = () => {
      if (reduced || !visible || document.hidden || raf) return
      raf = requestAnimationFrame(frame)
    }
    const wake = () => {
      last = 0
      schedule()
    }

    const ro = new ResizeObserver(resize)
    ro.observe(el)
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible) wake()
    })
    io.observe(el)
    // Theme switches flip a class on <html>: read the ink again.
    const mo = new MutationObserver(() => {
      readInk()
      paint()
    })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] })
    document.addEventListener("visibilitychange", wake)

    resize()
    schedule()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      mo.disconnect()
      document.removeEventListener("visibilitychange", wake)
    }
  }, [cell, reduced])

  return { canvas, scene }
}
