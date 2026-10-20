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
import { StatusDot } from "@/components/ds/status"
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
  WidgetList,
  WidgetListHeader,
  WidgetListRow,
  WidgetMeta,
  WidgetPanel,
  WidgetSectionTitle,
  WidgetTitle,
} from "@/components/ds/widget"

// ModelRouter: a gateway's traffic split across models under a routing
// policy, the blended cost / p95 / errors that split implies, a fallback
// rule and a deploy action. Pure view: pass the data in (models, policies,
// traffic, the live policy); it keeps only UI state (row hovered) plus
// internal defaults for the controls the host may own instead (environment,
// draft policy, fallback). Deploying is the host's job: `onDeploy` gets the
// draft config, and `deployState` reflects the host's progress.
//
//   <ModelRouter models={models} policies={policies} livePolicy="balanced"
//     requestsPerSecond={334} onDeploy={(config) => save(config)} />
//
// Several environments add an environment picker; one hides it.

export type ModelRouterModel = {
  id: string
  name: string
  provider?: string
  /** A token colour (`var(--chart-1)`); defaults follow the chart palette. */
  color?: string
  /** Latency in seconds. */
  p50: number
  p95: number
  /** Price per 1K tokens. */
  price: number
  /** Error rate, percent. */
  errors: number
}

export type ModelRouterPolicy = {
  id: string
  label: string
  /** Traffic share (percent) per model id. */
  shares: Record<string, number>
}

export type ModelRouterFallback = {
  enabled: boolean
  /** Model id that, when it fails, triggers the retry. */
  from: string
  /** Model id the request is retried on. */
  to: string
}

export type ModelRouterConfig = {
  environment: string
  policy: string
  fallback: ModelRouterFallback
}

export type ModelRouterDeployState = "idle" | "deploying" | "deployed"

export type ModelRouterProps = {
  models: ModelRouterModel[]
  policies: ModelRouterPolicy[]
  /** Policy id currently live; the draft is "dirty" when it differs. */
  livePolicy: string
  /** Version of the live policy, shown in the footer. */
  version?: number
  /** Total gateway traffic, requests per second. */
  requestsPerSecond: number
  environments?: string[]
  /** Controlled environment; otherwise the first environment. */
  environment?: string
  onEnvironmentChange?: (environment: string) => void
  /** Controlled draft policy id; otherwise starts at `livePolicy`. */
  policy?: string
  onPolicyChange?: (policy: string) => void
  /** Controlled fallback rule; otherwise on, first model → second model. */
  fallback?: ModelRouterFallback
  onFallbackChange?: (fallback: ModelRouterFallback) => void
  /** Called with the draft config when Deploy is pressed. */
  onDeploy?: (config: ModelRouterConfig) => void
  /** Host-driven deploy progress. Default "idle". */
  deployState?: ModelRouterDeployState
  title?: React.ReactNode
  className?: string
}

type Model = ModelRouterModel & { color: string }

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--muted-foreground)",
]

// Mobile keeps share and price; latency and errors join from `sm`.
const COLS =
  "grid-cols-[minmax(0,1fr)_76px_60px] sm:grid-cols-[minmax(0,1fr)_76px_76px_60px_48px]"

export function ModelRouter({
  models: modelsIn,
  policies,
  livePolicy,
  version,
  requestsPerSecond,
  environments = [],
  environment,
  onEnvironmentChange,
  policy: policyIn,
  onPolicyChange,
  fallback: fallbackIn,
  onFallbackChange,
  onDeploy,
  deployState = "idle",
  title = "Model router",
  className,
}: ModelRouterProps) {
  const MODELS: Model[] = modelsIn.map((m, i) => ({
    ...m,
    color: m.color ?? PALETTE[i % PALETTE.length],
  }))

  const [ownEnv, setOwnEnv] = React.useState(environments[0] ?? "")
  const env = environment ?? ownEnv
  const setEnv = (v: string) =>
    onEnvironmentChange ? onEnvironmentChange(v) : setOwnEnv(v)

  const [ownPolicy, setOwnPolicy] = React.useState(livePolicy)
  const policy = policyIn ?? ownPolicy
  const setPolicy = (v: string) =>
    onPolicyChange ? onPolicyChange(v) : setOwnPolicy(v)

  const [ownFallback, setOwnFallback] = React.useState<ModelRouterFallback>(
    () => ({
      enabled: true,
      from: modelsIn[0]?.id ?? "",
      to: modelsIn[1]?.id ?? modelsIn[0]?.id ?? "",
    })
  )
  const fallback = fallbackIn ?? ownFallback
  const setFallback = (patch: Partial<ModelRouterFallback>) => {
    const next = { ...fallback, ...patch }
    if (onFallbackChange) onFallbackChange(next)
    else setOwnFallback(next)
  }

  const [hovered, setHovered] = React.useState<string | null>(null)

  const shares = Object.fromEntries(
    MODELS.map((m) => [
      m.id,
      policies.find((p) => p.id === policy)?.shares[m.id] ?? 0,
    ])
  )
  const blended = MODELS.reduce(
    (sum, m) => sum + (shares[m.id] / 100) * m.price,
    0
  )
  const p95 = MODELS.reduce((sum, m) => sum + (shares[m.id] / 100) * m.p95, 0)
  const errors = MODELS.reduce(
    (sum, m) => sum + (shares[m.id] / 100) * m.errors,
    0
  )
  const dirty = policy !== livePolicy
  const deploying = deployState === "deploying"
  const justDeployed = deployState === "deployed"

  return (
    <Widget className={cn("max-w-[560px]", className)}>
      <WidgetHeader>
        <WidgetTitle>{title}</WidgetTitle>
        {environments.length > 1 && (
          <WidgetActions>
            <Select value={env} onValueChange={(v) => v && setEnv(v)}>
              <SelectTrigger>
                <ServerIcon className="text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {environments.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </WidgetActions>
        )}
      </WidgetHeader>

      <WidgetPanel className="relative flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row">
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
              <NumberTicker
                value={blended}
                format={(v) => `$${v.toFixed(4)}`}
              />
              <StatUnit>/ 1K tokens</StatUnit>
            </StatValue>
            <StatMeta>
              {requestsPerSecond} req/s · p95{" "}
              <NumberTicker value={p95} format={(v) => v.toFixed(2)} /> s ·{" "}
              <NumberTicker value={errors} format={(v) => `${v.toFixed(2)}%`} />{" "}
              errors
            </StatMeta>
          </Stat>
          {policies.length > 1 && (
            <Segmented
              className="self-start sm:absolute sm:top-5 sm:right-5"
              value={policy}
              onValueChange={setPolicy}
            >
              {policies.map((p) => (
                <SegmentedItem key={p.id} value={p.id}>
                  {p.label}
                </SegmentedItem>
              ))}
            </Segmented>
          )}
        </div>

        <RouteFlow
          models={MODELS}
          shares={shares}
          requestsPerSecond={requestsPerSecond}
          hovered={hovered}
          onHover={setHovered}
        />
      </WidgetPanel>

      <WidgetPanel className="flex flex-col pt-3">
        <WidgetList>
          <WidgetListHeader className={COLS}>
            <WidgetSectionTitle>Routes</WidgetSectionTitle>
            <span className="text-right eyebrow whitespace-nowrap text-muted-foreground">
              Share
            </span>
            <span className="text-right eyebrow whitespace-nowrap text-muted-foreground max-sm:hidden">
              p50/p95 s
            </span>
            <span className="text-right eyebrow whitespace-nowrap text-muted-foreground">
              $ / 1K
            </span>
            <span className="text-right eyebrow whitespace-nowrap text-muted-foreground max-sm:hidden">
              Errors
            </span>
          </WidgetListHeader>

          {MODELS.map((m) => (
            <WidgetListRow
              key={m.id}
              className={COLS}
              dimmed={hovered !== null && hovered !== m.id}
              onMouseEnter={() => setHovered(m.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: m.color }}
                />
                <span className="truncate">{m.name}</span>
                <span className="truncate eyebrow text-faint-foreground max-sm:hidden">
                  {m.provider}
                </span>
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
                <NumberTicker
                  value={shares[m.id]}
                  format={(v) => `${Math.round(v)}%`}
                  className="w-8 text-right"
                />
              </span>
              <span className="text-right text-muted-foreground tabular-nums max-sm:hidden">
                {m.p50.toFixed(2)} / {m.p95.toFixed(2)}
              </span>
              <span className="text-right tabular-nums">
                ${m.price.toFixed(4)}
              </span>
              <span className="text-right text-muted-foreground tabular-nums max-sm:hidden">
                {m.errors.toFixed(2)}%
              </span>
            </WidgetListRow>
          ))}
        </WidgetList>

        <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-3 text-sm">
          <Switch
            checked={fallback.enabled}
            onCheckedChange={(enabled) => setFallback({ enabled })}
            className="data-checked:border-brand data-checked:bg-brand"
          />
          <span>Fallback</span>
          <span
            className={cn(
              "text-muted-foreground transition-opacity",
              !fallback.enabled && "opacity-40"
            )}
          >
            if
          </span>
          <ModelSelect
            models={MODELS}
            value={fallback.from}
            onValueChange={(from) => setFallback({ from })}
            disabled={!fallback.enabled}
          />
          <span
            className={cn(
              "text-muted-foreground transition-opacity",
              !fallback.enabled && "opacity-40"
            )}
          >
            fails, retry on
          </span>
          <ModelSelect
            models={MODELS}
            value={fallback.to}
            onValueChange={(to) => setFallback({ to })}
            disabled={!fallback.enabled}
          />
        </div>
      </WidgetPanel>

      <WidgetFooter>
        <WidgetMeta className="flex items-center gap-2">
          <StatusDot tone="success" pulse />
          {version != null ? `Policy v${version} · live` : "Live"}
          {env ? ` on ${env}` : null}
        </WidgetMeta>
        <Button
          variant="brand"
          className="ml-auto min-w-32"
          disabled={!dirty || deploying}
          onClick={() => onDeploy?.({ environment: env, policy, fallback })}
        >
          {deploying ? (
            <Loader2Icon className="animate-spin" />
          ) : justDeployed ? (
            <CheckIcon />
          ) : null}
          {deploying
            ? "Deploying"
            : justDeployed
              ? "Deployed"
              : "Deploy policy"}
        </Button>
      </WidgetFooter>
    </Widget>
  )
}

function ModelSelect({
  models,
  value,
  onValueChange,
  disabled,
}: {
  models: Model[]
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v && onValueChange(v)}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className="px-2.5">
        <SelectValue>
          {(id: string) => {
            const m = models.find((x) => x.id === id)
            if (!m) return null
            return (
              <>
                <span
                  className="size-2 rounded-full"
                  style={{ background: m.color }}
                />
                {m.name}
              </>
            )
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {models.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            <span
              className="size-2 rounded-full"
              style={{ background: m.color }}
            />
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
  models,
  shares,
  requestsPerSecond,
  hovered,
  onHover,
}: {
  models: Model[]
  shares: Record<string, number>
  requestsPerSecond: number
  hovered: string | null
  onHover: (id: string | null) => void
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(320)

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width)
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const height = ROW_H * models.length
  const originY = height / 2
  const endX = width - 6
  const forkX = Math.min(70, width * 0.2)
  const bendX = forkX + Math.min(90, width * 0.28)

  return (
    <div className="flex items-stretch gap-3">
      <div ref={ref} className="relative min-w-0 flex-1">
        <span
          className="absolute left-0 eyebrow text-muted-foreground max-sm:hidden"
          style={{ top: (ROW_H * models.length) / 2 - 26 }}
        >
          Gateway
        </span>
        <svg width={width} height={height} className="overflow-visible">
          {models.map((m, i) => {
            const y = ROW_H * i + ROW_H / 2
            const d = `M 6 ${originY} L ${forkX} ${originY} C ${(forkX + bendX) / 2} ${originY}, ${(forkX + bendX) / 2} ${y}, ${bendX} ${y} L ${endX} ${y}`
            const dim = hovered !== null && hovered !== m.id
            const count = Math.max(1, Math.round(shares[m.id] / 4))
            return (
              <g
                key={m.id}
                style={{ opacity: dim ? 0.25 : 1, transition: "opacity 200ms" }}
              >
                <path
                  d={d}
                  fill="none"
                  stroke={m.color}
                  strokeOpacity={0.14}
                  strokeWidth={6}
                  strokeLinecap="round"
                />
                <path
                  d={d}
                  fill="none"
                  stroke={m.color}
                  strokeOpacity={0.35}
                  strokeWidth={1.25}
                />
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
          <circle
            cx={6}
            cy={originY}
            r={4.5}
            className="fill-card stroke-muted-foreground"
            strokeWidth={1.5}
          />
        </svg>
      </div>
      <div className="flex flex-col" style={{ width: LABEL_W }}>
        {models.map((m) => (
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
              <NumberTicker value={(shares[m.id] / 100) * requestsPerSecond} />
              /s
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
