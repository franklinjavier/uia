import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChevronRightIcon, EyeIcon, EyeOffIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Toggle } from "@/components/ui/toggle"
import { Segmented, SegmentedItem } from "@/components/ds/segmented"
import { StatusDot } from "@/components/ds/status"
import { Stat, StatLabel, StatMeta, StatValue } from "@/components/ds/stat"
import {
  Widget,
  WidgetFooter,
  WidgetHeader,
  WidgetMeta,
  WidgetPanel,
  WidgetSectionTitle,
  WidgetTitle,
  type WidgetSize,
} from "@/components/ds/widget"

// Portfolio: what a wallet holds, worth how much, and how that moved.
//
//   PORTFOLIO VALUE 👁                         1D 1W 1M 1Y ALL
//   $24,615.62
//   ▲ +$238.34 · 1.0% · 1D        (hover: the number and its time follow the line)
//   ╱╲__╱‾‾╲_╱‾‾‾          $24,700   a value axis on round steps
//   24 H AGO           NOW
//   [actions slot: Send · Receive · Swap]
//   ──────────────────────────────────────────────────────
//   Assets  6 assets · 3 networks
//   Ethereum  ETH · 2 networks  ›  $3,246.20  ▲ 2.1%  3.842  $12,479  ▬ 50.7%
//     · Base   2.1 ETH …          (one row per network, folded)
//   4 tokens without a price, not counted                 Show
//
// A pure view: holdings and history in, range and display state inside (or
// the range controlled). The eye hides every amount, for screen sharing.
// Built on shadcn: Chart (recharts), Table, Avatar, Toggle, Button.

export type PortfolioNetwork = { id: string; name: string; amount: number; image?: string }

export type PortfolioHolding = {
  id: string
  name: string
  symbol: string
  /** Per unit; null when no market prices it (not counted in the total). */
  price: number | null
  /** 24 h change as a fraction (0.0214 = +2.14%). */
  change?: number
  /** A logo; the symbol stands in without one. */
  image?: string
  networks: PortfolioNetwork[]
}

export type PortfolioPoint = { t: number; v: number }

export type PortfolioRange = {
  id: string
  label: string
  /** Where the range starts, as the meta line says it ("Yesterday 10:00"). */
  since: string
  points: PortfolioPoint[]
}

export type PortfolioProps = {
  holdings: PortfolioHolding[]
  /** One series per range; the last point of each is now. */
  ranges: PortfolioRange[]
  range?: string
  onRangeChange?: (id: string) => void
  /** Under the hero: the wallet's verbs (Send, Receive, Swap). */
  actions?: React.ReactNode
  /** Footer meta ("Prices as of 10:42"); a live dot when `live`. */
  meta?: React.ReactNode
  live?: boolean
  currency?: string
  locale?: string
  /** How a hovered point's time reads under the number. */
  formatTime?: (t: number, range: string) => string
  title?: React.ReactNode
  size?: WidgetSize
  className?: string
}

const chartConfig = { v: { label: "Value", color: "var(--foreground)" } } satisfies ChartConfig

// Phones keep the asset and its value; tablets add its share.
const WIDE = "max-md:hidden"
const SHARE = "max-sm:hidden"

/** The token's logo (its symbol until one loads), the network's in the corner. */
function TokenAvatar({ symbol, image, network }: { symbol: string; image?: string; network?: string }) {
  return (
    <Avatar>
      {image && <AvatarImage src={image} alt="" />}
      <AvatarFallback className="font-mono text-[9px] tracking-tight">{symbol.slice(0, 3)}</AvatarFallback>
      {network && (
        <AvatarBadge className="-right-0.5 -bottom-0.5 overflow-hidden bg-card ring-card group-data-[size=default]/avatar:size-3.5">
          <img src={network} alt="" className="size-full rounded-full" />
        </AvatarBadge>
      )}
    </Avatar>
  )
}

/** Round steps for the value axis: three lines at most, on round numbers. */
function scale(lo: number, hi: number) {
  const raw = (hi - lo) / 2 || 1
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= raw) ?? raw
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v)
  return ticks
}

export function Portfolio({
  holdings,
  ranges,
  range,
  onRangeChange,
  actions,
  meta,
  live = false,
  currency = "USD",
  locale = "en-US",
  formatTime,
  title = "Portfolio",
  size,
  className,
}: PortfolioProps) {
  const [ownRange, setOwnRange] = React.useState(ranges[0]?.id)
  const rangeId = range ?? ownRange
  const setRange = (id: string) => (onRangeChange ? onRangeChange(id) : setOwnRange(id))
  const [hover, setHover] = React.useState<number | null>(null)
  const [hidden, setHidden] = React.useState(false)
  const [open, setOpen] = React.useState<string[]>([])
  const [showUnpriced, setShowUnpriced] = React.useState(false)

  const money = (v: number) =>
    hidden
      ? "••••"
      : v.toLocaleString(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const amount = (v: number) => (hidden ? "••••" : v.toLocaleString(locale, { maximumFractionDigits: v < 10 ? 4 : 2 }))
  const pct = (v: number) => `${(v * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

  const units = (h: PortfolioHolding) => h.networks.reduce((s, n) => s + n.amount, 0)
  const worth = (h: PortfolioHolding) => units(h) * (h.price ?? 0)
  const priced = holdings.filter((h) => h.price !== null).sort((a, b) => worth(b) - worth(a))
  const unpriced = holdings.filter((h) => h.price === null)
  const total = priced.reduce((s, h) => s + worth(h), 0)
  const share = (v: number) => v / (total || 1)
  const networks = new Set(holdings.flatMap((h) => h.networks.map((n) => n.name))).size

  const series = ranges.find((r) => r.id === rangeId) ?? ranges[0]
  const points = series.points
  const shown = hover === null ? total : points[hover].v
  const first = points[0]?.v ?? total
  const vs = points.map((p) => p.v)
  const pad = (Math.max(...vs) - Math.min(...vs)) * 0.08
  const lo = Math.min(...vs) - pad
  const hi = Math.max(...vs) + pad
  const ticks = scale(lo, hi)
  const delta = shown - first
  // The cents step back, so the dollars read first.
  const [whole, cents] = money(shown).split(/(?=[.,]\d{2}$)/)
  const time = (t: number) =>
    formatTime ? formatTime(t, series.id) : new Date(t).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
  const toggle = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((k) => k !== id) : [...o, id]))

  return (
    <Widget size={size} className={className}>
      <WidgetHeader>
        <WidgetTitle>{title}</WidgetTitle>
      </WidgetHeader>
      <WidgetPanel className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <Stat>
            <StatLabel className="flex items-center gap-1">
              Portfolio value
              <Toggle
                size="sm"
                aria-label="Hide amounts"
                pressed={hidden}
                onPressedChange={setHidden}
                className="-my-1.5 size-6 min-w-6 rounded-full p-0 text-faint-foreground aria-pressed:bg-transparent aria-pressed:text-foreground [&_svg:not([class*='size-'])]:size-3.5"
              >
                {hidden ? <EyeOffIcon /> : <EyeIcon />}
              </Toggle>
            </StatLabel>
            <StatValue>
              <span>
                {whole}
                {cents && <span className="text-muted-foreground">{cents}</span>}
              </span>
            </StatValue>
            <StatMeta>
              {!hidden && (
                <>
                  <span className={delta >= 0 ? "text-success" : undefined}>{delta >= 0 ? "▲" : "▼"}</span>{" "}
                  {delta >= 0 ? "+" : "−"}
                  {money(Math.abs(delta))} · {pct(Math.abs(delta) / (first || 1))} ·{" "}
                </>
              )}
              {hover === null ? series.label : time(points[hover].t)}
            </StatMeta>
          </Stat>
          <Segmented
            aria-label="Range"
            value={series.id}
            onValueChange={(v) => {
              setRange(v)
              setHover(null)
            }}
            className="self-start"
          >
            {ranges.map((r) => (
              <SegmentedItem key={r.id} value={r.id} className="px-2.5">
                {r.label}
              </SegmentedItem>
            ))}
          </Segmented>
        </div>

        <div className="flex flex-col gap-2">
          <ChartContainer config={chartConfig} className="aspect-auto h-44 w-full cursor-crosshair">
            <AreaChart
              data={points}
              margin={{ top: 6, right: 0, bottom: 6, left: 0 }}
              onMouseMove={(s) => setHover(s.activeTooltipIndex == null ? null : Number(s.activeTooltipIndex))}
              onMouseLeave={() => setHover(null)}
            >
              <defs>
                <linearGradient id="portfolio-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--color-v)" stopOpacity={0.08} />
                  <stop offset="1" stopColor="var(--color-v)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="2 3" />
              <XAxis dataKey="t" hide />
              <YAxis
                orientation="right"
                domain={[lo, hi]}
                ticks={ticks}
                axisLine={false}
                tickLine={false}
                width={hidden ? 0 : 64}
                tick={hidden ? false : { fontSize: 11 }}
                tickFormatter={(v: number) => v.toLocaleString(locale, { style: "currency", currency, maximumFractionDigits: 0 })}
              />
              {/* The number above is the tooltip: only the cursor shows here. */}
              <ChartTooltip cursor={{ strokeDasharray: "2 3" }} content={() => null} />
              <Area
                dataKey="v"
                type="monotone"
                stroke="var(--color-v)"
                strokeWidth={1.5}
                fill="url(#portfolio-fill)"
                isAnimationActive={false}
                activeDot={{ r: 3.5, fill: "var(--color-v)", stroke: "var(--card)", strokeWidth: 3 }}
              />
            </AreaChart>
          </ChartContainer>
          <div className={cn("flex justify-between eyebrow text-faint-foreground", !hidden && "pr-16")}>
            <span>{series.since}</span>
            <span>Now</span>
          </div>
        </div>

        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </WidgetPanel>

      <WidgetPanel className="flex flex-col gap-2 pt-3">
        <div className="flex items-baseline gap-2 px-1">
          <WidgetSectionTitle>Assets</WidgetSectionTitle>
          <span className="eyebrow text-muted-foreground">
            {holdings.length} assets · {networks} {networks === 1 ? "network" : "networks"}
          </span>
        </div>

        <Table>
          <TableHeader className="[&_tr]:border-border/70">
            <TableRow className="hover:bg-transparent">
              <TableHead className="eyebrow h-8 font-normal text-muted-foreground">Asset</TableHead>
              <TableHead className={cn("eyebrow h-8 text-right font-normal text-muted-foreground", WIDE)}>Price</TableHead>
              <TableHead className={cn("eyebrow h-8 text-right font-normal text-muted-foreground", WIDE)}>24h</TableHead>
              <TableHead className={cn("eyebrow h-8 text-right font-normal text-muted-foreground", WIDE)}>Balance</TableHead>
              <TableHead className="eyebrow h-8 text-right font-normal text-muted-foreground">Value</TableHead>
              <TableHead className={cn("eyebrow h-8 text-right font-normal text-muted-foreground", SHARE)}>Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {priced.map((h) => {
              const many = h.networks.length > 1
              const isOpen = open.includes(h.id)
              return (
                <React.Fragment key={h.id}>
                  <TableRow
                    onClick={many ? () => toggle(h.id) : undefined}
                    className={cn("border-border/70", many && "cursor-pointer", isOpen && "border-transparent")}
                  >
                    <TableCell className="w-full max-w-0 py-2.5 md:min-w-40">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <TokenAvatar symbol={h.symbol} image={h.image} network={many ? undefined : h.networks[0]?.image} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">{h.name}</span>
                          <span className="truncate eyebrow text-muted-foreground">
                            {h.symbol} · {many ? `${h.networks.length} networks` : h.networks[0]?.name}
                          </span>
                        </span>
                        {many && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`${h.name} by network`}
                            aria-expanded={isOpen}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggle(h.id)
                            }}
                            className="text-faint-foreground"
                          >
                            <ChevronRightIcon className={cn("transition-transform duration-200", isOpen && "rotate-90")} />
                          </Button>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", WIDE)}>{money(h.price ?? 0)}</TableCell>
                    <TableCell className={cn("text-right text-muted-foreground tabular-nums", WIDE)}>
                      {h.change === undefined ? "—" : `${h.change >= 0 ? "▲" : "▼"} ${pct(Math.abs(h.change))}`}
                    </TableCell>
                    <TableCell className={cn("text-right text-muted-foreground tabular-nums", WIDE)}>{amount(units(h))}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(worth(h))}</TableCell>
                    <TableCell className={cn("text-right", SHARE)}>
                      <Share value={share(worth(h))} label={pct(share(worth(h)))} />
                    </TableCell>
                  </TableRow>
                  {isOpen &&
                    h.networks.map((n, i) => (
                      <TableRow
                        key={n.id}
                        className={cn("hover:bg-transparent", i < h.networks.length - 1 ? "border-transparent" : "border-border/70")}
                      >
                        <TableCell className="py-1.5 pl-12">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            {n.image ? (
                              <img src={n.image} alt="" className="size-4 rounded-full" />
                            ) : (
                              <span className="size-1.5 rounded-full bg-faint-foreground" />
                            )}
                            {n.name}
                          </span>
                        </TableCell>
                        <TableCell className={WIDE} />
                        <TableCell className={WIDE} />
                        <TableCell className={cn("py-1.5 text-right text-muted-foreground tabular-nums", WIDE)}>{amount(n.amount)}</TableCell>
                        <TableCell className="py-1.5 text-right text-muted-foreground tabular-nums">{money(n.amount * (h.price ?? 0))}</TableCell>
                        <TableCell className={cn("py-1.5 text-right text-muted-foreground tabular-nums", SHARE)}>
                          {pct(share(n.amount * (h.price ?? 0)))}
                        </TableCell>
                      </TableRow>
                    ))}
                </React.Fragment>
              )
            })}
            {showUnpriced &&
              unpriced.map((h) => (
                <TableRow key={h.id} className="border-border/70 opacity-60 hover:bg-transparent">
                  <TableCell className="w-full max-w-0 py-2.5 md:min-w-40">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <TokenAvatar symbol={h.symbol} image={h.image} network={h.networks[0]?.image} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{h.name}</span>
                        <span className="truncate eyebrow text-muted-foreground">
                          {h.symbol} · {h.networks[0]?.name}
                        </span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className={cn("text-right eyebrow text-faint-foreground", WIDE)}>No price</TableCell>
                  <TableCell className={WIDE} />
                  <TableCell className={cn("text-right text-muted-foreground tabular-nums", WIDE)}>{amount(units(h))}</TableCell>
                  <TableCell className="text-right text-faint-foreground">—</TableCell>
                  <TableCell className={cn("text-right text-faint-foreground", SHARE)}>—</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

        {unpriced.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-1">
            <span className="eyebrow text-muted-foreground">
              {unpriced.length} {unpriced.length === 1 ? "token" : "tokens"} without a price, not counted
            </span>
            <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => setShowUnpriced((v) => !v)}>
              {showUnpriced ? "Hide" : "Show"}
            </Button>
          </div>
        )}
      </WidgetPanel>

      {meta && (
        <WidgetFooter>
          <WidgetMeta className="flex items-center gap-2">
            {live && <StatusDot tone="success" pulse />}
            {meta}
          </WidgetMeta>
        </WidgetFooter>
      )}
    </Widget>
  )
}

/** Allocation: a short bar beside the number; the number alone on phones. */
function Share({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex items-center justify-end gap-2">
      <span className={cn("h-1 w-10 overflow-hidden rounded-full bg-muted", WIDE)}>
        <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${Math.min(100, value * 100)}%` }} />
      </span>
      <span className="w-11 text-muted-foreground tabular-nums">{label}</span>
    </span>
  )
}
