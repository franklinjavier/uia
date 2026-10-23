import * as React from "react"
import { motion, useReducedMotion } from "motion/react"
import { CheckIcon, Loader2Icon, RadioTowerIcon, TargetIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { springSoft } from "@/lib/motion"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MeterBar } from "@/components/ds/meter-bar"
import { Stat, StatLabel, StatUnit, StatValue } from "@/components/ds/stat"
import { StatusBadge, StatusDot } from "@/components/ds/status"
import {
  Widget,
  WidgetActions,
  WidgetFooter,
  WidgetHeader,
  WidgetList,
  WidgetListRow,
  WidgetMeta,
  WidgetPanel,
  WidgetTitle,
} from "@/components/ds/widget"

// GroundStation: satellites passing over one ground station. A wireframe
// globe you drag to turn (the station's side faces you by default), the
// selected satellite's pass (a sky plot of its track, the countdown or the
// live downlink, what it holds onboard), and every satellite as a row with
// its passes over the next hours. Pure view: pass the time, the orbits and
// the station in; the pass math is exported (`look`, `passes`) so the
// caller and the widget agree on what is in view.
//
//   <GroundStation stations={STATIONS} stationId={id} onStationChange={setId}
//     satellites={sats} selectedId={sel} onSelect={setSel} time={t}
//     onBook={book} />

/* --------------------------------- orbits -------------------------------- */

export const EARTH_KM = 6371
const SIDEREAL_S = 86164
const MU = 398600.4418 // km³/s²

export type GroundStationSite = { id: string; name: string; lat: number; lon: number }

export type Orbit = {
  /** Inclination, degrees. */
  inc: number
  /** Right ascension of the ascending node, degrees. */
  raan: number
  /** Altitude, km. */
  alt: number
  /** Where along the orbit it is at t = 0, degrees. */
  phase: number
}

export type GroundSatellite = {
  id: string
  /** Mono descriptor under the name ("SSO · 548 km"). */
  label: string
  orbit: Orbit
  /** Data waiting onboard, GB. */
  onboard: number
  capacity: number
}

type V3 = [number, number, number]
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const norm = (a: V3) => Math.hypot(a[0], a[1], a[2])
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

export const periodOf = (o: Orbit) => 2 * Math.PI * Math.sqrt((EARTH_KM + o.alt) ** 3 / MU)
const earthAngle = (t: number) => (2 * Math.PI * t) / SIDEREAL_S

/** Unit vector of a point on the orbit `u` radians past the node (inertial frame). */
function orbitPoint(o: Orbit, u: number): V3 {
  const i = rad(o.inc)
  const W = rad(o.raan)
  const x = Math.cos(u)
  const y = Math.sin(u) * Math.cos(i)
  const z = Math.sin(u) * Math.sin(i)
  return [x * Math.cos(W) - y * Math.sin(W), x * Math.sin(W) + y * Math.cos(W), z]
}

const argAt = (o: Orbit, t: number) => rad(o.phase) + (2 * Math.PI * t) / periodOf(o)

/** Unit vector of a site at time t (inertial frame). */
function sitePoint(s: { lat: number; lon: number }, t: number): V3 {
  const lat = rad(s.lat)
  const lon = rad(s.lon) + earthAngle(t)
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]
}

/** Elevation and azimuth of a satellite seen from a site, degrees. */
export function look(site: { lat: number; lon: number }, o: Orbit, t: number) {
  const up = sitePoint(site, t)
  const s = up.map((v) => v * EARTH_KM) as V3
  const p = orbitPoint(o, argAt(o, t)).map((v) => v * (EARTH_KM + o.alt)) as V3
  const d = sub(p, s)
  const r = norm(d)
  const east0 = cross([0, 0, 1], up)
  const east = east0.map((v) => v / (norm(east0) || 1)) as V3
  const north = cross(up, east)
  const el = deg(Math.asin(dot(d, up) / r))
  const az = (deg(Math.atan2(dot(d, east), dot(d, north))) + 360) % 360
  return { el, az }
}

export type Pass = { start: number; end: number; maxEl: number }

/** Passes above `mask` degrees between `from` and `to` (seconds), sampled every `step`. */
export function passes(site: { lat: number; lon: number }, o: Orbit, from: number, to: number, mask = 10, step = 20) {
  const out: Pass[] = []
  let open: Pass | null = null
  for (let t = from; t <= to; t += step) {
    const { el } = look(site, o, t)
    if (el > mask) {
      if (!open) open = { start: t, end: t, maxEl: el }
      open.end = t
      open.maxEl = Math.max(open.maxEl, el)
    } else if (open) {
      out.push(open)
      open = null
    }
  }
  if (open) out.push(open)
  return out
}

/* --------------------------------- globe --------------------------------- */

type Projected = { x: number; y: number; front: boolean }

function project(v: V3, yaw: number, pitch: number, r: number, c: number): Projected {
  const x1 = v[0] * Math.cos(yaw) - v[1] * Math.sin(yaw)
  const y1 = v[0] * Math.sin(yaw) + v[1] * Math.cos(yaw)
  const z1 = v[2]
  const y2 = y1 * Math.cos(pitch) - z1 * Math.sin(pitch)
  const z2 = y1 * Math.sin(pitch) + z1 * Math.cos(pitch)
  // Points beyond the sphere's silhouette count as front even when slightly behind.
  const behind = y2 > 0 && Math.hypot(x1, z2) < 1
  return { x: c + r * x1, y: c - r * z2, front: !behind }
}

/** Polyline split into front and back runs. */
function runs(points: Projected[]) {
  const front: string[] = []
  const back: string[] = []
  let cur: Projected[] = []
  const flush = () => {
    if (cur.length > 1) (cur[0].front ? front : back).push(cur.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "))
    cur = []
  }
  for (const p of points) {
    if (cur.length && cur[0].front !== p.front) {
      const last = cur[cur.length - 1]
      flush()
      cur.push(last)
    }
    cur.push(p)
  }
  flush()
  return { front, back }
}

/** Altitude drawn larger than life, or every orbit would hug the sphere. */
const shown = (alt: number) => 1 + (alt / EARTH_KM) * 3.2

function Globe({
  site,
  satellites,
  selectedId,
  live,
  time,
  mask,
}: {
  site: GroundStationSite
  satellites: GroundSatellite[]
  selectedId: string
  live: Record<string, number | undefined>
  time: number
  mask: number
}) {
  const reduced = useReducedMotion()
  const [drag, setDrag] = React.useState({ yaw: 0, pitch: 0 })
  const start = React.useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null)
  const [grabbing, setGrabbing] = React.useState(false)
  const size = 220
  const c = size / 2
  const r = 66

  // Follow the station round the planet; dragging adds an offset on top.
  const yaw = -Math.PI / 2 - (rad(site.lon) + earthAngle(time)) + drag.yaw
  const pitch = Math.max(-1.2, Math.min(1.2, rad(site.lat) * 0.75 + drag.pitch))
  const P = (v: V3, k = 1) => project(v.map((x) => x * k) as V3, yaw, pitch, r, c)

  const graticule = React.useMemo(() => {
    const lines: V3[][] = []
    for (let lat = -60; lat <= 60; lat += 30)
      lines.push(Array.from({ length: 73 }, (_, i) => {
        const lon = rad(i * 5)
        return [Math.cos(rad(lat)) * Math.cos(lon), Math.cos(rad(lat)) * Math.sin(lon), Math.sin(rad(lat))] as V3
      }))
    for (let lon = 0; lon < 180; lon += 30)
      lines.push(Array.from({ length: 73 }, (_, i) => {
        const a = rad(i * 5)
        return [Math.cos(a) * Math.cos(rad(lon)), Math.cos(a) * Math.sin(rad(lon)), Math.sin(a)] as V3
      }))
    return lines
  }, [])
  const spin = earthAngle(time)
  const toInertial = (v: V3): V3 => [
    v[0] * Math.cos(spin) - v[1] * Math.sin(spin),
    v[0] * Math.sin(spin) + v[1] * Math.cos(spin),
    v[2],
  ]

  const station = P(sitePoint(site, time))
  const selected = satellites.find((s) => s.id === selectedId)

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={cn("mx-auto block h-52 w-52 touch-none select-none", grabbing ? "cursor-grabbing" : "cursor-grab")}
      role="img"
      aria-label={`Globe: ${site.name} and ${satellites.length} orbits. Drag to turn.`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { x: e.clientX, y: e.clientY, ...drag }
        setGrabbing(true)
      }}
      onPointerMove={(e) => {
        const s = start.current
        if (!s) return
        setDrag({ yaw: s.yaw + (e.clientX - s.x) / 90, pitch: s.pitch + (e.clientY - s.y) / 90 })
      }}
      onPointerUp={() => {
        start.current = null
        setGrabbing(false)
      }}
      onPointerCancel={() => {
        start.current = null
        setGrabbing(false)
      }}
      onDoubleClick={() => setDrag({ yaw: 0, pitch: 0 })}
    >
      <circle cx={c} cy={c} r={r} className="fill-card stroke-foreground/45" strokeWidth={1} />
      {graticule.map((line, i) => {
        const { front, back } = runs(line.map((v) => P(toInertial(v))))
        return (
          <g key={i}>
            {back.map((pts, j) => <polyline key={`b${j}`} points={pts} className="fill-none stroke-foreground/8" strokeWidth={0.75} />)}
            {front.map((pts, j) => <polyline key={`f${j}`} points={pts} className="fill-none stroke-foreground/25" strokeWidth={0.75} />)}
          </g>
        )
      })}

      {satellites.map((s) => {
        const k = shown(s.orbit.alt)
        const path = Array.from({ length: 121 }, (_, i) => P(orbitPoint(s.orbit, (i / 120) * 2 * Math.PI), k))
        const { front, back } = runs(path)
        const on = s.id === selectedId
        return (
          <g key={s.id} className={on ? (live[s.id] !== undefined ? "text-success" : "text-foreground") : "text-muted-foreground"}>
            {back.map((pts, j) => (
              <polyline key={`b${j}`} points={pts} className="fill-none stroke-current" strokeOpacity={on ? 0.45 : 0.25} strokeDasharray="2 3" strokeWidth={1} />
            ))}
            {front.map((pts, j) => (
              <polyline key={`f${j}`} points={pts} className="fill-none stroke-current" strokeOpacity={on ? 0.9 : 0.45} strokeWidth={on ? 1.25 : 1} />
            ))}
          </g>
        )
      })}

      {/* The station, and a line to whatever it is talking to. */}
      {satellites.map((s) => {
        if (live[s.id] === undefined) return null
        const p = P(orbitPoint(s.orbit, argAt(s.orbit, time)), shown(s.orbit.alt))
        return (
          <line key={`link-${s.id}`} x1={station.x} y1={station.y} x2={p.x} y2={p.y} className="stroke-success" strokeWidth={1} strokeDasharray="1.5 2.5">
            {!reduced && <animate attributeName="stroke-dashoffset" from="8" to="0" dur="0.8s" repeatCount="indefinite" />}
          </line>
        )
      })}
      {station.front && (
        <g>
          <circle cx={station.x} cy={station.y} r={6} className="fill-foreground/10" />
          <circle cx={station.x} cy={station.y} r={2.5} className="fill-foreground" />
        </g>
      )}

      {satellites.map((s) => {
        const p = P(orbitPoint(s.orbit, argAt(s.orbit, time)), shown(s.orbit.alt))
        const on = s.id === selectedId
        const isLive = live[s.id] !== undefined
        return (
          <g key={`sat-${s.id}`} opacity={p.front ? 1 : 0.35} className={isLive ? "text-success" : on ? "text-foreground" : "text-muted-foreground"}>
            <rect x={p.x - 3} y={p.y - 3} width={6} height={6} rx={1} transform={`rotate(45 ${p.x} ${p.y})`} className="fill-card stroke-current" strokeWidth={1.25} />
            {on && selected && (
              <text x={p.x + 8} y={p.y - 4} className="fill-current font-mono text-[8px] tracking-wider uppercase">
                <tspan>{s.id}</tspan>
                <tspan x={p.x + 8} dy={9} className="fill-muted-foreground">
                  {isLive ? `el ${Math.round(live[s.id]!)}°` : "not in view"}
                </tspan>
              </text>
            )}
          </g>
        )
      })}
      <title>{`Mask ${mask}°`}</title>
    </svg>
  )
}

/* -------------------------------- sky plot ------------------------------- */

/** Polar plot of a pass: centre is overhead, the rim is the horizon. */
function SkyPlot({ track, now, live }: { track: { az: number; el: number }[]; now?: { az: number; el: number }; live: boolean }) {
  const c = 32
  const R = 27
  const at = (p: { az: number; el: number }) => {
    const rr = (R * (90 - Math.max(0, p.el))) / 90
    return { x: c + rr * Math.sin(rad(p.az)), y: c - rr * Math.cos(rad(p.az)) }
  }
  const pts = track.map(at)
  const here = now && at(now)
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0" aria-hidden>
      <circle cx={c} cy={c} r={R} className="fill-none stroke-foreground/25" strokeWidth={0.75} />
      <circle cx={c} cy={c} r={R * 0.66} className="fill-none stroke-foreground/15" strokeWidth={0.75} strokeDasharray="1.5 2" />
      <circle cx={c} cy={c} r={R * 0.33} className="fill-none stroke-foreground/15" strokeWidth={0.75} />
      <path d={`M${c} ${c - R}V${c + R}M${c - R} ${c}H${c + R}`} className="stroke-foreground/15" strokeWidth={0.75} />
      {["N", "E", "S", "W"].map((l, i) => (
        <text key={l} x={c + [0, R + 3, 0, -R - 3][i]} y={c + [-R - 1.5, 1.5, R + 4.5, 1.5][i]} textAnchor="middle" className="fill-faint-foreground font-mono text-[4px]">
          {l}
        </text>
      ))}
      {pts.length > 1 && (
        <polyline
          points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          className={cn("fill-none", live ? "stroke-success" : "stroke-foreground/60")}
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeDasharray={live ? undefined : "2 2"}
        />
      )}
      {pts.length > 0 && <circle cx={pts[0].x} cy={pts[0].y} r={1.5} className="fill-card stroke-foreground/60" strokeWidth={0.75} />}
      {here && <circle cx={here.x} cy={here.y} r={2.25} className="fill-success" />}
    </svg>
  )
}

/* -------------------------------- timeline ------------------------------- */

/** Passes over the next `span` seconds as blocks on a baseline, now at the left. */
function PassTimeline({ windows, now, span, live }: { windows: Pass[]; now: number; span: number; live: boolean }) {
  const pct = (t: number) => Math.max(0, Math.min(100, ((t - now) / span) * 100))
  return (
    <div className="flex w-full flex-col gap-1" aria-hidden>
      <div className="relative h-3">
        <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
        {[1, 2].map((i) => (
          <div key={i} className="absolute bottom-0 h-1 w-px bg-border" style={{ left: `${(i / 3) * 100}%` }} />
        ))}
        {windows.map((w, i) => {
          const left = pct(w.start)
          const width = Math.max(4, pct(w.end) - left)
          const current = live && i === 0 && w.start <= now
          return (
            <motion.div
              key={w.start}
              layout="position"
              transition={springSoft}
              className={cn(
                "absolute bottom-0 rounded-[2px] border",
                current ? "border-success bg-success/80" : "border-foreground/50 bg-card"
              )}
              style={{ left: `${left}%`, width: `max(6px, ${width}%)`, height: `${5 + (w.maxEl / 90) * 7}px` }}
            />
          )
        })}
      </div>
      <div className="flex justify-between font-mono text-[10px] leading-none text-faint-foreground uppercase">
        <span>Now</span>
        <span>+{Math.round(span / 3600)}h</span>
      </div>
    </div>
  )
}

/* -------------------------------- widget --------------------------------- */

const clock = (t: number, withSeconds = true) => {
  const s = ((Math.floor(t) % 86400) + 86400) % 86400
  const hh = String(Math.floor(s / 3600)).padStart(2, "0")
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
  const ss = String(s % 60).padStart(2, "0")
  return withSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`
}

const span = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds))
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`
}

/** Acquisition of signal, short: "39m", "1h", "1h 15m". */
const aos = (seconds: number) => {
  const m = Math.max(1, Math.round(seconds / 60))
  if (m < 60) return `${m}m`
  return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`
}

const coord = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(1)}°${v >= 0 ? pos : neg}`

export function GroundStation({
  title = "Ground station",
  stations,
  stationId,
  onStationChange,
  satellites,
  selectedId,
  onSelect,
  time,
  speed = 1,
  mask = 10,
  horizon = 3 * 3600,
  onBook,
  className,
}: {
  title?: string
  stations: GroundStationSite[]
  stationId: string
  onStationChange?: (id: string) => void
  satellites: GroundSatellite[]
  selectedId: string
  onSelect?: (id: string) => void
  /** Simulation or real time, seconds (UTC seconds of the day work). */
  time: number
  /** How fast `time` runs against the wall clock (shown as ×60). */
  speed?: number
  /** Minimum elevation for a usable pass, degrees. */
  mask?: number
  /** How far ahead the rows look, seconds. */
  horizon?: number
  /** Book the selected satellite's next pass. */
  onBook?: (satelliteId: string, aos: number) => void | Promise<void>
  className?: string
}) {
  const site = stations.find((s) => s.id === stationId) ?? stations[0]
  const [booked, setBooked] = React.useState<{ key: string; state: "pending" | "done" } | null>(null)

  // Everything below is a function of (site, orbits, time): no state to drift.
  const rows = satellites.map((s) => {
    const now = look(site, s.orbit, time)
    const live = now.el > mask
    // Look back a little so a pass under way is whole (its start, its track).
    const ahead = passes(site, s.orbit, time - 1200, time + horizon, mask).filter((p) => p.end >= time)
    const later = () => passes(site, s.orbit, time + horizon, time + 86400, mask, 30)
    const next = live ? ahead[0] : (ahead.find((p) => p.start > time) ?? later()[0])
    // What Book reserves: never the pass already under way.
    const bookable = ahead.find((p) => p.start > time) ?? later()[0]
    return { sat: s, now, live, ahead, next, bookable }
  })
  const liveEl = Object.fromEntries(rows.filter((r) => r.live).map((r) => [r.sat.id, r.now.el]))
  const inView = rows.filter((r) => r.live).length
  const sel = rows.find((r) => r.sat.id === selectedId) ?? rows[0]
  const pass = sel.next
  const track = pass
    ? Array.from({ length: 24 }, (_, i) => look(site, sel.sat.orbit, pass.start + ((pass.end - pass.start) * i) / 23))
    : []
  const mbps = sel.live ? Math.round(40 + 110 * Math.sin(rad(Math.max(0, sel.now.el)))) : 0
  const book = sel.bookable
  const bookKey = book ? `${sel.sat.id}@${Math.round(book.start / 60)}` : ""
  const bookState = booked?.key === bookKey ? booked.state : null

  return (
    <Widget className={cn("max-w-[460px]", className)}>
      <WidgetHeader>
        <WidgetTitle>{title}</WidgetTitle>
        <WidgetActions>
          <Select value={site.id} onValueChange={(v) => v && onStationChange?.(v)}>
            <SelectTrigger aria-label="Station">
              <RadioTowerIcon className="text-muted-foreground" />
              <SelectValue>{(v: string) => stations.find((s) => s.id === v)?.name}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false} className="min-w-56">
              <SelectGroup>
                <SelectLabel className="eyebrow">Station</SelectLabel>
                {stations.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex flex-col">
                      <span>{s.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {coord(s.lat, "N", "S")} · {coord(s.lon, "E", "W")}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </WidgetActions>
      </WidgetHeader>

      <WidgetPanel className="relative flex flex-col gap-2">
        <Stat className="absolute top-5 left-5">
          <StatLabel>In view</StatLabel>
          <StatValue>
            {inView}
            <StatUnit>/ {satellites.length}</StatUnit>
          </StatValue>
        </Stat>
        <Globe site={site} satellites={satellites} selectedId={sel.sat.id} live={liveEl} time={time} mask={mask} />
        <div className="flex justify-between gap-3 eyebrow whitespace-nowrap text-muted-foreground">
          <span className="truncate">
            {site.name} · <span className="text-foreground">{coord(site.lat, "N", "S")}</span>
          </span>
          <span>
            Mask {mask}°<span className="max-sm:hidden"> · Drag to turn</span>
          </span>
        </div>
      </WidgetPanel>

      <WidgetPanel className="flex items-center gap-4">
        <SkyPlot track={track} now={sel.live ? sel.now : undefined} live={sel.live} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <Stat className="min-w-0">
              <StatLabel>
                {sel.live ? "Downlink" : "Next pass"} · {sel.sat.id}
              </StatLabel>
              <StatValue className={cn(sel.live && "text-success")}>
                {sel.live ? (
                  <>
                    {mbps}
                    <StatUnit>Mbps</StatUnit>
                  </>
                ) : pass ? (
                  <>
                    <StatUnit className="mr-1.5 ml-0">in</StatUnit>
                    {span(pass.start - time)}
                  </>
                ) : (
                  "No pass today"
                )}
              </StatValue>
            </Stat>
            {pass && (
              <span className="eyebrow shrink-0 self-start text-muted-foreground">
                {sel.live
                  ? `${Math.max(1, Math.round((pass.end - time) / 60))}m left`
                  : `Max ${Math.round(pass.maxEl)}° · ${Math.max(1, Math.round((pass.end - pass.start) / 60))}m`}
              </span>
            )}
          </div>
          <div className="flex justify-between eyebrow text-muted-foreground">
            <span>Onboard</span>
            <span className="text-foreground tabular-nums">
              {sel.sat.onboard.toFixed(1)} / {sel.sat.capacity} GB
            </span>
          </div>
          <MeterBar
            max={sel.sat.capacity}
            segments={[{ id: "onboard", value: sel.sat.onboard, color: sel.live ? "var(--success)" : undefined }]}
          />
        </div>
      </WidgetPanel>

      <WidgetPanel className="p-2">
        <WidgetList className="mx-0">
          {rows.map((r) => {
            const badge = r.live
              ? r.sat.id === sel.sat.id
                ? { tone: "success" as const, text: "Downlink" }
                : { tone: "info" as const, text: "In view" }
              : r.ahead[0]
                ? { tone: "neutral" as const, text: `AOS ${aos(r.ahead[0].start - time)}`, dot: false }
                : { tone: "neutral" as const, text: "No pass", dot: false }
            return (
              <WidgetListRow
                key={r.sat.id}
                selected={r.sat.id === sel.sat.id}
                onClick={() => onSelect?.(r.sat.id)}
                // Phones keep name and state; the timeline needs room to mean anything.
                className="grid-cols-[auto_minmax(0,1fr)_92px] gap-x-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(64px,120px)_92px]"
              >
                <StatusDot tone={r.live ? (r.sat.id === sel.sat.id ? "success" : "info") : "neutral"} pulse={r.live} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{r.sat.id}</span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground uppercase">{r.sat.label}</span>
                </span>
                <div className="max-sm:hidden">
                  <PassTimeline windows={r.ahead} now={time} span={horizon} live={r.live} />
                </div>
                <StatusBadge tone={badge.tone} dot={badge.dot ?? true} className="justify-self-end">
                  {badge.text}
                </StatusBadge>
              </WidgetListRow>
            )
          })}
        </WidgetList>
      </WidgetPanel>

      <WidgetFooter>
        <WidgetMeta className="flex items-center gap-2 font-mono">
          <StatusDot tone="success" pulse />
          UTC {clock(time)}
          {speed !== 1 && <span className="text-faint-foreground">· ×{speed}</span>}
        </WidgetMeta>
        {book && onBook && (
          <Button
            variant="brand"
            className="ml-auto min-w-32"
            disabled={bookState !== null}
            onClick={async () => {
              setBooked({ key: bookKey, state: "pending" })
              await onBook(sel.sat.id, book.start)
              setBooked({ key: bookKey, state: "done" })
            }}
          >
            {bookState === "pending" ? (
              <Loader2Icon className="animate-spin" />
            ) : bookState === "done" ? (
              <CheckIcon />
            ) : (
              <TargetIcon />
            )}
            {bookState === "done" ? `Booked ${clock(book.start, false)}` : `Book ${clock(book.start, false)}`}
          </Button>
        )}
      </WidgetFooter>
    </Widget>
  )
}
