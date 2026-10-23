import * as React from "react"
import { motion } from "motion/react"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { springSoft } from "@/lib/motion"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { NumberTicker } from "@/components/ds/number-ticker"
import {
  Widget,
  WidgetDescription,
  WidgetFooter,
  WidgetHeader,
  WidgetPanel,
  WidgetTitle,
} from "@/components/ds/widget"

// BillsFilter: narrow a set of bills before showing them. Due-date range,
// an amount range over the distribution of amounts (so you see what you're
// cutting off), overdue only, and document types with their counts. The
// button says how many will show, live, and Reset is there once something
// changed. Pure view: documents in, `onApply(filter)` out.
//
//   <BillsFilter documents={docs} defaults={{ from, to }} onApply={show} />

export type BillDocument = {
  id: string
  kind: "bill" | "credit"
  amount: number
  /** ISO date. */
  due: string
  overdue: boolean
}

export type BillsFilterValue = {
  from: string
  to: string
  min: number
  max: number
  overdue: boolean
  kinds: BillDocument["kind"][]
}

const KINDS: { id: BillDocument["kind"]; label: string }[] = [
  { id: "bill", label: "Bills" },
  { id: "credit", label: "Credit notes" },
]

/** The amount axis: square-root scale, so the many small bills get room. */
const TOP = 20000
const toPos = (v: number) => Math.sqrt(Math.min(v, TOP) / TOP) * 100
const fromPos = (p: number) => Math.round(((p / 100) ** 2 * TOP) / 100) * 100
const short = (v: number) =>
  v >= TOP ? "$20k+" : v >= 1000 ? `$${+(v / 1000).toFixed(1)}k` : `$${v}`
const BINS = 28

export function matches(d: BillDocument, f: BillsFilterValue) {
  return (
    d.due >= f.from &&
    d.due <= f.to &&
    d.amount >= f.min &&
    (f.max >= TOP || d.amount <= f.max) &&
    (!f.overdue || d.overdue) &&
    f.kinds.includes(d.kind)
  )
}

export function BillsFilter({
  title = "Filter",
  description = "Bills and credit notes",
  documents,
  defaults,
  onApply,
  className,
}: {
  title?: string
  description?: string
  documents: BillDocument[]
  defaults: BillsFilterValue
  onApply?: (filter: BillsFilterValue, count: number) => void
  className?: string
}) {
  const [f, setF] = React.useState(defaults)
  const set = (patch: Partial<BillsFilterValue>) =>
    setF((x) => ({ ...x, ...patch }))
  const changed = JSON.stringify(f) !== JSON.stringify(defaults)

  // Everything but the amount, so the histogram shows what the range cuts.
  const others = documents.filter((d) => matches(d, { ...f, min: 0, max: TOP }))
  const bins = Array.from({ length: BINS }, () => 0)
  for (const d of others)
    bins[Math.min(BINS - 1, Math.floor((toPos(d.amount) / 100) * BINS))]++
  const peak = Math.max(1, ...bins)
  const count = documents.filter((d) => matches(d, f)).length
  const lo = toPos(f.min)
  const hi = toPos(f.max)

  return (
    <Widget className={cn("max-w-[400px]", className)}>
      <WidgetHeader className="items-start py-1">
        <div className="flex min-w-0 flex-col">
          <WidgetTitle>{title}</WidgetTitle>
          <WidgetDescription>{description}</WidgetDescription>
        </div>
      </WidgetHeader>

      <WidgetPanel className="flex flex-col divide-y divide-border/70 p-0">
        <div
          role="group"
          aria-labelledby="bills-due"
          className="flex flex-col gap-2.5 p-4"
        >
          <span id="bills-due" className="text-sm text-muted-foreground">
            Due date
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(["from", "to"] as const).map((k) => (
              // Reads "Sep 1"; the native picker sits on top, invisible.
              <label
                key={k}
                className="relative flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm shadow-xs transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 hover:bg-muted"
              >
                <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
                {new Date(`${f[k]}T00:00:00Z`).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
                <input
                  type="date"
                  aria-label={k === "from" ? "Due from" : "Due to"}
                  value={f[k]}
                  min={k === "to" ? f.from : undefined}
                  max={k === "from" ? f.to : undefined}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  onChange={(e) =>
                    e.target.value && set({ [k]: e.target.value })
                  }
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-mono tabular-nums">
              {short(f.min)} – {short(f.max)}
            </span>
          </div>
          {/* The distribution, lit inside the range. */}
          <div className="flex h-16 items-end gap-[3px]" aria-hidden>
            {bins.map((n, i) => {
              const centre = ((i + 0.5) / BINS) * 100
              const inside = centre >= lo && centre <= hi
              return (
                <motion.span
                  key={i}
                  className={cn(
                    "flex-1 rounded-[2px] transition-colors duration-200",
                    inside ? "bg-brand" : "bg-muted-foreground/25"
                  )}
                  initial={false}
                  animate={{
                    height: n === 0 ? 3 : `${Math.max(8, (n / peak) * 100)}%`,
                  }}
                  transition={springSoft}
                />
              )
            })}
          </div>
          <Slider
            aria-label="Amount range"
            min={0}
            max={100}
            step={0.5}
            value={[lo, hi]}
            onValueChange={(v) => {
              const [a, b] = v as number[]
              set({ min: fromPos(a), max: fromPos(b) })
            }}
          />
          <div className="relative h-4 font-mono text-xs text-faint-foreground">
            <span className="absolute left-0">$0</span>
            <span
              className="absolute -translate-x-1/2"
              style={{ left: `${toPos(5000)}%` }}
            >
              $5k
            </span>
            <span className="absolute right-0">$20k+</span>
          </div>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-3 p-4 text-sm">
          Overdue only
          <Switch
            checked={f.overdue}
            onCheckedChange={(v) => set({ overdue: v })}
          />
        </label>

        <div
          role="group"
          aria-labelledby="bills-kinds"
          className="flex flex-col gap-1 p-4 pt-3"
        >
          <span id="bills-kinds" className="pb-1 text-sm text-muted-foreground">
            Document types
          </span>
          {KINDS.map((k) => {
            const n = documents.filter((d) => d.kind === k.id).length
            const on = f.kinds.includes(k.id)
            return (
              <label
                key={k.id}
                className="flex cursor-pointer items-center gap-3 py-1.5 text-sm"
              >
                <Checkbox
                  checked={on}
                  onCheckedChange={(v) =>
                    set({
                      kinds: v
                        ? [...f.kinds, k.id]
                        : f.kinds.filter((x) => x !== k.id),
                    })
                  }
                />
                <span className="flex-1">{k.label}</span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {n}
                </span>
              </label>
            )
          })}
        </div>
      </WidgetPanel>

      <WidgetFooter className="flex-nowrap">
        {/* Reset only once there is something to undo. */}
        {changed && (
          <Button variant="secondary" onClick={() => setF(defaults)}>
            Reset
          </Button>
        )}
        <Button
          variant="brand"
          className="flex-1"
          disabled={count === 0}
          onClick={() => onApply?.(f, count)}
        >
          {count === 0 ? (
            "No bills match"
          ) : (
            <span>
              Show <NumberTicker value={count} />{" "}
              {count === 1 ? "bill" : "bills"}
            </span>
          )}
        </Button>
      </WidgetFooter>
    </Widget>
  )
}
