import * as React from "react"
import { motion } from "motion/react"
import { CheckIcon, Loader2Icon, ServerIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { easeOut, springSoft } from "@/lib/motion"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { NumberTicker } from "@/components/ds/number-ticker"
import { Segmented, SegmentedItem } from "@/components/ds/segmented"
import {
  Stat,
  StatLabel,
  StatMeta,
  StatUnit,
  StatValue,
} from "@/components/ds/stat"
import {
  Widget,
  WidgetActions,
  WidgetFooter,
  WidgetHeader,
  WidgetMeta,
  WidgetPanel,
  WidgetTitle,
} from "@/components/ds/widget"

type Policy = "cost" | "balanced" | "quality"

const MODELS = [
  { id: "opus", name: "Opus 5.5", provider: "Anthropic", color: "var(--chart-1)", p50: 0.84, p95: 2.16, price: 0.0126, errors: 0.42 },
  { id: "sol", name: "GPT-6.1 Sol", provider: "OpenAI", color: "var(--chart-2)", p50: 0.51, p95: 1.34, price: 0.0048, errors: 0.27 },
  { id: "haiku", name: "Haiku 4.5", provider: "Anthropic", color: "var(--chart-3)", p50: 0.23, p95: 0.64, price: 0.0007, errors: 0.61 },
  { id: "qwen", name: "Qwen3.5 9B", provider: "Self-hosted", color: "var(--chart-4)", p50: 0.38, p95: 1.09, price: 0.0019, errors: 1.08 },
] as const

type ModelId = (typeof MODELS)[number]["id"]

const SHARES: Record<Policy, Record<ModelId, number>> = {
  cost: { opus: 9, sol: 24, haiku: 44, qwen: 23 },
  balanced: { opus: 41, sol: 35, haiku: 16, qwen: 8 },
  quality: { opus: 63, sol: 27, haiku: 6, qwen: 4 },
}

const TOTAL_RPS = 334

export function ModelRouter() {
  const [policy, setPolicy] = React.useState<Policy>("balanced")
  const [deployed, setDeployed] = React.useState<Policy>("balanced")
  const [version, setVersion] = React.useState(14)
  const [deploying, setDeploying] = React.useState(false)
  const [justDeployed, setJustDeployed] = React.useState(false)
  const [hovered, setHovered] = React.useState<ModelId | null>(null)
  const [fallback, setFallback] = React.useState(true)
  const [env, setEnv] = React.useState("chat-prod")

  const shares = SHARES[policy]
  const blended = MODELS.reduce((sum, m) => sum + (shares[m.id] / 100) * m.price, 0)
  const p95 = MODELS.reduce((sum, m) => sum + (shares[m.id] / 100) * m.p95, 0)
  const errors = MODELS.reduce((sum, m) => sum + (shares[m.id] / 100) * m.errors, 0)
  const dirty = policy !== deployed

  function deploy() {
    setDeploying(true)
    window.setTimeout(() => {
      setDeploying(false)
      setDeployed(policy)
      setVersion((v) => v + 1)
      setJustDeployed(true)
      window.setTimeout(() => setJustDeployed(false), 1800)
    }, 900)
  }

  return (
    <Widget className="max-w-[560px]">
      <WidgetHeader>
        <WidgetTitle>Model router</WidgetTitle>
        <WidgetActions>
          <Select value={env} onValueChange={(v) => v && setEnv(v)}>
            <SelectTrigger>
              <ServerIcon className="text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="chat-prod">chat-prod</SelectItem>
              <SelectItem value="chat-staging">chat-staging</SelectItem>
              <SelectItem value="batch-eu">batch-eu</SelectItem>
            </SelectContent>
          </Select>
        </WidgetActions>
      </WidgetHeader>

      <WidgetPanel className="relative flex flex-col gap-5">
        <div className="flex">
          <Stat>
            <StatLabel>
              Blended cost ·{" "}
              <motion.span
                key={dirty ? "draft" : "live"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={easeOut}
                className={dirty ? "text-attention" : undefined}
              >
                {dirty ? "Draft policy" : "Live policy"}
              </motion.span>
            </StatLabel>
            <StatValue>
              <NumberTicker value={blended} format={(v) => `$${v.toFixed(4)}`} />
              <StatUnit>/ 1K tokens</StatUnit>
            </StatValue>
            <StatMeta>
              {TOTAL_RPS} req/s · p95{" "}
              <NumberTicker value={p95} format={(v) => v.toFixed(2)} /> s ·{" "}
              <NumberTicker value={errors} format={(v) => `${v.toFixed(2)}%`} />{" "}
              errors
            </StatMeta>
          </Stat>
          <Segmented className="absolute top-5 right-5" value={policy} onValueChange={(v) => setPolicy(v as Policy)}>
            <SegmentedItem value="cost">Cost</SegmentedItem>
            <SegmentedItem value="balanced">Balanced</SegmentedItem>
            <SegmentedItem value="quality">Quality</SegmentedItem>
          </Segmented>
        </div>

        <RouteFlow shares={shares} hovered={hovered} onHover={setHovered} />
      </WidgetPanel>

      <WidgetPanel className="flex flex-col pt-3">
        <div className="grid grid-cols-[1fr_76px_76px_60px_48px] items-center gap-x-2 pb-2">
          <span className="text-[15px] tracking-[-0.01em]">Routes</span>
          <span className="eyebrow text-right whitespace-nowrap text-muted-foreground">Share</span>
          <span className="eyebrow text-right whitespace-nowrap text-muted-foreground">p50/p95 s</span>
          <span className="eyebrow text-right whitespace-nowrap text-muted-foreground">$ / 1K</span>
          <span className="eyebrow text-right whitespace-nowrap text-muted-foreground">Errors</span>
        </div>

        {MODELS.map((m) => (
          <div
            key={m.id}
            onMouseEnter={() => setHovered(m.id)}
            onMouseLeave={() => setHovered(null)}
            className={cn(
              "-mx-2 grid grid-cols-[1fr_76px_76px_60px_48px] items-center gap-x-2 rounded-lg border-t border-border/70 px-2 py-2.5 text-sm transition-[opacity,background-color] duration-200 first-of-type:border-t-0 hover:bg-muted/70",
              hovered && hovered !== m.id && "opacity-45"
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: m.color }} />
              <span className="truncate">{m.name}</span>
              <span className="eyebrow truncate text-[10px] text-faint-foreground">{m.provider}</span>
            </span>
            <span className="flex items-center justify-end gap-2">
              <span className="h-1 w-6 overflow-hidden rounded-full bg-muted">
                <motion.span
                  className="block h-full rounded-full"
                  style={{ background: m.color }}
                  animate={{ width: `${shares[m.id]}%` }}
                  transition={springSoft}
                />
              </span>
              <NumberTicker value={shares[m.id]} format={(v) => `${Math.round(v)}%`} className="w-8 text-right" />
            </span>
            <span className="text-right text-muted-foreground tabular-nums">
              {m.p50.toFixed(2)} / {m.p95.toFixed(2)}
            </span>
            <span className="text-right tabular-nums">${m.price.toFixed(4)}</span>
            <span className="text-right text-muted-foreground tabular-nums">{m.errors.toFixed(2)}%</span>
          </div>
        ))}

        <div className="mt-1 flex items-center gap-1.5 border-t border-border/70 pt-3 text-sm">
          <Switch
            checked={fallback}
            onCheckedChange={setFallback}
            className="data-checked:border-brand data-checked:bg-brand"
          />
          <span>Fallback</span>
          <span className={cn("text-muted-foreground transition-opacity", !fallback && "opacity-40")}>if</span>
          <ModelSelect defaultValue="opus" disabled={!fallback} />
          <span className={cn("text-muted-foreground transition-opacity", !fallback && "opacity-40")}>fails, retry on</span>
          <ModelSelect defaultValue="sol" disabled={!fallback} />
        </div>
      </WidgetPanel>

      <WidgetFooter>
        <WidgetMeta>
          Policy v{version} · live on {env}
        </WidgetMeta>
        <Button
          variant="brand"
          className="ml-auto min-w-28"
          disabled={!dirty || deploying}
          onClick={deploy}
        >
          {deploying ? (
            <Loader2Icon className="animate-spin" />
          ) : justDeployed ? (
            <CheckIcon />
          ) : null}
          {deploying ? "Deploying" : justDeployed ? "Deployed" : "Deploy policy"}
        </Button>
      </WidgetFooter>
    </Widget>
  )
}

function ModelSelect({
  defaultValue,
  disabled,
}: {
  defaultValue: ModelId
  disabled?: boolean
}) {
  return (
    <Select defaultValue={defaultValue} disabled={disabled}>
      <SelectTrigger size="sm" className="px-2.5">
        <SelectValue>
          {(value: ModelId) => {
            const m = MODELS.find((x) => x.id === value)!
            return (
              <>
                <span className="size-2 rounded-full" style={{ background: m.color }} />
                {m.name}
              </>
            )
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {MODELS.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            <span className="size-2 rounded-full" style={{ background: m.color }} />
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/* ---------- Flow: gateway fanning out to models, particles ∝ share ---------- */

const ROW_H = 34
const LABEL_W = 132

function RouteFlow({
  shares,
  hovered,
  onHover,
}: {
  shares: Record<ModelId, number>
  hovered: ModelId | null
  onHover: (id: ModelId | null) => void
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(320)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const height = ROW_H * MODELS.length
  const originY = height / 2
  const endX = width - 6
  const forkX = Math.min(70, width * 0.2)
  const bendX = forkX + Math.min(90, width * 0.28)

  return (
    <div className="flex items-stretch gap-3">
      <div ref={ref} className="relative min-w-0 flex-1">
        <span
          className="eyebrow absolute left-0 text-muted-foreground"
          style={{ top: (ROW_H * MODELS.length) / 2 - 26 }}
        >
          Gateway
        </span>
        <svg width={width} height={height} className="overflow-visible">
          {MODELS.map((m, i) => {
            const y = ROW_H * i + ROW_H / 2
            const d = `M 6 ${originY} L ${forkX} ${originY} C ${(forkX + bendX) / 2} ${originY}, ${(forkX + bendX) / 2} ${y}, ${bendX} ${y} L ${endX} ${y}`
            const dim = hovered !== null && hovered !== m.id
            const count = Math.max(1, Math.round(shares[m.id] / 4))
            return (
              <g
                key={m.id}
                style={{ opacity: dim ? 0.25 : 1, transition: "opacity 200ms" }}
              >
                <path d={d} fill="none" stroke={m.color} strokeOpacity={0.14} strokeWidth={6} strokeLinecap="round" />
                <path d={d} fill="none" stroke={m.color} strokeOpacity={0.35} strokeWidth={1.25} />
                {Array.from({ length: count }).map((_, k) => (
                  <circle key={`${count}-${k}`} r={2.25} fill={m.color}>
                    <animateMotion
                      dur={`${2.6 - shares[m.id] / 100}s`}
                      begin={`${-(k / count) * 2.6}s`}
                      repeatCount="indefinite"
                      path={d}
                    />
                  </circle>
                ))}
                <circle cx={endX} cy={y} r={4} fill={m.color} />
              </g>
            )
          })}
          <circle cx={6} cy={originY} r={4.5} className="fill-card stroke-muted-foreground" strokeWidth={1.5} />
        </svg>
      </div>
      <div className="flex flex-col" style={{ width: LABEL_W }}>
        {MODELS.map((m) => (
          <div
            key={m.id}
            onMouseEnter={() => onHover(m.id)}
            onMouseLeave={() => onHover(null)}
            className={cn(
              "flex items-center justify-between gap-2 text-sm transition-opacity duration-200",
              hovered && hovered !== m.id && "opacity-40"
            )}
            style={{ height: ROW_H }}
          >
            <span className="truncate">{m.name}</span>
            <span className="eyebrow text-muted-foreground">
              <NumberTicker value={(shares[m.id] / 100) * TOTAL_RPS} />
              /s
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
