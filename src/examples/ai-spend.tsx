import * as React from "react"
import { CalendarIcon } from "lucide-react"

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
import { Stat, StatLabel, StatMeta, StatUnit, StatValue } from "@/components/ds/stat"
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

// AI spend: this month's cost by model against a monthly budget, with an
// alert past 80%. Pick a past month to see the other states.

const BUDGET = 1500
const ALERT = 0.8

const MODELS: { id: string; name: string; provider: string; family: ModelFamily; color: string }[] = [
  { id: "opus", name: "Claude Opus", provider: "Anthropic", family: "claude", color: "var(--chart-1)" },
  { id: "sonnet", name: "Claude Sonnet", provider: "Anthropic", family: "claude", color: "var(--chart-2)" },
  { id: "gpt", name: "GPT", provider: "OpenAI", family: "openai", color: "var(--chart-3)" },
  { id: "gemini", name: "Gemini", provider: "Google", family: "gemini", color: "var(--chart-4)" },
  { id: "llama", name: "Llama", provider: "Self-hosted", family: "meta", color: "var(--muted-foreground)" },
]

type Month = {
  label: string
  short: string
  days: number
  /** Days elapsed; equal to `days` for a closed month. */
  day: number
  resets: string
  /** Cost and tokens (millions) per model id. */
  usage: Record<string, { cost: number; tokens: number }>
}

const MONTHS: Record<string, Month> = {
  oct: {
    label: "October 2026",
    short: "Oct",
    days: 31,
    day: 19,
    resets: "Nov 1",
    usage: {
      opus: { cost: 584.2, tokens: 37.7 },
      sonnet: { cost: 398.7, tokens: 78.2 },
      gpt: { cost: 182.6, tokens: 41 },
      gemini: { cost: 91.15, tokens: 23.8 },
      llama: { cost: 30.4, tokens: 15.6 },
    },
  },
  sep: {
    label: "September 2026",
    short: "Sep",
    days: 30,
    day: 30,
    resets: "Oct 1",
    usage: {
      opus: { cost: 702.4, tokens: 45.3 },
      sonnet: { cost: 455.1, tokens: 89.2 },
      gpt: { cost: 259.8, tokens: 58.4 },
      gemini: { cost: 140.2, tokens: 36.6 },
      llama: { cost: 54.9, tokens: 28.1 },
    },
  },
  aug: {
    label: "August 2026",
    short: "Aug",
    days: 31,
    day: 31,
    resets: "Sep 1",
    usage: {
      opus: { cost: 280.4, tokens: 18.1 },
      sonnet: { cost: 210.3, tokens: 41.2 },
      gpt: { cost: 99.6, tokens: 22.4 },
      gemini: { cost: 49.7, tokens: 13 },
      llama: { cost: 16.6, tokens: 8.5 },
    },
  },
}

const usd = (v: number, digits = 0) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits })

// Mobile keeps cost and share; tokens join from `sm`.
const COLS = "grid-cols-[minmax(0,1fr)_80px_44px] sm:grid-cols-[minmax(0,1fr)_64px_80px_44px]"

export function AiSpend() {
  const [monthKey, setMonthKey] = React.useState("oct")
  const [hovered, setHovered] = React.useState<string | null>(null)

  const month = MONTHS[monthKey]
  const spent = MODELS.reduce((sum, m) => sum + month.usage[m.id].cost, 0)
  const ratio = spent / BUDGET
  const open = month.day < month.days
  const projected = open ? (spent / month.day) * month.days : spent
  const capDay = Math.ceil(BUDGET / (spent / month.day))

  // Tone escalates with severity: fine → close to the cap → over it.
  const level = ratio >= 1 ? "over" : ratio > ALERT ? "alert" : "ok"

  return (
    <Widget className="max-w-[560px]">
      <WidgetHeader>
        <WidgetTitle>AI spend</WidgetTitle>
        <WidgetActions>
          <Select value={monthKey} onValueChange={(v) => v && setMonthKey(v)}>
            <SelectTrigger aria-label="Month">
              <CalendarIcon className="text-muted-foreground" />
              <SelectValue>{(v: string) => MONTHS[v].label}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false}>
              {Object.entries(MONTHS).map(([key, m]) => (
                <SelectItem key={key} value={key}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </WidgetActions>
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
            <StatValue size="sm">{usd(open ? projected : spent / month.days)}</StatValue>
            <StatMeta>{open ? `Resets ${month.resets}` : "Closed month"}</StatMeta>
          </Stat>
        </div>

        <MeterBar
          max={BUDGET}
          segments={MODELS.map((m) => ({ id: m.id, value: month.usage[m.id].cost, color: m.color }))}
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
              <StatusBadge tone="warning">{Math.round(ratio * 100)}% used</StatusBadge>
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
            <span className="eyebrow text-right text-muted-foreground max-sm:hidden">Tokens</span>
            <span className="eyebrow text-right text-muted-foreground">Cost</span>
            <span className="eyebrow text-right text-muted-foreground">Share</span>
          </WidgetListHeader>
          {MODELS.map((m) => {
            const u = month.usage[m.id]
            return (
              <WidgetListRow
                key={m.id}
                className={COLS}
                dimmed={hovered !== null && hovered !== m.id}
                onMouseEnter={() => setHovered(m.id)}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: m.color }} />
                  <ModelIcon family={m.family} className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{m.name}</span>
                  <span className="eyebrow truncate text-faint-foreground max-sm:hidden">{m.provider}</span>
                </span>
                <span className="text-right text-muted-foreground tabular-nums max-sm:hidden">{u.tokens.toFixed(1)}M</span>
                <span className="text-right tabular-nums">{usd(u.cost, 2)}</span>
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
