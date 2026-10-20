import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MeterBar } from "@/components/ds/meter-bar"
import { ModelIcon, type ModelFamily } from "@/components/ds/model-icons"
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
  type WidgetSize,
} from "@/components/ds/widget"

// AiSpend: a period's AI cost by model against a budget, the projection for
// an open period, an alert line past `alertAt`, and the models as the
// meter's legend. Pure view: pass the data in (from your API, a tool's
// output, a fixture); it keeps only UI state (period picked, row hovered).
//
//   <AiSpend models={models} periods={months} budget={1500} />
//
// Several periods add a period picker; one period hides it.

export type AiSpendModel = {
  id: string
  name: string
  provider?: string
  family: ModelFamily
  /** A token colour (`var(--chart-1)`); defaults follow the chart palette. */
  color?: string
}

export type AiSpendPeriod = {
  id: string
  label: string
  /** Short label used in sentences ("Oct"). */
  short: string
  days: number
  /** Days elapsed; equal to `days` for a closed period. */
  day: number
  resets: string
  /** Cost and tokens (millions) per model id. */
  usage: Record<string, { cost: number; tokens: number }>
}

export type AiSpendProps = {
  models: AiSpendModel[]
  periods: AiSpendPeriod[]
  budget: number
  /** Share of the budget that raises the alert. Default 0.8. */
  alertAt?: number
  /** Controlled period id; otherwise the first period. */
  period?: string
  onPeriodChange?: (id: string) => void
  title?: React.ReactNode
  currency?: string
  locale?: string
  /** "sm" inside a chat reply or a dense grid. */
  size?: WidgetSize
  className?: string
}

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--muted-foreground)",
]

// Mobile keeps cost and share; tokens join from `sm`.
const COLS =
  "grid-cols-[minmax(0,1fr)_80px_44px] sm:grid-cols-[minmax(0,1fr)_64px_80px_44px]"

export function AiSpend({
  models: modelsIn,
  periods,
  budget: BUDGET,
  alertAt: ALERT = 0.8,
  period,
  onPeriodChange,
  title = "AI spend",
  currency = "USD",
  locale = "en-US",
  size,
  className,
}: AiSpendProps) {
  const [ownPeriod, setOwnPeriod] = React.useState(periods[0]?.id)
  const monthKey = period ?? ownPeriod
  const setMonthKey = (id: string) =>
    onPeriodChange ? onPeriodChange(id) : setOwnPeriod(id)
  const [hovered, setHovered] = React.useState<string | null>(null)

  const MODELS = modelsIn.map((m, i) => ({
    ...m,
    color: m.color ?? PALETTE[i % PALETTE.length],
  }))
  const MONTHS = Object.fromEntries(periods.map((p) => [p.id, p]))
  const usd = (v: number, digits = 0) =>
    v.toLocaleString(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })

  const month = MONTHS[monthKey]
  const spent = MODELS.reduce(
    (sum, m) => sum + (month.usage[m.id]?.cost ?? 0),
    0
  )
  const ratio = spent / BUDGET
  const open = month.day < month.days
  const projected = open ? (spent / month.day) * month.days : spent
  const capDay = Math.ceil(BUDGET / (spent / month.day))

  // Tone escalates with severity: fine → close to the cap → over it.
  const level = ratio >= 1 ? "over" : ratio > ALERT ? "alert" : "ok"

  return (
    <Widget size={size} className={cn("max-w-[560px]", className)}>
      <WidgetHeader>
        <WidgetTitle>{title}</WidgetTitle>
        {periods.length > 1 && (
          <WidgetActions>
            <Select value={monthKey} onValueChange={(v) => v && setMonthKey(v)}>
              <SelectTrigger aria-label="Month">
                <CalendarIcon className="text-muted-foreground" />
                <SelectValue>{(v: string) => MONTHS[v]?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end" alignItemWithTrigger={false}>
                {periods.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </WidgetActions>
        )}
      </WidgetHeader>

      <WidgetPanel className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <Stat>
            <StatLabel>Spent</StatLabel>
            <StatValue>
              <NumberTicker value={spent} format={(v) => usd(v)} />
              <StatUnit>/ {usd(BUDGET)}</StatUnit>
            </StatValue>
            <StatMeta>
              {level === "over"
                ? `${usd(spent - BUDGET)} over budget`
                : `${usd(BUDGET - spent)} left`}
            </StatMeta>
          </Stat>
          <Stat className="items-end text-right">
            <StatLabel>{open ? "Projected" : "Daily average"}</StatLabel>
            <StatValue size="sm">
              {usd(open ? projected : spent / month.days)}
            </StatValue>
            <StatMeta>
              {open ? `Resets ${month.resets}` : "Closed month"}
            </StatMeta>
          </Stat>
        </div>

        <MeterBar
          max={BUDGET}
          segments={MODELS.map((m) => ({
            id: m.id,
            value: month.usage[m.id]?.cost ?? 0,
            color: m.color,
          }))}
          markers={[
            { value: BUDGET * ALERT, label: `${Math.round(ALERT * 100)}%` },
            { value: BUDGET, label: "Budget" },
          ]}
          highlighted={hovered}
        />

        {level !== "ok" && (
          <div className="flex items-center gap-2.5 text-sm">
            {level === "over" ? (
              <StatusBadge tone="destructive">Over budget</StatusBadge>
            ) : (
              <StatusBadge tone="warning">
                {Math.round(ratio * 100)}% used
              </StatusBadge>
            )}
            <span className="text-muted-foreground">
              {level === "over"
                ? `Went over the budget around ${month.short} ${capDay}.`
                : open && capDay <= month.days
                  ? `At this pace the budget runs out around ${month.short} ${capDay}.`
                  : "Close to the monthly budget."}
            </span>
          </div>
        )}
      </WidgetPanel>

      <WidgetPanel className="flex flex-col pt-3">
        <WidgetList onMouseLeave={() => setHovered(null)}>
          <WidgetListHeader className={COLS}>
            <WidgetSectionTitle>By model</WidgetSectionTitle>
            <span className="text-right eyebrow text-muted-foreground max-sm:hidden">
              Tokens
            </span>
            <span className="text-right eyebrow text-muted-foreground">
              Cost
            </span>
            <span className="text-right eyebrow text-muted-foreground">
              Share
            </span>
          </WidgetListHeader>
          {MODELS.map((m) => {
            const u = month.usage[m.id] ?? { cost: 0, tokens: 0 }
            return (
              <WidgetListRow
                key={m.id}
                className={COLS}
                dimmed={hovered !== null && hovered !== m.id}
                onMouseEnter={() => setHovered(m.id)}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: m.color }}
                  />
                  <ModelIcon
                    family={m.family}
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="truncate">{m.name}</span>
                  <span className="truncate eyebrow text-faint-foreground max-sm:hidden">
                    {m.provider}
                  </span>
                </span>
                <span className="text-right text-muted-foreground tabular-nums max-sm:hidden">
                  {u.tokens.toFixed(1)}M
                </span>
                <span className="text-right tabular-nums">
                  {usd(u.cost, 2)}
                </span>
                <span className="text-right text-muted-foreground tabular-nums">
                  {Math.round((u.cost / spent) * 100)}%
                </span>
              </WidgetListRow>
            )
          })}
        </WidgetList>
      </WidgetPanel>

      <WidgetFooter>
        <WidgetMeta>
          Budget {usd(BUDGET)} / month · alert at {Math.round(ALERT * 100)}%
        </WidgetMeta>
      </WidgetFooter>
    </Widget>
  )
}
