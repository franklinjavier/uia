import * as React from "react"

// useSoundscape: a small sound loop for an ASCII backdrop, synthesised with
// Web Audio (no files): water for the koi, the deep for the sharks, a river
// for the piranhas, wind and chatter for the starlings, crickets for the
// fireflies, a cold wind and a slow drone under the aurora. It plays while `on`, behind a toggle the viewer can turn off;
// browsers keep it silent until the first click or key, and it starts then.
// `cue` adds a sound on top, for a click or an event (a koi fed, a fish
// taken, a hawk through).
//
//   const cue = useSoundscape("koi", sound)
//   <KoiPond onFeed={(n) => { setFed(n); cue("event") }} />

export type Soundscape = "koi" | "shark" | "piranha" | "starling" | "firefly" | "aurora"
export type Cue = "click" | "event"

type Kit = {
  ctx: AudioContext
  out: GainNode
  noise: AudioBuffer
  alive: () => boolean
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** A filtered noise bed that swells slowly. */
function bed(k: Kit, type: BiquadFilterType, freq: number, gain: number, lfo = 0.1, depth = 0, q = 0.7) {
  const src = k.ctx.createBufferSource()
  src.buffer = k.noise
  src.loop = true
  const filter = k.ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  filter.Q.value = q
  const level = k.ctx.createGain()
  level.gain.value = gain
  src.connect(filter).connect(level).connect(k.out)
  if (depth) {
    const osc = k.ctx.createOscillator()
    osc.frequency.value = lfo
    const amount = k.ctx.createGain()
    amount.gain.value = depth
    osc.connect(amount).connect(filter.frequency)
    osc.start()
  }
  src.start()
}

/** One pitched note sweeping `from` → `to`, struck and fading. */
function tone(k: Kit, o: { from: number; to?: number; dur: number; gain: number; at?: number; type?: OscillatorType; pan?: number; vibrato?: number }) {
  const t = k.ctx.currentTime + (o.at ?? 0)
  const osc = k.ctx.createOscillator()
  osc.type = o.type ?? "sine"
  osc.frequency.setValueAtTime(o.from, t)
  osc.frequency.exponentialRampToValueAtTime(o.to ?? o.from, t + o.dur)
  if (o.vibrato) {
    const lfo = k.ctx.createOscillator()
    lfo.frequency.value = o.vibrato
    const amount = k.ctx.createGain()
    amount.gain.value = o.from * 0.04
    lfo.connect(amount).connect(osc.frequency)
    lfo.start(t)
    lfo.stop(t + o.dur)
  }
  const env = k.ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(o.gain, t + Math.min(0.01, o.dur / 4))
  env.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
  const pan = k.ctx.createStereoPanner()
  pan.pan.value = o.pan ?? 0
  osc.connect(env).connect(pan).connect(k.out)
  osc.start(t)
  osc.stop(t + o.dur + 0.02)
}

/** A burst of noise through a filter that sweeps `from` → `to`. */
function burst(k: Kit, o: { type: BiquadFilterType; from: number; to?: number; dur: number; gain: number; q?: number; at?: number }) {
  const t = k.ctx.currentTime + (o.at ?? 0)
  const src = k.ctx.createBufferSource()
  src.buffer = k.noise
  const filter = k.ctx.createBiquadFilter()
  filter.type = o.type
  filter.Q.value = o.q ?? 0.7
  filter.frequency.setValueAtTime(o.from, t)
  filter.frequency.exponentialRampToValueAtTime(o.to ?? o.from, t + o.dur)
  const env = k.ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(o.gain, t + 0.01)
  env.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
  src.connect(filter).connect(env).connect(k.out)
  src.start(t, Math.random())
  src.stop(t + o.dur + 0.02)
}

/** Runs `fn` again and again, `min`–`max` seconds apart, while the scape lives. */
function every(k: Kit, min: number, max: number, fn: () => void) {
  const tick = () => {
    if (!k.alive()) return
    fn()
    window.setTimeout(tick, rand(min, max) * 1000)
  }
  window.setTimeout(tick, rand(0, max) * 1000)
}

const plop = (k: Kit, at = 0) => tone(k, { from: rand(650, 1100), to: 260, dur: 0.12, gain: 0.12, at, pan: rand(-0.6, 0.6) })
const bubbles = (k: Kit) => {
  let at = 0
  for (let i = 0, n = 3 + Math.floor(rand(0, 5)); i < n; i++) {
    const f = rand(500, 1300)
    tone(k, { from: f, to: f * 1.6, dur: 0.04, gain: 0.04, at, pan: rand(-0.5, 0.5) })
    at += rand(0.05, 0.11)
  }
}

const SCAPES: Record<Soundscape, { loop: (k: Kit) => void; click?: (k: Kit) => void; event?: (k: Kit) => void }> = {
  koi: {
    loop: (k) => {
      bed(k, "lowpass", 500, 0.05, 0.15, 200)
      every(k, 1.2, 4, () => plop(k))
    },
    // Three pellets landing.
    click: (k) => [0, 0.07, 0.15].forEach((at) => plop(k, at)),
    // A koi gulps one down.
    event: (k) => tone(k, { from: 180, to: 110, dur: 0.15, gain: 0.1 }),
  },
  shark: {
    loop: (k) => {
      bed(k, "lowpass", 160, 0.22, 0.08, 60)
      bed(k, "bandpass", 400, 0.02, 0.2, 150, 2)
      every(k, 2, 6, () => bubbles(k))
    },
    click: (k) => {
      burst(k, { type: "lowpass", from: 3000, to: 400, dur: 0.5, gain: 0.25 })
      bubbles(k)
    },
    event: (k) => {
      tone(k, { from: 90, to: 45, dur: 0.18, gain: 0.25 })
      burst(k, { type: "lowpass", from: 600, dur: 0.08, gain: 0.1 })
    },
  },
  piranha: {
    loop: (k) => {
      bed(k, "bandpass", 900, 0.06, 0.3, 300, 0.8)
      bed(k, "highpass", 3000, 0.012, 2.3, 800)
      every(k, 0.4, 1.5, () => tone(k, { from: rand(1200, 2000), to: 900, dur: 0.05, gain: 0.03, pan: rand(-0.7, 0.7) }))
    },
    // Blood in the water: a splash and a thud.
    click: (k) => {
      burst(k, { type: "lowpass", from: 1800, to: 300, dur: 0.6, gain: 0.25 })
      tone(k, { from: 120, to: 60, dur: 0.25, gain: 0.2 })
    },
    // A bite.
    event: (k) => {
      burst(k, { type: "highpass", from: 2500, dur: 0.025, gain: 0.08 })
      tone(k, { from: 600, to: 300, dur: 0.03, gain: 0.02, type: "square" })
    },
  },
  starling: {
    loop: (k) => {
      bed(k, "bandpass", 450, 0.05, 0.07, 250, 0.6)
      // The chatter of the flock: small clusters of quick chirps.
      every(k, 0.3, 1.4, () => {
        let at = 0
        const pan = rand(-0.8, 0.8)
        for (let i = 0, n = 2 + Math.floor(rand(0, 4)); i < n; i++) {
          const f = rand(2800, 4800)
          tone(k, { from: f, to: f * rand(0.75, 1.3), dur: rand(0.06, 0.12), gain: 0.025, at, pan })
          at += rand(0.05, 0.15)
        }
      })
    },
    // The hawk's cry, and the flock's wings as it breaks.
    event: (k) => {
      tone(k, { from: 2600, to: 1700, dur: 0.7, gain: 0.05, type: "sawtooth", vibrato: 30 })
      burst(k, { type: "bandpass", from: 800, to: 300, dur: 0.8, gain: 0.08, at: 0.1 })
    },
  },
  firefly: {
    loop: (k) => {
      bed(k, "lowpass", 300, 0.03, 0.05, 80)
      // A few crickets, each on its own beat and side.
      for (let c = 0; c < 3; c++) {
        const f = rand(4200, 4900)
        const pan = rand(-0.8, 0.8)
        const beat = rand(0.45, 0.7)
        every(k, beat, beat * 1.08, () => {
          for (let i = 0; i < 3; i++) tone(k, { from: f, dur: 0.025, gain: 0.015, at: i * 0.045, pan })
        })
      }
    },
    // A soft chime with the flash.
    click: (k) => [880, 1318.5, 1760].forEach((f, i) => tone(k, { from: f, dur: 1.6, gain: 0.05, at: i * 0.03 })),
  },
  aurora: {
    loop: (k) => {
      // Wind far off, muffled, swelling slowly.
      bed(k, "lowpass", 220, 0.05, 0.04, 80)
      // A low drone, two voices beating slowly against each other.
      for (const f of [110, 110.6, 164.8]) {
        const osc = k.ctx.createOscillator()
        osc.frequency.value = f
        const level = k.ctx.createGain()
        level.gain.value = 0.018
        osc.connect(level).connect(k.out)
        osc.start()
      }
      // Now and then a faint falling whistle, high up.
      every(k, 5, 12, () => tone(k, { from: rand(3000, 4500), to: rand(900, 1400), dur: rand(1.2, 2), gain: 0.012, pan: rand(-0.6, 0.6) }))
    },
    // The substorm: a shimmer rising.
    click: (k) => [440, 659.3, 880, 1318.5].forEach((f, i) => tone(k, { from: f, to: f * 1.5, dur: 2.4, gain: 0.03, at: i * 0.12, pan: rand(-0.5, 0.5), vibrato: 5 })),
  },
}

/** The one soundscape playing on the page; a new one stops it, so scenes never mix. */
let playing: { stop: () => void } | null = null

function start(kind: Soundscape) {
  playing?.stop()
  const ctx = new AudioContext()
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const out = ctx.createGain()
  out.gain.setValueAtTime(0.0001, ctx.currentTime)
  out.gain.exponentialRampToValueAtTime(0.8, ctx.currentTime + 1)
  out.connect(ctx.destination)
  let alive = true
  const kit: Kit = { ctx, out, noise, alive: () => alive }
  const scape = SCAPES[kind]
  // Browsers hold sound until the viewer touches the page; start then.
  const wake = () => void ctx.resume()
  if (ctx.state === "suspended") {
    window.addEventListener("pointerdown", wake, { once: true, capture: true })
    window.addEventListener("keydown", wake, { once: true, capture: true })
  }
  scape.loop(kit)
  // Events can come in bursts (a pack feeding): one sound per 80ms is plenty.
  let last = 0
  const self = {
    cue: (c: Cue) => {
      if (!alive) return
      const now = performance.now()
      if (c === "event" && now - last < 80) return
      if (c === "event") last = now
      scape[c]?.(kit)
    },
    stop: () => {
      if (!alive) return
      alive = false
      if (playing === self) playing = null
      window.removeEventListener("pointerdown", wake, { capture: true })
      window.removeEventListener("keydown", wake, { capture: true })
      out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08)
      window.setTimeout(() => void ctx.close(), 400)
    },
  }
  playing = self
  return self
}

export function useSoundscape(kind: Soundscape, on: boolean) {
  const live = React.useRef<ReturnType<typeof start> | null>(null)
  React.useEffect(() => {
    if (!on || typeof AudioContext === "undefined") return
    const scape = start(kind)
    live.current = scape
    return () => {
      scape.stop()
      live.current = null
    }
  }, [kind, on])
  return React.useCallback((c: Cue) => live.current?.cue(c), [])
}
