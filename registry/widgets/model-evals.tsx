import * as React from "react"
import { motion } from "motion/react"
import { CheckIcon, GitCompareIcon, Loader2Icon } from "lucide-react"

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
import { MeterBar } from "@/components/ds/meter-bar"
import { NumberTicker } from "@/components/ds/number-ticker"
import {
  Stat,
  StatLabel,
  StatMeta,
  StatUnit,
  StatValue,
} from "@/components/ds/stat"
import { StatusBadge } from "@/components/ds/status"
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

// ModelEvals: a model version's pass rate against a baseline version and a
// target, per suite, and the most recent failures. Clicking a suite filters
// the failures. Pure view: pass the data in (from your eval runner, a tool's
// output, a fixture); it keeps only UI state (suite picked, row hovered, the
// brief "done" on the re-run button).
//
//   <ModelEvals model="atlas-v13" suites={suites} baselines={baselines}
//     failures={failures} running={running} onRerun={rerun} />
//
// Several baselines add a baseline picker; one hides it. Without `onRerun`
// there is no re-run button. Copy defaults to English: pass `labels` (and
// `locale` for numbers) to localise it.

export type ModelEvalsSuite = {
  id: string
  name: string
  /** Number of cases in the suite. */
  cases: number
  /** Pass rate, 0–1. */
  pass: number
}

export type ModelEvalsBaseline = {
  id: string
  /** Full version name ("atlas-v12"). */
  label: string
  /** Short name for markers and column heads ("v12"); defaults to `label`. */
  short?: string
  /** Pass rate (0–1) per suite id. */
  pass: Record<string, number>
}

export type ModelEvalsFailure = {
  id: string
  /** Suite id the case belongs to. */
  suite: string
  title: string
  /** Failing since the latest run (it passed on the baseline). */
  isNew?: boolean
}

export type ModelEvalsLabels = {
  compareWith: string
  vs: (baseline: string) => string
  passRate: (model: string) => string
  /** `pass` and `target` come formatted, without the % sign. */
  summary: (p: { baseline: string; pass: string; target: string }) => string
  cases: string
  caseCount: (count: string) => string
  running: string
  ranAt: (when: React.ReactNode) => React.ReactNode
  target: string
  bySuite: string
  pass: string
  delta: string
  points: string
  recentFailures: string
  newCount: (count: number) => string
  newBadge: string
  rerun: string
  rerunning: string
  done: string
}

const DEFAULT_LABELS: ModelEvalsLabels = {
  compareWith: "Compare with",
  vs: (b) => `vs ${b}`,
  passRate: (m) => `Pass rate · ${m}`,
  summary: ({ baseline, pass, target }) =>
    `${baseline} had ${pass}% · target ${target}%`,
  cases: "Cases",
  caseCount: (n) => `${n} cases`,
  running: "Running…",
  ranAt: (when) => <>Ran {when}</>,
  target: "Target",
  bySuite: "By suite",
  pass: "Pass",
  delta: "Δ pp",
  points: "pp",
  recentFailures: "Recent failures",
  newCount: (n) => `${n} new`,
  newBadge: "New",
  rerun: "Run evals",
  rerunning: "Running",
  done: "Done",
}

export type ModelEvalsProps = {
  /** The version under test ("atlas-v13"). */
  model: string
  suites: ModelEvalsSuite[]
  baselines: ModelEvalsBaseline[]
  failures: ModelEvalsFailure[]
  /** Pass rate the model should reach, 0–1. Default 0.9. */
  target?: number
  /** Lower end of the bars' scale (the upper is 1). Default 0.6. */
  min?: number
  /** Failures shown at once. Default 4. */
  maxFailures?: number
  /** Controlled baseline id; otherwise the first baseline. */
  baseline?: string
  onBaselineChange?: (id: string) => void
  /** When the last run finished, as you want it read ("18 min ago"). */
  ranAt?: React.ReactNode
  /** A run is in progress: the button spins, the meta says so. */
  running?: boolean
  /** Shows the re-run button; the new results come back through props. */
  onRerun?: () => void
  title?: React.ReactNode
  /** Footer line (dataset, seed…). */
  meta?: React.ReactNode
  labels?: Partial<ModelEvalsLabels>
  locale?: string
  className?: string
}

// Mobile drops the comparison bar; the Δ column still says it.
const COLS =
  "grid-cols-[minmax(0,1fr)_56px_56px] sm:grid-cols-[minmax(0,1fr)_96px_56px_64px]"

export function ModelEvals({
  model,
  suites,
  baselines,
  failures: failuresIn,
  target: TARGET = 0.9,
  min = 0.6,
  maxFailures = 4,
  baseline: baselineProp,
  onBaselineChange,
  ranAt,
  running = false,
  onRerun,
  title = "Model quality",
  meta,
  labels: labelsIn,
  locale = "en-US",
  className,
}: ModelEvalsProps) {
  const t = { ...DEFAULT_LABELS, ...labelsIn }
  const [ownBaseline, setOwnBaseline] = React.useState(baselines[0]?.id)
  const baselineKey = baselineProp ?? ownBaseline
  const setBaselineKey = (id: string) =>
    onBaselineChange ? onBaselineChange(id) : setOwnBaseline(id)
  const [hovered, setHovered] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<string | null>(null)

  // "Done" flashes on the button for a moment after a run ends.
  const [justRan, setJustRan] = React.useState(false)
  const [wasRunning, setWasRunning] = React.useState(running)
  if (running !== wasRunning) {
    setWasRunning(running)
    setJustRan(!running)
  }
  React.useEffect(() => {
    if (!justRan) return
    const id = window.setTimeout(() => setJustRan(false), 1800)
    return () => window.clearTimeout(id)
  }, [justRan])

  const pct = (v: number, digits = 1) =>
    (v * 100).toLocaleString(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  const int = (v: number) => v.toLocaleString(locale)

  const BASELINES = Object.fromEntries(baselines.map((b) => [b.id, b]))
  const baseline = BASELINES[baselineKey]
  const short = baseline.short ?? baseline.label
  const total = suites.reduce((s, x) => s + x.cases, 0)
  const pass = suites.reduce((s, x) => s + x.pass * x.cases, 0) / total
  const basePass =
    suites.reduce((s, x) => s + (baseline.pass[x.id] ?? 0) * x.cases, 0) / total
  const delta = pass - basePass
  const focus = hovered ?? selected
  const failures = failuresIn.filter((f) => !selected || f.suite === selected)
  const newCount = failures.filter((f) => f.isNew).length

  function rerun() {
    setSelected(null)
    onRerun?.()
  }

  return (
    <Widget className={cn("max-w-[560px]", className)}>
      <WidgetHeader>
        <WidgetTitle>{title}</WidgetTitle>
        {baselines.length > 1 && (
          <WidgetActions>
            <Select
              value={baselineKey}
              onValueChange={(v) => v && setBaselineKey(v)}
            >
              <SelectTrigger aria-label={t.compareWith}>
                <GitCompareIcon className="text-muted-foreground" />
                <SelectValue>
                  {(v: string) => t.vs(BASELINES[v]?.label ?? "")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" alignItemWithTrigger={false}>
                {baselines.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.label}
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
            <StatLabel>{t.passRate(model)}</StatLabel>
            <StatValue>
              <NumberTicker value={pass * 100} format={(v) => pct(v / 100)} />
              <StatUnit>%</StatUnit>
              <StatusBadge
                tone={delta >= 0 ? "success" : "destructive"}
                dot={false}
                className="self-center"
              >
                {delta >= 0 ? "▲" : "▼"} {pct(Math.abs(delta))} {t.points}
              </StatusBadge>
            </StatValue>
            <StatMeta>
              {t.summary({
                baseline: baseline.label,
                pass: pct(basePass),
                target: pct(TARGET, 0),
              })}
            </StatMeta>
          </Stat>
          <Stat className="sm:items-end sm:text-right">
            <StatLabel>{t.cases}</StatLabel>
            <StatValue size="sm">{int(total)}</StatValue>
            <StatMeta>
              {running ? t.running : ranAt != null ? t.ranAt(ranAt) : null}
            </StatMeta>
          </Stat>
        </div>

        <MeterBar
          min={min}
          max={1}
          segments={[{ id: "pass", value: pass, color: "var(--chart-1)" }]}
          markers={[
            { value: basePass, label: short },
            { value: TARGET, label: t.target },
          ]}
        />
      </WidgetPanel>

      <WidgetPanel className="flex flex-col pt-3">
        <WidgetList onMouseLeave={() => setHovered(null)}>
          <WidgetListHeader className={COLS}>
            <WidgetSectionTitle>{t.bySuite}</WidgetSectionTitle>
            <span className="eyebrow text-muted-foreground max-sm:hidden">
              {t.vs(short)}
            </span>
            <span className="text-right eyebrow text-muted-foreground">
              {t.pass}
            </span>
            <span className="text-right eyebrow text-muted-foreground">
              {t.delta}
            </span>
          </WidgetListHeader>
          {suites.map((s) => {
            const base = baseline.pass[s.id] ?? 0
            const d = s.pass - base
            return (
              <WidgetListRow
                key={s.id}
                className={COLS}
                selected={selected === s.id}
                dimmed={focus !== null && focus !== s.id}
                onMouseEnter={() => setHovered(s.id)}
                onClick={() => setSelected((v) => (v === s.id ? null : s.id))}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span>{s.name}</span>
                  <span className="eyebrow text-muted-foreground">
                    {t.caseCount(int(s.cases))}
                  </span>
                </span>
                <span className="block max-sm:hidden">
                  <Comparison value={s.pass} baseline={base} min={min} />
                </span>
                <span className="text-right tabular-nums">{pct(s.pass)}%</span>
                <span
                  className={cn(
                    "text-right tabular-nums",
                    d < 0 ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {d >= 0 ? "+" : "−"}
                  {pct(Math.abs(d))}
                </span>
              </WidgetListRow>
            )
          })}
        </WidgetList>
      </WidgetPanel>

      <WidgetPanel className="flex flex-col pt-3">
        <WidgetList>
          <WidgetListHeader className="grid-cols-[1fr_auto]">
            <WidgetSectionTitle>
              {t.recentFailures}
              {selected && (
                <span className="text-muted-foreground">
                  {" "}
                  · {suites.find((s) => s.id === selected)?.name}
                </span>
              )}
            </WidgetSectionTitle>
            <span className="eyebrow text-muted-foreground">
              {newCount > 0 && t.newCount(newCount)}
            </span>
          </WidgetListHeader>
          {failures.slice(0, maxFailures).map((f) => (
            <WidgetListRow key={f.id} className="grid-cols-[72px_1fr_auto]">
              <span className="eyebrow text-muted-foreground">{f.id}</span>
              <span className="truncate">{f.title}</span>
              {f.isNew ? (
                <StatusBadge tone="warning">{t.newBadge}</StatusBadge>
              ) : (
                <span />
              )}
            </WidgetListRow>
          ))}
        </WidgetList>
      </WidgetPanel>

      {(meta != null || onRerun) && (
        <WidgetFooter>
          {meta != null && <WidgetMeta>{meta}</WidgetMeta>}
          {onRerun && (
            <Button
              variant="brand"
              className="ml-auto min-w-32"
              disabled={running}
              onClick={rerun}
            >
              {running ? (
                <Loader2Icon className="animate-spin" />
              ) : justRan ? (
                <CheckIcon />
              ) : null}
              {running ? t.rerunning : justRan ? t.done : t.rerun}
            </Button>
          )}
        </WidgetFooter>
      )}
    </Widget>
  )
}

/** The current pass rate as a bar, the baseline as a hairline tick. */
function Comparison({
  value,
  baseline,
  min,
}: {
  value: number
  baseline: number
  min: number
}) {
  const at = (v: number) => `${((v - min) / (1 - min)) * 100}%`
  return (
    <span className="relative block h-1.5 w-full rounded-full bg-muted">
      <motion.span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          background:
            value < baseline ? "var(--destructive)" : "var(--chart-1)",
        }}
        initial={false}
        animate={{ width: at(value) }}
        transition={springSoft}
      />
      <span
        className="absolute -inset-y-1 w-px bg-foreground/50"
        style={{ left: at(baseline) }}
      />
    </span>
  )
}
