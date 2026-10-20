import * as React from "react"
import { motion } from "motion/react"
import { CheckIcon, Loader2Icon, ServerIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { springSoft } from "@/lib/motion"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { NumberTicker } from "@/components/ds/number-ticker"
import { Segmented, SegmentedItem } from "@/components/ds/segmented"
import { Stat, StatLabel, StatMeta, StatUnit, StatValue } from "@/components/ds/stat"
import { StatusBadge, StatusDot } from "@/components/ds/status"
import { TickMeter } from "@/components/ds/tick-meter"
import {
  Widget,
  WidgetActions,
  WidgetFooter,
  WidgetHeader,
  WidgetMeta,
  WidgetPanel,
  WidgetSectionTitle,
  WidgetTitle,
} from "@/components/ds/widget"

// Fleet health: tokens served, fleet-level meters and a GPU heatmap.
// Hover a GPU for its details, click a node to focus it, Rebalance evens
// the load out. Simulated client-side, ticking every 1.6 s.

const TICK = 1600
const HOT = 84
const POWER_CAP = 52

type Mode = "util" | "memory" | "temp"
type Gpu = {
  util: number
  mem: number
  temp: number
  watts: number
  job: string
  state: "busy" | "idle" | "draining"
  /** Extra degrees over what the load explains (bad airflow, failing fan). */
  heat?: number
}

const tempFor = (g: Pick<Gpu, "util" | "heat">) => 44 + g.util * 40 + (g.heat ?? 0)
type Node = { id: string; kind: "H100" | "B200"; memTotal: number; gpus: Gpu[] }

const JOBS = ["lumen-70b-instruct · TP4", "quill-embed-v2", "atlas-8b · batch", "lumen-70b-instruct · TP4", "rerank-xl"]

const CLUSTERS = {
  "kestrel-iad-3": { city: "Ashburn", seed: 1 },
  "kestrel-fra-1": { city: "Frankfurt", seed: 2 },
  "kestrel-sin-2": { city: "Singapore", seed: 3 },
} as const
type ClusterId = keyof typeof CLUSTERS

function rand(seed: number) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function makeFleet(seed: number): Node[] {
  const r = rand(seed)
  const base = [0.79, 0.75, 0.89, 0.62, 0.69, 0.84, 0.8, 0.58]
  return base.map((b, n) => {
    const kind: Node["kind"] = n < 5 ? "H100" : "B200"
    const memTotal = kind === "H100" ? 80 : 192
    const gpus: Gpu[] = Array.from({ length: 8 }, () => {
      const util = Math.min(0.99, Math.max(0.3, b + (r() - 0.5) * 0.2))
      return {
        util,
        mem: memTotal * Math.min(0.97, util * (0.7 + r() * 0.35)),
        temp: 44 + util * 40 + r() * 2,
        watts: 180 + util * 480,
        job: JOBS[Math.floor(r() * JOBS.length)],
        state: "busy",
      }
    })
    return { id: `ks-${n < 5 ? "a" : "b"}0${n < 5 ? n + 1 : n - 4}`, kind, memTotal, gpus }
  }).map((node, n) => {
    // A few fixed situations so every state is on screen.
    if (n === 2) node.gpus[7] = { ...node.gpus[7], util: 0.95, heat: 7, temp: tempFor({ util: 0.95, heat: 7 }), watts: 690 }
    if (n === 3) {
      node.gpus[6] = { ...node.gpus[6], util: 0, mem: 0, temp: 31, watts: 60, job: "Draining", state: "draining" }
      node.gpus[7] = { ...node.gpus[7], util: 0.02, mem: 0.8, temp: 35, watts: 99, job: "Idle · warm spare", state: "idle" }
    }
    if (n === 7) node.gpus[7] = { ...node.gpus[7], util: 0.02, mem: 0.6, temp: 34, watts: 95, job: "Idle · warm spare", state: "idle" }
    return node
  })
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
const jitter = (v: number, amount: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v + (Math.random() - 0.5) * amount))

function useFleet(initial: ClusterId) {
  const [nodes, setNodes] = React.useState(() => makeFleet(CLUSTERS[initial].seed))
  const [tokens, setTokens] = React.useState(() => Array.from({ length: 40 }, (_, i) => 1_850_000 + Math.sin(i / 4) * 30_000 + i * 900))
  const [queue, setQueue] = React.useState(91)

  React.useEffect(() => {
    const t = window.setInterval(() => {
      setNodes((list) =>
        list.map((node) => ({
          ...node,
          gpus: node.gpus.map((g) => {
            if (g.state !== "busy") return g
            const util = jitter(g.util, 0.06, 0.25, 0.99)
            return { ...g, util, temp: jitter(tempFor({ util, heat: g.heat }), 1.5, 30, 95), watts: 180 + util * 480, mem: jitter(g.mem, node.memTotal * 0.03, 0, node.memTotal * 0.97) }
          }),
        }))
      )
      setTokens((xs) => [...xs.slice(1), jitter(xs.at(-1)!, 60_000, 1_780_000, 1_960_000)])
      setQueue((q) => Math.round(jitter(q, 10, 40, 160)))
    }, TICK)
    return () => window.clearInterval(t)
  }, [])

  return { nodes, setNodes, tokens, queue }
}

export function FleetHealth() {
  const [cluster, setCluster] = React.useState<ClusterId>("kestrel-iad-3")
  const [mode, setMode] = React.useState<Mode>("util")
  const [focused, setFocused] = React.useState<string | null>(null)
  const [balancing, setBalancing] = React.useState(false)
  const [justBalanced, setJustBalanced] = React.useState(false)
  const { nodes, setNodes, tokens, queue } = useFleet(cluster)

  const all = nodes.flatMap((n) => n.gpus)
  const active = all.filter((g) => g.state === "busy")
  const fleetUtil = avg(active.map((g) => g.util))
  const power = all.reduce((s, g) => s + g.watts, 0) / 1000
  const now = tokens.at(-1)!
  const delta = now / tokens[0] - 1
  const hot = all.filter((g) => g.temp >= HOT).length
  const draining = all.filter((g) => g.state === "draining").length
  const nodeUtils = nodes.map((n) => avg(n.gpus.filter((g) => g.state === "busy").map((g) => g.util)))
  const spread = Math.max(...nodeUtils) - Math.min(...nodeUtils)

  function rebalance() {
    setBalancing(true)
    const target = fleetUtil
    window.setTimeout(() => {
      setNodes((list) =>
        list.map((node) => ({
          ...node,
          gpus: node.gpus.map((g) =>
            g.state !== "busy" ? g : { ...g, util: jitter(target, 0.04, 0.3, 0.95), temp: tempFor({ util: target, heat: g.heat }), watts: 180 + target * 480 }
          ),
        }))
      )
      setBalancing(false)
      setJustBalanced(true)
      window.setTimeout(() => setJustBalanced(false), 1800)
    }, 1100)
  }

  return (
    <Widget className="max-w-[560px]">
      <WidgetHeader>
        <WidgetTitle>Fleet health</WidgetTitle>
        <WidgetActions>
          <Select
            value={cluster}
            onValueChange={(v) => {
              if (!v) return
              setCluster(v as ClusterId)
              setNodes(makeFleet(CLUSTERS[v as ClusterId].seed))
              setFocused(null)
            }}
          >
            <SelectTrigger aria-label="Cluster">
              <ServerIcon className="text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false}>
              {(Object.keys(CLUSTERS) as ClusterId[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </WidgetActions>
      </WidgetHeader>

      <WidgetPanel className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <Stat>
            <StatLabel>Tokens served / s</StatLabel>
            <StatValue>
              <NumberTicker value={now} />
              <StatusBadge tone={delta >= 0 ? "success" : "neutral"} dot={false} className="self-center">
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(1)}%
              </StatusBadge>
            </StatValue>
            <StatMeta>vs 64 s ago · TTFT p50 218 ms · 5 models</StatMeta>
          </Stat>
          <Sparkline values={tokens} className="mt-4 h-12 w-40 shrink-0" />
        </div>

        <div className="grid grid-cols-3 gap-6 border-t border-dashed border-border pt-5">
          <Meter label="Fleet util" value={`${Math.round(fleetUtil * 100)}`} unit="%" ratio={fleetUtil} />
          <Meter label="Queue depth" value={`${queue}`} unit="req" ratio={queue / 300} />
          <Meter label="Power" value={power.toFixed(1)} unit={`/ ${POWER_CAP} kW`} ratio={power / POWER_CAP} />
        </div>
      </WidgetPanel>

      <WidgetPanel className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <WidgetSectionTitle>
              GPUs <span className="text-muted-foreground">· {all.length}</span>
            </WidgetSectionTitle>
            <span className="eyebrow text-muted-foreground">
              {nodes.length} nodes
              {hot > 0 ? ` · ${hot} running hot` : " · all within limits"}
              {draining > 0 && ` · ${draining} draining`}
            </span>
          </div>
          <Segmented value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <SegmentedItem value="util">Util</SegmentedItem>
            <SegmentedItem value="memory">Memory</SegmentedItem>
            <SegmentedItem value="temp">Temp</SegmentedItem>
          </Segmented>
        </div>

        <Heatmap nodes={nodes} mode={mode} focused={focused} onFocus={(id) => setFocused((f) => (f === id ? null : id))} />
      </WidgetPanel>

      <WidgetFooter>
        <WidgetMeta className="flex items-center gap-2">
          <StatusDot tone="success" pulse />
          Live · every {TICK / 1000} s · {CLUSTERS[cluster].city}
        </WidgetMeta>
        <Button
          variant="brand"
          className="ml-auto min-w-32"
          disabled={balancing || (spread < 0.08 && !justBalanced)}
          onClick={rebalance}
        >
          {balancing ? <Loader2Icon className="animate-spin" /> : justBalanced ? <CheckIcon /> : null}
          {balancing ? "Rebalancing" : justBalanced ? "Balanced" : "Rebalance"}
        </Button>
      </WidgetFooter>
    </Widget>
  )
}

function Meter({ label, value, unit, ratio }: { label: string; value: string; unit: string; ratio: number }) {
  return (
    <Stat className="gap-2">
      <StatLabel>{label}</StatLabel>
      <StatValue size="sm">
        <span className="tabular-nums">{value}</span>
        <StatUnit className="text-sm">{unit}</StatUnit>
      </StatValue>
      <TickMeter value={ratio} ticks={24} />
    </Stat>
  )
}

/** A live line with a soft area, last point marked. */
function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const id = React.useId()
  const w = 160
  const h = 48
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const x = (i: number) => (i / (values.length - 1)) * (w - 4)
  const y = (v: number) => 4 + (1 - (v - lo) / (hi - lo || 1)) * (h - 10)
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const mean = y(avg(values))

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--chart-1)" stopOpacity="0.18" />
            <stop offset="1" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={0} x2={w - 4} y1={mean} y2={mean} stroke="var(--border)" strokeDasharray="2 3" />
        <path d={`${line} L${x(values.length - 1)},${h} L0,${h} Z`} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth={1.5} strokeLinejoin="round" />
        <circle cx={x(values.length - 1)} cy={y(values.at(-1)!)} r={2.5} fill="var(--chart-1)" />
      </svg>
      <span className="eyebrow text-muted-foreground">Last {Math.round((values.length * TICK) / 1000)} s</span>
    </div>
  )
}

const SCALE: Record<Mode, { value: (g: Gpu, n: Node) => number; lo: string; hi: string }> = {
  util: { value: (g) => g.util, lo: "0%", hi: "100%" },
  memory: { value: (g, n) => g.mem / n.memTotal, lo: "0%", hi: "100%" },
  temp: { value: (g) => (g.temp - 30) / 60, lo: "30°C", hi: "90°C" },
}

function Heatmap({
  nodes,
  mode,
  focused,
  onFocus,
}: {
  nodes: Node[]
  mode: Mode
  focused: string | null
  onFocus: (id: string) => void
}) {
  const scale = SCALE[mode]
  return (
    <div className="flex flex-col gap-1.5">
      {nodes.map((node) => {
        const values = node.gpus.filter((g) => g.state === "busy").map((g) => scale.value(g, node))
        const dim = focused !== null && focused !== node.id
        return (
          <div
            key={node.id}
            className={cn(
              "grid grid-cols-[96px_1fr_40px] items-center gap-3 transition-opacity duration-200",
              dim && "opacity-35"
            )}
          >
            <button
              type="button"
              onClick={() => onFocus(node.id)}
              aria-pressed={focused === node.id}
              className="flex items-baseline gap-2 rounded-md text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <span className={cn(focused === node.id && "underline decoration-foreground/30 underline-offset-4")}>{node.id}</span>
              <span className="eyebrow text-faint-foreground">{node.kind}</span>
            </button>
            <div className="grid grid-cols-8 gap-1">
              {node.gpus.map((g, i) => (
                <GpuCell key={i} gpu={g} node={node} index={i} value={scale.value(g, node)} />
              ))}
            </div>
            <span className="text-right text-sm text-muted-foreground tabular-nums">
              {mode === "temp"
                ? `${Math.round(avg(node.gpus.filter((g) => g.state === "busy").map((g) => g.temp)))}°`
                : `${Math.round(avg(values) * 100)}%`}
            </span>
          </div>
        )
      })}

      <div className="mt-2 flex items-center justify-end gap-2">
        <span className="eyebrow text-faint-foreground">{scale.lo}</span>
        <div className="flex h-2 w-32 gap-px">
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className="flex-1 rounded-[1px]" style={{ background: cellColor(i / 15) }} />
          ))}
        </div>
        <span className="eyebrow text-faint-foreground">{scale.hi}</span>
      </div>
    </div>
  )
}

/** Sequential scale on a single chart hue, from the muted surface up. */
function cellColor(v: number) {
  const pct = Math.round(12 + Math.min(1, Math.max(0, v)) * 88)
  return `color-mix(in oklch, var(--chart-1) ${pct}%, var(--muted))`
}

function GpuCell({ gpu, node, index, value }: { gpu: Gpu; node: Node; index: number; value: number }) {
  const draining = gpu.state === "draining"
  return (
    <Tooltip>
      <TooltipTrigger
        delay={0}
        closeDelay={0}
        render={
          <motion.div
            className={cn(
              "relative h-6 rounded-md outline-none ring-foreground transition-shadow hover:ring-2 hover:ring-offset-1 hover:ring-offset-card",
              draining &&
                "bg-[repeating-linear-gradient(135deg,var(--border)_0_2px,transparent_2px_6px)] ring-1 ring-border hover:ring-foreground"
            )}
            animate={draining ? undefined : { backgroundColor: cellColor(value) }}
            transition={springSoft}
          />
        }
      >
        {gpu.temp >= HOT && (
          <span className="absolute top-1 right-1 size-1.5 rounded-full bg-warning ring-2 ring-card" />
        )}
      </TooltipTrigger>
      <TooltipContent className="flex w-56 max-w-none flex-col items-stretch gap-1 py-2.5">
        <span className="flex justify-between">
          <span>
            {node.id} · GPU {index}
          </span>
          <span className="opacity-60">{node.kind}</span>
        </span>
        <span className="mt-1 flex flex-col gap-0.5 tabular-nums">
          <Row k="Utilization" v={`${Math.round(gpu.util * 100)}%`} />
          <Row k="Memory" v={`${gpu.mem.toFixed(1)} / ${node.memTotal} GB`} />
          <Row k="Temperature" v={`${Math.round(gpu.temp)}°C`} />
          <Row k="Power" v={`${Math.round(gpu.watts)} W`} />
          <Row k="Job" v={gpu.job} />
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <span className="flex justify-between gap-4">
      <span className="opacity-60">{k}</span>
      <span className="truncate">{v}</span>
    </span>
  )
}
