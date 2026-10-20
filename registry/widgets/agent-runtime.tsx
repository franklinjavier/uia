import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { ServerIcon, ZapIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { easeOut, enter } from "@/lib/motion"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NumberTicker } from "@/components/ds/number-ticker"
import { Stat, StatLabel, StatUnit, StatValue } from "@/components/ds/stat"
import { StatusBadge, StatusDot } from "@/components/ds/status"
import {
  Widget,
  WidgetActions,
  WidgetFooter,
  WidgetHeader,
  WidgetList,
  WidgetListHeader,
  WidgetListRow,
  WidgetMeta,
  WidgetPanel,
  WidgetSectionTitle,
  WidgetTitle,
} from "@/components/ds/widget"

// AgentRuntime: sandboxes that scale to zero, drawn as an isometric
// platform with one box per agent, plus the agent list and an Invoke
// action. Each agent stays warm for `idleTimeout` seconds after its last
// request, then sleeps; invoking a sleeping agent pays a cold start. Pure
// view: pass the agents, their states and the metrics in (from your
// runtime, a tool's output, a fixture) and handle `onInvoke`; it keeps only
// UI state (agent selected, row hovered, region picked).
//
//   <AgentRuntime agents={agents} idleTimeout={12} requests={413}
//     coldStarts={13} coldStartP50={170} onInvoke={invoke} />
//
// The widget never changes the agents itself: `onInvoke(id)` asks you to,
// and the next `agents` you pass shows the result. No `onInvoke` hides the
// button; no `regions` hides the region picker.

export type AgentRuntimeStatus = "running" | "starting" | "zero"
/** Where an agent's traffic comes from; each has a fixed tile on the scene. */
export type AgentRuntimeTrigger = "api" | "queue" | "cron" | "hook"

export type AgentRuntimeAgent = {
  id: string
  name: string
  /** One line under the name ("Python 3.12 · 1 GB · job queue"). */
  meta: string
  trigger: AgentRuntimeTrigger
  /** Centre of the agent's box on the 100 × 100 platform. */
  slot: [number, number]
  status: AgentRuntimeStatus
  /** Seconds left before a running agent scales to zero. */
  idle: number
  /** Cold starts this agent has paid. */
  coldStarts: number
  /** Duration of its last cold start, in ms. */
  startMs: number
}

export type AgentRuntimeProps = {
  agents: AgentRuntimeAgent[]
  /** Seconds a warm agent waits idle before scaling to zero. */
  idleTimeout: number
  /** Requests served (footer). */
  requests: number
  /** Cold starts across all agents (footer). */
  coldStarts: number
  /** Median cold start, in ms. */
  coldStartP50: number
  /** Asks to invoke an agent; omit to hide the Invoke button. */
  onInvoke?: (id: string) => void
  /** Controlled selected agent id; otherwise the first agent. */
  selected?: string
  onSelectedChange?: (id: string) => void
  /** Regions for the picker; omit to hide it. */
  regions?: readonly string[]
  /** Controlled region; otherwise the first region. */
  region?: string
  onRegionChange?: (region: string) => void
  /** Shows the pulsing "Live" dot in the footer. Default true. */
  live?: boolean
  title?: React.ReactNode
  className?: string
}

const COLS =
  "grid-cols-[minmax(0,1fr)_auto_84px] sm:grid-cols-[minmax(0,1fr)_auto_112px]"

export function AgentRuntime({
  agents,
  idleTimeout,
  requests,
  coldStarts,
  coldStartP50,
  onInvoke,
  selected: selectedIn,
  onSelectedChange,
  regions,
  region: regionIn,
  onRegionChange,
  live = true,
  title = "Agent runtime",
  className,
}: AgentRuntimeProps) {
  const [ownSelected, setOwnSelected] = React.useState(agents[0]?.id)
  const selectedId = selectedIn ?? ownSelected
  const setSelected = (id: string) =>
    onSelectedChange ? onSelectedChange(id) : setOwnSelected(id)
  const [ownRegion, setOwnRegion] = React.useState(regions?.[0])
  const region = regionIn ?? ownRegion
  const setRegion = (r: string) =>
    onRegionChange ? onRegionChange(r) : setOwnRegion(r)
  const [hovered, setHovered] = React.useState<string | null>(null)

  const current = agents.find((a) => a.id === selectedId) ?? agents[0]
  const selected = current?.id
  const warm = agents.filter((a) => a.status === "running").length

  return (
    <Widget className={cn("max-w-[560px]", className)}>
      <WidgetHeader>
        <WidgetTitle>{title}</WidgetTitle>
        {regions && regions.length > 0 && (
          <WidgetActions>
            <Select value={region} onValueChange={(v) => v && setRegion(v)}>
              <SelectTrigger aria-label="Region">
                <ServerIcon className="text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {regions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </WidgetActions>
        )}
      </WidgetHeader>

      <WidgetPanel className="relative flex flex-col gap-5">
        <Stat className="absolute top-5 left-5 z-10">
          <StatLabel>Sandboxes warm</StatLabel>
          <StatValue>
            <NumberTicker value={warm} />
            <StatUnit>/ {agents.length}</StatUnit>
          </StatValue>
        </Stat>

        {current && (
          <Sandboxes
            agents={agents}
            focused={hovered ?? current.id}
            onSelect={setSelected}
            onHover={setHovered}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="eyebrow text-muted-foreground">
            Cold start p50{" "}
            <span className="text-foreground tabular-nums">
              {coldStartP50} ms
            </span>
          </span>
          <span className="eyebrow text-muted-foreground">
            Zero after {idleTimeout}s idle
          </span>
        </div>
      </WidgetPanel>

      <WidgetPanel className="flex flex-col pt-3">
        <WidgetList onMouseLeave={() => setHovered(null)}>
          <WidgetListHeader className={COLS}>
            <WidgetSectionTitle>Agents</WidgetSectionTitle>
            <span className="text-right eyebrow text-muted-foreground">
              Status
            </span>
            <span className="text-right eyebrow text-muted-foreground">
              Scale
            </span>
          </WidgetListHeader>
          {agents.map((a) => (
            <WidgetListRow
              key={a.id}
              className={COLS}
              selected={a.id === selected}
              dimmed={hovered !== null && hovered !== a.id}
              onMouseEnter={() => setHovered(a.id)}
              onClick={() => setSelected(a.id)}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span>{a.name}</span>
                <span className="truncate eyebrow text-muted-foreground">
                  {a.meta}
                </span>
              </span>
              <span className="flex justify-end">
                <AgentBadge status={a.status} />
              </span>
              <span className="text-right eyebrow whitespace-nowrap text-muted-foreground">
                {a.status === "running" ? (
                  <>
                    Zero in <span className="tabular-nums">{a.idle}s</span>
                  </>
                ) : a.status === "starting" ? (
                  "Cold start"
                ) : (
                  <>
                    <span className="tabular-nums">{a.coldStarts}</span> cold
                    starts
                  </>
                )}
              </span>
            </WidgetListRow>
          ))}
        </WidgetList>
      </WidgetPanel>

      <WidgetFooter>
        <WidgetMeta className="flex items-center gap-2">
          {live && <StatusDot tone="success" pulse />}
          {live && "Live · "}
          <span className="tabular-nums">{requests}</span> req ·{" "}
          <span className="tabular-nums">{coldStarts}</span> cold
        </WidgetMeta>
        {onInvoke && current && (
          <Button
            variant="brand"
            className="ml-auto min-w-32"
            disabled={current.status === "starting"}
            onClick={() => onInvoke(current.id)}
          >
            <ZapIcon />
            Invoke {current.name}
          </Button>
        )}
      </WidgetFooter>
    </Widget>
  )
}

function AgentBadge({ status }: { status: AgentRuntimeStatus }) {
  if (status === "running")
    return <StatusBadge tone="success">Running</StatusBadge>
  if (status === "starting")
    return <StatusBadge tone="info">Starting</StatusBadge>
  return <StatusBadge tone="neutral">Zero</StatusBadge>
}

/* --------------------------- isometric scene --------------------------- */

// World units → screen: classic 2:1 isometric. Origin is the platform's
// back corner; x runs right-down, y left-down, z up.
const VB = { w: 400, h: 262 }
const O = { x: 200, y: 72 }
const U = 1.35

function p(x: number, y: number, z = 0): [number, number] {
  return [O.x + (x - y) * 0.866 * U, O.y + (x + y) * 0.5 * U - z * U]
}

function pts(...list: [number, number][]) {
  return list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
}

/** A box's three visible faces: top, right (x = x1) and front (y = y1). */
function Box({
  x,
  y,
  w,
  d,
  h,
  z = 0,
  className,
  top,
  side,
}: {
  x: number
  y: number
  w: number
  d: number
  h: number
  z?: number
  className?: string
  top: string
  side: string
}) {
  const [x0, y0, x1, y1, z1] = [x, y, x + w, y + d, z + h]
  return (
    <g className={className} strokeWidth={1} strokeLinejoin="round">
      <polygon
        points={pts(p(x0, y1, z), p(x1, y1, z), p(x1, y1, z1), p(x0, y1, z1))}
        fill={side}
      />
      <polygon
        points={pts(p(x1, y0, z), p(x1, y1, z), p(x1, y1, z1), p(x1, y0, z1))}
        fill={side}
        style={{ filter: "brightness(0.96)" }}
      />
      <polygon
        points={pts(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1))}
        fill={top}
      />
    </g>
  )
}

const TRIGGERS: Record<
  AgentRuntimeTrigger,
  { at: [number, number]; to: [number, number] }
> = {
  api: { at: [-50, -8], to: [0, 12] },
  queue: { at: [122, 8], to: [100, 25] },
  cron: { at: [-34, 108], to: [0, 82] },
  hook: { at: [122, 94], to: [100, 82] },
}

const TILE = 26
const SLAB = 6
const BOX = 26
const BOX_H = 12

function Sandboxes({
  agents,
  focused: selected,
  onSelect,
  onHover,
}: {
  agents: AgentRuntimeAgent[]
  /** The hovered agent, or the selected one. */
  focused: string
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}) {
  const current = agents.find((a) => a.id === selected)!
  // Draw back to front so nearer boxes overlap farther ones.
  const ordered = [...agents].sort(
    (a, b) => a.slot[0] + a.slot[1] - (b.slot[0] + b.slot[1])
  )
  const [cx, cy] = current.slot
  const anchor = p(cx, cy, SLAB + (current.status === "zero" ? 0 : BOX_H))
  // The label lives in the empty top-right corner; only the leader moves.
  const label: [number, number] = [292, 30]

  return (
    <div className="relative mx-auto mt-10 w-full max-w-[460px]">
      <svg
        viewBox={`0 0 ${VB.w} ${VB.h}`}
        className="block w-full overflow-visible text-muted-foreground"
        role="img"
        aria-label={`${agents.filter((a) => a.status === "running").length} of ${agents.length} sandboxes warm`}
      >
        {/* trigger tiles and their wires */}
        {(Object.keys(TRIGGERS) as AgentRuntimeTrigger[]).map((t) => {
          const { at, to } = TRIGGERS[t]
          const live = agents.some(
            (a) => a.trigger === t && a.status !== "zero"
          )
          return (
            <g key={t} stroke="currentColor">
              <line
                x1={p(at[0] + TILE / 2, at[1] + TILE / 2, 0)[0]}
                y1={p(at[0] + TILE / 2, at[1] + TILE / 2, 0)[1]}
                x2={p(to[0], to[1], 0)[0]}
                y2={p(to[0], to[1], 0)[1]}
                strokeDasharray="2 3"
                className={cn(
                  "transition-opacity duration-300",
                  live ? "opacity-70" : "opacity-30"
                )}
              />
              <Box
                x={at[0]}
                y={at[1]}
                w={TILE}
                d={TILE}
                h={4}
                top="var(--card)"
                side="var(--muted)"
              />
              <TileLabel at={at}>{t}</TileLabel>
            </g>
          )
        })}

        {/* platform with its shadow footprint */}
        <polygon
          points={pts(
            p(4, 4, -14),
            p(104, 4, -14),
            p(104, 104, -14),
            p(4, 104, -14)
          )}
          fill="none"
          stroke="currentColor"
          strokeDasharray="2 3"
          className="opacity-40"
        />
        <Box
          x={0}
          y={0}
          w={100}
          d={100}
          h={SLAB}
          top="var(--card)"
          side="var(--muted)"
          className="stroke-current"
        />
        {[25, 50, 75].map((v) => (
          <g
            key={v}
            className="opacity-25"
            stroke="currentColor"
            strokeDasharray="1 4"
          >
            <line
              x1={p(v, 0, SLAB)[0]}
              y1={p(v, 0, SLAB)[1]}
              x2={p(v, 100, SLAB)[0]}
              y2={p(v, 100, SLAB)[1]}
            />
            <line
              x1={p(0, v, SLAB)[0]}
              y1={p(0, v, SLAB)[1]}
              x2={p(100, v, SLAB)[0]}
              y2={p(100, v, SLAB)[1]}
            />
          </g>
        ))}

        {ordered.map((a, i) => (
          <React.Fragment key={a.id}>
            {i === 1 && <Gateway />}
            <Sandbox
              agent={a}
              selected={a.id === selected}
              onSelect={() => onSelect(a.id)}
              onHover={(on) => onHover(on ? a.id : null)}
            />
          </React.Fragment>
        ))}

        {/* callout from the selected sandbox */}
        <motion.polyline
          key={selected}
          points={pts(anchor, [label[0] - 10, label[1]], label)}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={1}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.6 }}
          transition={enter}
        />
      </svg>

      <div
        className="pointer-events-none absolute flex -translate-y-1/2 flex-col pl-1.5 font-mono text-xs"
        style={{
          left: `${(label[0] / VB.w) * 100}%`,
          top: `${(label[1] / VB.h) * 100}%`,
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`${selected}-${current.status}`}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={easeOut}
            className="flex flex-col"
          >
            {current.status === "zero" ? (
              <>
                <span className="text-foreground">asleep</span>
                <span className="text-muted-foreground">0 replicas</span>
              </>
            ) : current.status === "starting" ? (
              <>
                <span className="shimmer text-foreground">cold start…</span>
                <span className="text-muted-foreground">{current.name}</span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1 text-foreground">
                  <ZapIcon className="size-3" />
                  <span className="tabular-nums">{current.startMs}ms</span>
                </span>
                <span className="text-muted-foreground">startup</span>
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  )
}

function TileLabel({
  at,
  children,
}: {
  at: [number, number]
  children: string
}) {
  const [ox, oy] = p(at[0] + TILE / 2, at[1] + TILE / 2, 4)
  return (
    <text
      transform={`matrix(${0.866 * U} ${0.5 * U} ${-0.866 * U} ${0.5 * U} ${ox} ${oy})`}
      fontSize={6.5}
      letterSpacing={0.6}
      textAnchor="middle"
      dominantBaseline="central"
      className="fill-muted-foreground font-mono uppercase"
      stroke="none"
    >
      {children}
    </text>
  )
}

function Gateway() {
  const s = 5
  return (
    <polygon
      points={pts(
        p(50 - s, 50 - s, SLAB),
        p(50 + s, 50 - s, SLAB),
        p(50 + s, 50 + s, SLAB),
        p(50 - s, 50 + s, SLAB)
      )}
      fill="var(--foreground)"
      stroke="none"
    />
  )
}

function Sandbox({
  agent,
  selected,
  onSelect,
  onHover,
}: {
  agent: AgentRuntimeAgent
  selected: boolean
  onSelect: () => void
  onHover: (on: boolean) => void
}) {
  const [cx, cy] = agent.slot
  const x = cx - BOX / 2
  const y = cy - BOX / 2

  return (
    <g
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className="cursor-pointer"
    >
      <AnimatePresence initial={false}>
        {agent.status === "zero" ? (
          <motion.polygon
            key="slot"
            points={pts(
              p(x, y, SLAB),
              p(x + BOX, y, SLAB),
              p(x + BOX, y + BOX, SLAB),
              p(x, y + BOX, SLAB)
            )}
            fill="transparent"
            stroke={selected ? "var(--foreground)" : "currentColor"}
            strokeDasharray="3 3"
            initial={{ opacity: 0 }}
            animate={{ opacity: selected ? 0.9 : 0.5 }}
            exit={{ opacity: 0 }}
            transition={easeOut}
          />
        ) : (
          <motion.g
            key="box"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: agent.status === "starting" ? 0.6 : 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={enter}
            stroke={selected ? "var(--foreground)" : "currentColor"}
          >
            <Box
              x={x}
              y={y}
              w={BOX}
              d={BOX}
              h={BOX_H}
              z={SLAB}
              top={
                selected
                  ? "color-mix(in oklch, var(--foreground) 7%, var(--card))"
                  : "var(--card)"
              }
              side={
                selected
                  ? "color-mix(in oklch, var(--foreground) 14%, var(--card))"
                  : "var(--muted)"
              }
            />
            {/* live light on the box's front corner */}
            {agent.status === "running" && (
              <circle
                cx={p(x + BOX - 4, y + 4, SLAB + BOX_H)[0]}
                cy={p(x + BOX - 4, y + 4, SLAB + BOX_H)[1]}
                r={1.6}
                fill="var(--success)"
                stroke="none"
              />
            )}
          </motion.g>
        )}
      </AnimatePresence>
    </g>
  )
}
