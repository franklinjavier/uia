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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { NumberTicker } from "@/components/ds/number-ticker"
import { Segmented, SegmentedItem } from "@/components/ds/segmented"
import { Sparkline } from "@/components/ds/sparkline"
import {
  Stat,
  StatLabel,
  StatMeta,
  StatUnit,
  StatValue,
} from "@/components/ds/stat"
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

// FleetHealth: tokens served (a sparkline over the sampled window), three
// fleet meters (util, queue, power) and a GPU heatmap by node, switchable
// between util, memory and temperature. Hover a GPU for its details, click a
// node to focus it. Pure view: pass the latest sample in (from your
// telemetry, a tool's output, a fixture) and re-render as it changes; it
// keeps only UI state (view mode, focused node, the Rebalance button's
// pending/done feedback).
//
//   <FleetHealth nodes={nodes} tokens={tokensPerSecond} queue={91}
//     powerCap={52} interval={1600} onRebalance={rebalance} />
//
// Several clusters add a cluster picker; switching one is the caller's job
// (load that cluster's nodes). Rebalance never touches the data: it calls
// `onRebalance`, shows a pending state while its promise runs (or while
// `rebalancing` is true), then a short "Balanced".

export type FleetHealthMode = "util" | "memory" | "temp"

export type FleetGpu = {
  /** Utilization, 0–1. */
  util: number
  /** Memory in use, GB. */
  mem: number
  /** °C. */
  temp: number
  watts: number
  /** What it runs ("lumen-70b · TP4", "Idle · warm spare"). */
  job: string
  state: "busy" | "idle" | "draining"
}

export type FleetNode = {
  id: string
  /** GPU model ("H100"). */
  kind: string
  /** Memory per GPU, GB. */
  memTotal: number
  gpus: FleetGpu[]
}

export type FleetCluster = {
  id: string
  /** Shown in the picker; defaults to the id. */
  label?: string
  /** Where it runs, shown in the footer ("Ashburn"). */
  location?: string
}

export type FleetHealthProps = {
  nodes: FleetNode[]
  /** Tokens served per second, oldest first; the last one is now. */
  tokens: number[]
  /** Requests waiting. */
  queue: number
  /** Queue depth that fills its meter. Default 300. */
  queueMax?: number
  /** Fleet power cap, kW. */
  powerCap: number
  /** Ms between samples; sizes the window and the "Live" footer. */
  interval?: number
  /** Extra facts after "vs N s ago" ("TTFT p50 218 ms · 5 models"). */
  tokensMeta?: React.ReactNode
  /** Temperature (°C) from which a GPU is flagged hot. Default 84. */
  hotAt?: number
  /** Node util spread (0–1) under which Rebalance is off. Default 0.08. */
  balancedAt?: number
  clusters?: FleetCluster[]
  /** Controlled cluster id; otherwise the first cluster. */
  cluster?: string
  onClusterChange?: (id: string) => void
  /** Controlled view mode; otherwise "util". */
  mode?: FleetHealthMode
  onModeChange?: (mode: FleetHealthMode) => void
  /** Evens the load out; a returned promise keeps the button pending. */
  onRebalance?: () => void | Promise<void>
  /** Controlled pending state for Rebalance. */
  rebalancing?: boolean
  /** Shows the pulsing live dot. Default true. */
  live?: boolean
  title?: React.ReactNode
  className?: string
}

const avg = (xs: number[]) =>
  xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)

export function FleetHealth({
  nodes,
  tokens,
  queue,
  queueMax = 300,
  powerCap: POWER_CAP,
  interval,
  tokensMeta,
  hotAt: HOT = 84,
  balancedAt = 0.08,
  clusters = [],
  cluster,
  onClusterChange,
  mode: modeIn,
  onModeChange,
  onRebalance,
  rebalancing,
  live = true,
  title = "Fleet health",
  className,
}: FleetHealthProps) {
  const [ownCluster, setOwnCluster] = React.useState(clusters[0]?.id)
  const clusterId = cluster ?? ownCluster
  const [ownMode, setOwnMode] = React.useState<FleetHealthMode>("util")
  const mode = modeIn ?? ownMode
  const setMode = (m: FleetHealthMode) =>
    onModeChange ? onModeChange(m) : setOwnMode(m)
  const [focused, setFocused] = React.useState<string | null>(null)

  // Rebalance feedback: pending while the caller works, then "Balanced".
  const [ownPending, setOwnPending] = React.useState(false)
  const balancing = rebalancing ?? ownPending
  const [justBalanced, setJustBalanced] = React.useState(false)
  const [wasBalancing, setWasBalancing] = React.useState(balancing)
  if (wasBalancing !== balancing) {
    setWasBalancing(balancing)
    if (!balancing) setJustBalanced(true)
  }
  React.useEffect(() => {
    if (!justBalanced) return
    const t = window.setTimeout(() => setJustBalanced(false), 1800)
    return () => window.clearTimeout(t)
  }, [justBalanced])

  async function rebalance() {
    const result = onRebalance?.()
    if (!result) return
    setOwnPending(true)
    try {
      await result
    } finally {
      setOwnPending(false)
    }
  }

  const all = nodes.flatMap((n) => n.gpus)
  const active = all.filter((g) => g.state === "busy")
  const fleetUtil = avg(active.map((g) => g.util))
  const power = all.reduce((s, g) => s + g.watts, 0) / 1000
  const now = tokens.at(-1) ?? 0
  const delta = tokens.length > 0 ? now / tokens[0] - 1 : 0
  const hot = all.filter((g) => g.temp >= HOT).length
  const draining = all.filter((g) => g.state === "draining").length
  const nodeUtils = nodes.map((n) =>
    avg(n.gpus.filter((g) => g.state === "busy").map((g) => g.util))
  )
  const spread = Math.max(...nodeUtils) - Math.min(...nodeUtils)
  const span = interval
    ? `${Math.round((tokens.length * interval) / 1000)} s`
    : null
  const location = clusters.find((c) => c.id === clusterId)?.location

  return (
    <Widget className={cn("max-w-[560px]", className)}>
      <WidgetHeader>
        <WidgetTitle>{title}</WidgetTitle>
        {clusters.length > 1 && (
          <WidgetActions>
            <Select
              value={clusterId}
              onValueChange={(v) => {
                if (!v) return
                setFocused(null)
                if (onClusterChange) onClusterChange(v)
                if (cluster === undefined) setOwnCluster(v)
              }}
            >
              <SelectTrigger aria-label="Cluster">
                <ServerIcon className="text-muted-foreground" />
                <SelectValue>
                  {(v: string) => clusters.find((c) => c.id === v)?.label ?? v}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" alignItemWithTrigger={false}>
                {clusters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label ?? c.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </WidgetActions>
        )}
      </WidgetHeader>

      <WidgetPanel className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <Stat>
            <StatLabel>Tokens served / s</StatLabel>
            <StatValue>
              <NumberTicker value={now} />
              <StatusBadge
                tone={delta >= 0 ? "success" : "neutral"}
                dot={false}
                className="self-center"
              >
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(1)}%
              </StatusBadge>
            </StatValue>
            <StatMeta>
              {[span && `vs ${span} ago`, tokensMeta]
                .filter(Boolean)
                .map((part, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && " · "}
                    {part}
                  </React.Fragment>
                ))}
            </StatMeta>
          </Stat>
          <div className="flex shrink-0 flex-col gap-1 sm:mt-4 sm:items-end">
            <Sparkline values={tokens} />
            {span && (
              <span className="eyebrow text-muted-foreground">Last {span}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 border-t border-dashed border-border pt-5 sm:gap-6">
          <Meter
            label="Fleet util"
            value={`${Math.round(fleetUtil * 100)}`}
            unit="%"
            ratio={fleetUtil}
          />
          <Meter
            label="Queue depth"
            value={`${queue}`}
            unit="req"
            ratio={queue / queueMax}
          />
          <Meter
            label="Power"
            value={power.toFixed(1)}
            unit={`/ ${POWER_CAP} kW`}
            ratio={power / POWER_CAP}
          />
        </div>
      </WidgetPanel>

      <WidgetPanel className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
          <Segmented
            value={mode}
            onValueChange={(v) => setMode(v as FleetHealthMode)}
          >
            <SegmentedItem value="util">Util</SegmentedItem>
            <SegmentedItem value="memory">Memory</SegmentedItem>
            <SegmentedItem value="temp">Temp</SegmentedItem>
          </Segmented>
        </div>

        <Heatmap
          nodes={nodes}
          mode={mode}
          hotAt={HOT}
          focused={focused}
          onFocus={(id) => setFocused((f) => (f === id ? null : id))}
        />
      </WidgetPanel>

      <WidgetFooter>
        <WidgetMeta className="flex items-center gap-2">
          <StatusDot tone={live ? "success" : "neutral"} pulse={live} />
          {[
            live ? "Live" : "Paused",
            interval && `every ${interval / 1000} s`,
            location,
          ]
            .filter(Boolean)
            .join(" · ")}
        </WidgetMeta>
        {onRebalance && (
          <Button
            variant="brand"
            className="ml-auto min-w-32"
            disabled={balancing || (spread < balancedAt && !justBalanced)}
            onClick={rebalance}
          >
            {balancing ? (
              <Loader2Icon className="animate-spin" />
            ) : justBalanced ? (
              <CheckIcon />
            ) : null}
            {balancing
              ? "Rebalancing"
              : justBalanced
                ? "Balanced"
                : "Rebalance"}
          </Button>
        )}
      </WidgetFooter>
    </Widget>
  )
}

function Meter({
  label,
  value,
  unit,
  ratio,
}: {
  label: string
  value: string
  unit: string
  ratio: number
}) {
  return (
    <Stat className="gap-2">
      <StatLabel>{label}</StatLabel>
      <StatValue size="sm">
        <span className="tabular-nums">{value}</span>
        <StatUnit className="text-sm">{unit}</StatUnit>
      </StatValue>
      <TickMeter value={ratio} ticks={24} className="text-chart-1" />
    </Stat>
  )
}

const SCALE: Record<
  FleetHealthMode,
  { value: (g: FleetGpu, n: FleetNode) => number; lo: string; hi: string }
> = {
  util: { value: (g) => g.util, lo: "0%", hi: "100%" },
  memory: { value: (g, n) => g.mem / n.memTotal, lo: "0%", hi: "100%" },
  temp: { value: (g) => (g.temp - 30) / 60, lo: "30°C", hi: "90°C" },
}

function Heatmap({
  nodes,
  mode,
  hotAt,
  focused,
  onFocus,
}: {
  nodes: FleetNode[]
  mode: FleetHealthMode
  hotAt: number
  focused: string | null
  onFocus: (id: string) => void
}) {
  const scale = SCALE[mode]
  return (
    <div className="flex flex-col gap-1.5">
      {nodes.map((node) => {
        const busy = node.gpus.filter((g) => g.state === "busy")
        const values = busy.map((g) => scale.value(g, node))
        const dim = focused !== null && focused !== node.id
        return (
          <div
            key={node.id}
            className={cn(
              "grid grid-cols-[52px_1fr_36px] items-center gap-2 transition-opacity duration-200 sm:grid-cols-[96px_1fr_40px] sm:gap-3",
              dim && "opacity-35"
            )}
          >
            <button
              type="button"
              onClick={() => onFocus(node.id)}
              aria-pressed={focused === node.id}
              className="flex items-baseline gap-2 rounded-md text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <span
                className={cn(
                  focused === node.id &&
                    "underline decoration-foreground/30 underline-offset-4"
                )}
              >
                {node.id}
              </span>
              <span className="eyebrow text-faint-foreground max-sm:hidden">
                {node.kind}
              </span>
            </button>
            <div className="grid grid-cols-8 gap-1">
              {node.gpus.map((g, i) => (
                <GpuCell
                  key={i}
                  gpu={g}
                  node={node}
                  index={i}
                  value={scale.value(g, node)}
                  hot={g.temp >= hotAt}
                />
              ))}
            </div>
            <span className="text-right text-sm text-muted-foreground tabular-nums">
              {mode === "temp"
                ? `${Math.round(avg(busy.map((g) => g.temp)))}°`
                : `${Math.round(avg(values) * 100)}%`}
            </span>
          </div>
        )
      })}

      <div className="mt-2 flex items-center justify-end gap-2">
        <span className="eyebrow text-faint-foreground">{scale.lo}</span>
        <div className="flex h-2 w-32 gap-px">
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              className="flex-1 rounded-[1px]"
              style={{ background: cellColor(i / 15) }}
            />
          ))}
        </div>
        <span className="eyebrow text-faint-foreground">{scale.hi}</span>
      </div>
    </div>
  )
}

/**
 * Sequential scale on a single chart hue, as opacity over the card: the
 * hue never drifts (mixing with grey turned the blue purple in dark).
 */
function cellColor(v: number) {
  const pct = Math.round(14 + Math.min(1, Math.max(0, v)) * 86)
  return `color-mix(in oklch, var(--chart-1) ${pct}%, transparent)`
}

function GpuCell({
  gpu,
  node,
  index,
  value,
  hot,
}: {
  gpu: FleetGpu
  node: FleetNode
  index: number
  value: number
  hot: boolean
}) {
  const draining = gpu.state === "draining"
  return (
    <Tooltip>
      <TooltipTrigger
        delay={0}
        closeDelay={0}
        render={
          <motion.div
            className={cn(
              "relative h-6 rounded-md ring-foreground transition-shadow outline-none hover:ring-2 hover:ring-offset-1 hover:ring-offset-card",
              draining &&
                "bg-[repeating-linear-gradient(135deg,var(--border)_0_2px,transparent_2px_6px)] ring-1 ring-border hover:ring-foreground"
            )}
            animate={
              draining ? undefined : { backgroundColor: cellColor(value) }
            }
            transition={springSoft}
          />
        }
      >
        {hot && (
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
