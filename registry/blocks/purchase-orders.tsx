import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  CalendarIcon,
  CheckIcon,
  Loader2Icon,
  SearchIcon,
  XIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { springSoft } from "@/lib/motion"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Segmented, SegmentedItem } from "@/components/ds/segmented"
import { StatusBadge } from "@/components/ds/status"
import {
  Widget,
  WidgetDescription,
  WidgetFooter,
  WidgetHeader,
  WidgetMeta,
  WidgetPanel,
  WidgetTitle,
} from "@/components/ds/widget"

// PurchaseOrders: a month of orders as a schedule. Each row is an order
// from the day it was placed to its delivery, filled as far as it is
// billed; "Today" runs down the rows. Tabs by status (with counts), a date
// chip, a supplier picker and search narrow it; checking rows turns the
// footer into the bulk actions for them. Pure view: orders in, `onApprove`
// and `onMarkBilled` out; it keeps only UI state (filters, selection).
//
//   <PurchaseOrders orders={orders} today={today} period={{ from, to, label: "September" }}
//     onApprove={approve} onMarkBilled={markBilled} />

export type OrderStatus = "draft" | "awaiting" | "approved" | "billed"

export type PurchaseOrder = {
  id: string
  supplier: string
  amount: number
  status: OrderStatus
  /** Day it was placed and day it is due, ISO dates. */
  ordered: string
  delivery: string
  /** Share billed, 0–1. */
  billed: number
}

const STATUSES: { id: OrderStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "awaiting", label: "Awaiting" },
  { id: "approved", label: "Approved" },
  { id: "billed", label: "Billed" },
]

const DAY = 86400000
const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
const money = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD" })
const short = (t: number) =>
  new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

/** Approve and Mark billed each apply to the orders they make sense for. */
const approvable = (o: PurchaseOrder) =>
  o.status === "draft" || o.status === "awaiting"
const billable = (o: PurchaseOrder) => o.status === "approved"

function meta(o: PurchaseOrder) {
  if (o.status === "draft") return "draft"
  if (o.status === "awaiting") return "approval"
  return `${Math.round(o.billed * 100)}% billed`
}

type Action = { name: "approve" | "bill"; state: "pending" | "done" } | null

export function PurchaseOrders({
  title = "Purchase orders",
  orders,
  today,
  period,
  onApprove,
  onMarkBilled,
  className,
}: {
  title?: string
  orders: PurchaseOrder[]
  /** ISO date. */
  today: string
  /** The default date filter, and the schedule's window. */
  period: { from: string; to: string; label: string }
  onApprove?: (ids: string[]) => void | Promise<void>
  onMarkBilled?: (ids: string[]) => void | Promise<void>
  className?: string
}) {
  const [status, setStatus] = React.useState<OrderStatus | "all">("all")
  const [inPeriod, setInPeriod] = React.useState(true)
  const [supplier, setSupplier] = React.useState("any")
  const [query, setQuery] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [action, setAction] = React.useState<Action>(null)

  const from = day(period.from)
  const to = day(period.to)
  const scoped = orders.filter(
    (o) => !inPeriod || (day(o.ordered) >= from && day(o.ordered) <= to)
  )
  const counts = Object.fromEntries(
    STATUSES.map((s) => [
      s.id,
      s.id === "all"
        ? scoped.length
        : scoped.filter((o) => o.status === s.id).length,
    ])
  )
  const q = query?.trim().toLowerCase() ?? ""
  const visible = scoped.filter(
    (o) =>
      (status === "all" || o.status === status) &&
      (supplier === "any" || o.supplier === supplier) &&
      (!q || `${o.supplier} ${o.id}`.toLowerCase().includes(q))
  )
  const suppliers = [...new Set(orders.map((o) => o.supplier))].sort()
  const needYou = counts.awaiting

  // The schedule's window: the period, plus the week after it so deliveries
  // that land just past it still show their marker.
  const start = from
  const end = to + 7 * DAY
  const x = (t: number) =>
    `${Math.max(0, Math.min(100, ((t - start) / (end - start)) * 100))}%`
  const weeks = Array.from(
    { length: Math.floor((end - start) / (7 * DAY)) + 1 },
    (_, i) => start + i * 7 * DAY
  )
  const now = day(today)
  const nextMonth = Date.UTC(
    new Date(to).getUTCFullYear(),
    new Date(to).getUTCMonth() + 1,
    1
  )

  const picked = orders.filter((o) => selected.has(o.id))
  const toApprove = picked.filter(approvable)
  const toBill = picked.filter(billable)
  const total = picked.reduce((s, o) => s + o.amount, 0)

  const run = async (
    name: "approve" | "bill",
    ids: string[],
    fn?: (ids: string[]) => void | Promise<void>
  ) => {
    setAction({ name, state: "pending" })
    await fn?.(ids)
    setAction({ name, state: "done" })
    window.setTimeout(() => {
      setAction(null)
      setSelected(new Set())
    }, 1600)
  }
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const cols =
    "grid-cols-[20px_minmax(0,1fr)_auto] md:grid-cols-[20px_minmax(0,1.1fr)_minmax(0,1.4fr)_96px]"

  return (
    <Widget className={cn("max-w-[680px]", className)}>
      <WidgetHeader className="items-start py-1">
        <div className="flex min-w-0 flex-col">
          <WidgetTitle>{title}</WidgetTitle>
          <WidgetDescription>
            {inPeriod ? period.label : "All dates"} · {scoped.length} orders
          </WidgetDescription>
        </div>
        {needYou > 0 && (
          // The one thing in the header besides the title: what needs the
          // person, and it takes them there.
          <button
            type="button"
            className="ml-auto rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            onClick={() => setStatus("awaiting")}
          >
            <StatusBadge tone="attention">{needYou} need you</StatusBadge>
          </button>
        )}
      </WidgetHeader>

      <WidgetPanel className="flex flex-col gap-4 p-0 pt-3">
        <div className="px-4">
          {/* Five tabs: a Select on phones. */}
          <Segmented
            variant="sans"
            value={status}
            onValueChange={(v) => setStatus(v as typeof status)}
            className="max-md:hidden"
          >
            {STATUSES.map((s) => (
              <SegmentedItem key={s.id} value={s.id}>
                {s.label}
                <span className="ml-1.5 font-mono text-xs text-faint-foreground tabular-nums">
                  {counts[s.id]}
                </span>
              </SegmentedItem>
            ))}
          </Segmented>
          <Select
            value={status}
            onValueChange={(v) => v && setStatus(v as typeof status)}
          >
            <SelectTrigger aria-label="Status" className="md:hidden">
              <SelectValue>
                {(v: string) =>
                  `${STATUSES.find((s) => s.id === v)?.label} · ${counts[v]}`
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}{" "}
                  <span className="font-mono text-xs text-faint-foreground">
                    {counts[s.id]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4">
          {inPeriod ? (
            <span className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-card pr-1 pl-3 text-sm shadow-xs">
              <CalendarIcon className="size-4 text-muted-foreground" />
              {short(from)} – {short(to)}
              <Button
                variant="ghost"
                size="icon-xs"
                className="rounded-full text-muted-foreground"
                aria-label="Clear dates"
                onClick={() => setInPeriod(false)}
              >
                <XIcon />
              </Button>
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full font-normal"
              onClick={() => setInPeriod(true)}
            >
              <CalendarIcon className="text-muted-foreground" />
              {period.label}
            </Button>
          )}
          <Select value={supplier} onValueChange={(v) => v && setSupplier(v)}>
            <SelectTrigger aria-label="Supplier" className="rounded-full">
              <span className="text-muted-foreground">Supplier</span>
              <SelectValue>
                {(v: string) => (v === "any" ? "Any" : v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AnimatePresence initial={false} mode="popLayout">
            {query === null ? (
              <motion.div
                key="icon"
                className="ml-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="rounded-full"
                  aria-label="Search orders"
                  onClick={() => setQuery("")}
                >
                  <SearchIcon />
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="field"
                className="ml-auto w-full sm:w-52"
                initial={{ opacity: 0, width: 32 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0 }}
                transition={springSoft}
              >
                <Input
                  autoFocus
                  value={query}
                  placeholder="Supplier or PO"
                  className="h-8 rounded-full"
                  onChange={(e) => setQuery(e.target.value)}
                  onBlur={() => !query && setQuery(null)}
                  onKeyDown={(e) => e.key === "Escape" && setQuery(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative border-t border-border/70 px-2 pt-3 pb-2">
          <div
            className={cn(
              "grid items-center gap-x-3 px-2 pb-2 eyebrow text-muted-foreground",
              cols
            )}
          >
            <span />
            <span>Supplier</span>
            <span className="relative h-5 max-md:hidden">
              <span className="absolute left-0 text-faint-foreground">
                {short(from)}
              </span>
              <span
                className="absolute -translate-x-1/2 rounded-full bg-brand px-1.5 text-brand-foreground"
                style={{ left: x(now) }}
              >
                Today
              </span>
              <span
                className="absolute -translate-x-1/2 text-faint-foreground"
                style={{ left: x(nextMonth) }}
              >
                {short(nextMonth)}
              </span>
            </span>
            <span className="text-right">Amount</span>
          </div>

          <div className="relative">
            {/* The schedule's weeks and today, drawn once behind every row. */}
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0 grid gap-x-3 px-2 max-md:hidden",
                cols
              )}
            >
              <span className="relative col-start-3">
                {weeks.map((w) => (
                  <span
                    key={w}
                    className="absolute inset-y-0 w-px bg-border/70"
                    style={{ left: x(w) }}
                  />
                ))}
                <span
                  className="absolute inset-y-0 border-l border-dashed border-foreground/60"
                  style={{ left: x(now) }}
                />
              </span>
            </div>

            <div role="list" className="relative max-h-[300px] overflow-y-auto">
              {visible.length === 0 && (
                <p className="px-2 py-6 text-sm text-muted-foreground">
                  No orders match.
                </p>
              )}
              {visible.map((o) => {
                const on = selected.has(o.id)
                const s = day(o.ordered)
                const e = day(o.delivery)
                const pending = o.status === "draft" || o.status === "awaiting"
                return (
                  <label
                    key={o.id}
                    role="listitem"
                    data-selected={on || undefined}
                    className={cn(
                      "grid cursor-pointer items-center gap-x-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-muted/60 data-selected:bg-muted",
                      cols
                    )}
                  >
                    <Checkbox
                      checked={on}
                      onCheckedChange={() => toggle(o.id)}
                      aria-label={`Select ${o.id}`}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{o.supplier}</span>
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {o.id} · {meta(o)}
                      </span>
                    </span>
                    <span className="relative h-5 max-md:hidden" aria-hidden>
                      <span
                        className={cn(
                          "absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full",
                          pending
                            ? "border border-dashed border-foreground/40"
                            : "bg-brand/15"
                        )}
                        style={{ left: x(s), width: `calc(${x(e)} - ${x(s)})` }}
                      >
                        {!pending && (
                          <motion.span
                            className="absolute inset-y-0 left-0 rounded-full bg-brand"
                            initial={false}
                            animate={{ width: `${o.billed * 100}%` }}
                            transition={springSoft}
                          />
                        )}
                      </span>
                      {/* Delivery. */}
                      <span
                        className={cn(
                          "absolute top-1/2 size-3 -translate-1/2 rounded-full border-2 bg-card",
                          pending ? "border-foreground/40" : "border-brand"
                        )}
                        style={{ left: x(e) }}
                      />
                    </span>
                    <span className="text-right font-mono text-sm tabular-nums">
                      {money(o.amount)}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 pt-3 eyebrow text-muted-foreground max-md:hidden">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full bg-brand" />
              Billed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full bg-brand/15" />
              Ordered
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full border border-dashed border-foreground/40" />
              Pending
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full border-2 border-brand" />
              Delivery
            </span>
            <span className="ml-auto text-faint-foreground">
              1 col = 1 week
            </span>
          </div>
        </div>
      </WidgetPanel>

      <WidgetFooter>
        {picked.length > 0 ? (
          <WidgetMeta className="flex items-baseline gap-2 text-foreground">
            {picked.length} selected
            <span className="font-mono text-muted-foreground tabular-nums">
              {money(total)}
            </span>
          </WidgetMeta>
        ) : (
          <WidgetMeta>
            {visible.length} shown ·{" "}
            <span className="font-mono tabular-nums">
              {money(visible.reduce((s, o) => s + o.amount, 0))}
            </span>
          </WidgetMeta>
        )}
        <div className="ml-auto flex gap-2">
          {/* The secondary action: a real second verb for the same selection. */}
          <Button
            variant="secondary"
            disabled={toBill.length === 0 || action !== null}
            onClick={() =>
              run(
                "bill",
                toBill.map((o) => o.id),
                onMarkBilled
              )
            }
          >
            {action?.name === "bill" && action.state === "pending" && (
              <Loader2Icon className="animate-spin" />
            )}
            {action?.name === "bill" && action.state === "done" && (
              <CheckIcon />
            )}
            {action?.name === "bill"
              ? action.state === "pending"
                ? "Marking…"
                : "Marked"
              : "Mark billed"}
          </Button>
          <Button
            variant="brand"
            className="min-w-32"
            disabled={toApprove.length === 0 || action !== null}
            onClick={() =>
              run(
                "approve",
                toApprove.map((o) => o.id),
                onApprove
              )
            }
          >
            {action?.name === "approve" && action.state === "pending" && (
              <Loader2Icon className="animate-spin" />
            )}
            {action?.name === "approve" && action.state === "done" && (
              <CheckIcon />
            )}
            {action?.name === "approve"
              ? action.state === "pending"
                ? "Approving…"
                : "Approved"
              : toApprove.length > 0
                ? `Approve ${toApprove.length}`
                : "Approve"}
          </Button>
        </div>
      </WidgetFooter>
    </Widget>
  )
}
