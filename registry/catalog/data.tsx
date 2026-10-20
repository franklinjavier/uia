import { z } from "zod"

import { cn } from "@/lib/utils"
import {
  Table as TableRoot,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BarSeries as BarSeriesView } from "@/components/ds/bar-series"
import { MeterBar } from "@/components/ds/meter-bar"
import { Sparkline as SparklineView } from "@/components/ds/sparkline"
import { Stepper as StepperView } from "@/components/ds/stepper"
import {
  Stat as StatRoot,
  StatLabel,
  StatMeta,
  StatUnit,
  StatValue,
} from "@/components/ds/stat"
import { StatusBadge } from "@/components/ds/status"
import { TickMeter } from "@/components/ds/tick-meter"
import { WidgetList, WidgetListRow } from "@/components/ds/widget"
import {
  children,
  defineComponent,
  format,
  tone,
} from "@/components/surface/catalog"

// Data: numbers and series. Values come in raw; `format` turns them into
// text with the host's locale. Colour stays reserved for state (`tone`),
// series use the chart palette.

const TONE_TEXT: Record<string, string> = {
  success: "text-success",
  warning: "text-attention",
  attention: "text-attention",
  destructive: "text-destructive",
  info: "text-chart-1",
  neutral: "text-brand",
}

export const Stat = defineComponent({
  name: "Stat",
  kind: "data",
  description:
    "One number that answers the question: label, value, optional unit, delta and a meta line (what changed, by when).",
  props: z.object({
    label: z.string(),
    value: z.union([z.number(), z.string()]),
    format: format.optional(),
    unit: z
      .string()
      .optional()
      .describe('Shown after the value, e.g. "/ $1,500" or "req/s".'),
    delta: z.number().optional().describe("Change as a ratio (0.12 = +12%)."),
    deltaIsGood: z
      .enum(["up", "down"])
      .optional()
      .describe('Which direction is good. Costs: "down".'),
    meta: z.string().optional(),
    size: z.enum(["lg", "sm"]).optional(),
  }),
  example: {
    id: "spent",
    component: "Stat",
    label: "Spent",
    value: { path: "/total" },
    format: "currency",
    unit: "/ $1,500",
    meta: "$213 left",
  },
  render: (p, ctx) => {
    const good =
      p.delta === undefined
        ? undefined
        : (p.deltaIsGood ?? "up") === "up"
          ? p.delta >= 0
          : p.delta <= 0
    return (
      <StatRoot>
        <StatLabel>{p.label}</StatLabel>
        <StatValue size={p.size ?? "lg"}>
          {ctx.format(p.value, p.format)}
          {p.unit && <StatUnit>{p.unit}</StatUnit>}
          {p.delta !== undefined && (
            <StatusBadge
              tone={good ? "success" : "destructive"}
              className="self-center"
            >
              {p.delta >= 0 ? "+" : ""}
              {ctx.format(p.delta, "percent")}
            </StatusBadge>
          )}
        </StatValue>
        {p.meta && <StatMeta>{p.meta}</StatMeta>}
      </StatRoot>
    )
  },
})

export const Meter = defineComponent({
  name: "Meter",
  kind: "data",
  description:
    "A value against its limit, the limit visible; or a breakdown (segments) of a total. Markers label thresholds.",
  props: z.object({
    label: z.string().optional(),
    value: z.number().optional(),
    segments: z
      .array(z.object({ label: z.string(), value: z.number() }))
      .optional(),
    max: z.number(),
    min: z.number().optional(),
    format: format.optional(),
    markers: z
      .array(z.object({ value: z.number(), label: z.string() }))
      .optional(),
    tone: tone.optional(),
  }),
  render: (p, ctx) => {
    const palette = [
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--muted-foreground)",
    ]
    const color =
      p.tone && p.tone !== "neutral"
        ? `var(--${p.tone === "warning" ? "attention" : p.tone === "info" ? "chart-1" : p.tone})`
        : "var(--chart-1)"
    const segments = p.segments
      ? p.segments.map((s, i) => ({
          id: s.label,
          value: s.value,
          color: palette[i % palette.length],
        }))
      : [{ id: "value", value: p.value ?? 0, color }]
    const total = segments.reduce((a, s) => a + s.value, 0)
    return (
      <div className="flex flex-col gap-2">
        {p.label && (
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="eyebrow text-muted-foreground">{p.label}</span>
            <span className="tabular-nums">
              {ctx.format(total, p.format)}{" "}
              <span className="text-muted-foreground">
                / {ctx.format(p.max, p.format)}
              </span>
            </span>
          </div>
        )}
        <MeterBar
          min={p.min}
          max={p.max}
          segments={segments}
          markers={p.markers}
        />
        {p.segments && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {p.segments.map((s, i) => (
              <span key={s.label} className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ background: palette[i % palette.length] }}
                />
                {s.label}{" "}
                <span className="text-foreground tabular-nums">
                  {ctx.format(s.value, p.format)}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    )
  },
})

export const Progress = defineComponent({
  name: "Progress",
  kind: "data",
  description: "Progress toward done as hairline ticks (0–1).",
  props: z.object({
    value: z.number().min(0).max(1),
    label: z.string().optional(),
    tone: tone.optional(),
  }),
  render: (p, ctx) => (
    <div className="flex flex-col gap-1.5">
      {p.label && (
        <div className="flex justify-between eyebrow text-muted-foreground">
          <span>{p.label}</span>
          <span className="tabular-nums">{ctx.format(p.value, "percent")}</span>
        </div>
      )}
      <TickMeter value={p.value} className={TONE_TEXT[p.tone ?? "neutral"]} />
    </div>
  ),
})

export const BarSeries = defineComponent({
  name: "BarSeries",
  kind: "data",
  description:
    "A short series as bars (days, weeks, releases); the latest (or `highlight`) at full strength.",
  props: z.object({
    data: z.array(z.object({ label: z.string(), value: z.number() })).min(1),
    format: format.optional(),
    highlight: z.number().int().optional(),
  }),
  render: (p, ctx) => (
    <BarSeriesView
      data={p.data}
      highlight={p.highlight}
      format={(v) => ctx.format(v, p.format ?? "number")}
    />
  ),
})

export const Sparkline = defineComponent({
  name: "Sparkline",
  kind: "data",
  description: "A recent trend as a line, next to a Stat. No axes.",
  props: z.object({
    values: z.array(z.number()).min(2),
    label: z.string().optional(),
  }),
  render: (p) => (
    <div className="flex flex-col gap-1">
      <SparklineView values={p.values} className="h-12 w-full" />
      {p.label && (
        <span className="text-right eyebrow text-faint-foreground">
          {p.label}
        </span>
      )}
    </div>
  ),
})

export const Table = defineComponent({
  name: "Table",
  kind: "data",
  description:
    "Rows × columns when the person compares across several attributes. For one value per item, use List + KeyValue.",
  props: z.object({
    columns: z
      .array(
        z.object({
          key: z.string(),
          label: z.string(),
          align: z.enum(["start", "end"]).optional(),
          format: format.optional(),
        })
      )
      .min(1),
    rows: z.array(z.record(z.string(), z.unknown())),
  }),
  render: (p, ctx) => (
    <TableRoot>
      <TableHeader>
        <TableRow>
          {p.columns.map((c) => (
            <TableHead
              key={c.key}
              className={cn(
                "eyebrow text-muted-foreground",
                c.align === "end" && "text-right"
              )}
            >
              {c.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {p.rows.map((r, i) => (
          <TableRow key={i}>
            {p.columns.map((c) => (
              <TableCell
                key={c.key}
                className={cn(
                  c.align === "end" && "text-right",
                  // Only numbers get tabular figures: in Inter it widens hyphens.
                  typeof r[c.key] === "number" && "tabular-nums"
                )}
              >
                {ctx.format(r[c.key], c.format ?? "text")}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </TableRoot>
  ),
})

export const List = defineComponent({
  name: "List",
  kind: "data",
  description:
    "Rows separated by hairlines; usually a template of KeyValue over a data array.",
  props: z.object({ children, title: z.string().optional() }),
  render: (p, ctx) => (
    <div className="flex flex-col">
      {p.title && <span className="pb-1 text-[15px]">{p.title}</span>}
      <WidgetList>{ctx.children(p.children)}</WidgetList>
    </div>
  ),
})

export const KeyValue = defineComponent({
  name: "KeyValue",
  kind: "data",
  description:
    "One row: a label, an optional meta, and a formatted value on the right.",
  props: z.object({
    label: z.string(),
    value: z.union([z.number(), z.string()]),
    format: format.optional(),
    meta: z.string().optional(),
    tone: tone.optional(),
  }),
  render: (p, ctx) => (
    <WidgetListRow className="grid-cols-[minmax(0,1fr)_auto]">
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate">{p.label}</span>
        {p.meta && (
          <span className="truncate eyebrow text-faint-foreground">
            {p.meta}
          </span>
        )}
      </span>
      <span
        className={cn(
          "text-right",
          typeof p.value === "number" && "tabular-nums",
          p.tone && TONE_TEXT[p.tone]
        )}
      >
        {ctx.format(p.value, p.format)}
      </span>
    </WidgetListRow>
  ),
})

export const Stepper = defineComponent({
  name: "Stepper",
  kind: "data",
  description: "Where something is in a fixed sequence of stages.",
  props: z.object({
    stages: z
      .array(
        z.object({
          label: z.string(),
          status: z.enum(["done", "active", "waiting", "failed", "todo"]),
        })
      )
      .min(2),
  }),
  render: (p) => <StepperView labeled stages={p.stages} />,
})

export const data = [
  Stat,
  Meter,
  Progress,
  BarSeries,
  Sparkline,
  Table,
  List,
  KeyValue,
  Stepper,
]
