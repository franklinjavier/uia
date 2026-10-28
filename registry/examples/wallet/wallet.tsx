import * as React from "react"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import { ActivityIcon, ArrowLeftRightIcon, CheckIcon, CopyIcon, HouseIcon, ShieldCheckIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { springSoft } from "@/lib/motion"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AppNav, AppNavSelect, type AppNavItem } from "@/components/app/app-nav"
import { ThemeToggle } from "@/components/app/theme-toggle"
import { StatusBadge } from "@/components/ds/status"
import { Widget, WidgetPanel } from "@/components/ds/widget"
import { ResolvedRow } from "@/components/parts/action-card"
import { Confirmation } from "@/components/parts/confirmation"
import { DecisionChip } from "@/components/parts/decision-chip"
import { Portfolio, type PortfolioHolding } from "@/components/blocks/portfolio"
import { Swap, type SwapOrder, type SwapToken } from "@/components/blocks/swap"
import {
  ACCOUNT,
  ACTIVITY,
  APPROVALS,
  HOLDINGS,
  formatTime,
  ranges,
  type Approval,
  type Tx,
} from "@/examples/wallet/wallet-data"

// Wallet: a crypto wallet with an assistant, as a ready-to-use app. Home is
// the portfolio (value over time, assets by network) beside a swap; Swap,
// Activity and Approvals are their own routes. The assistant never moves
// funds on its own: what it wants to do (rebalance, claim) waits in
// Approvals next to what apps ask for (allowances), and Home shows them
// first. Every action changes the data: swaps move balances, land in
// Activity as pending and confirm a moment later.

export type View = "home" | "swap" | "activity" | "approvals"

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const usd = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD" })
const units = (h: PortfolioHolding) => h.networks.reduce((s, n) => s + n.amount, 0)
const clock = () => `Today ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`

/** Takes from the network holding the most, adds to the first one. */
function move(holdings: PortfolioHolding[], symbol: string, delta: number) {
  return holdings.map((h) => {
    if (h.symbol !== symbol) return h
    const at = delta < 0 ? h.networks.reduce((m, n, i, a) => (n.amount > a[m].amount ? i : m), 0) : 0
    return { ...h, networks: h.networks.map((n, i) => (i === at ? { ...n, amount: Math.max(0, n.amount + delta) } : n)) }
  })
}

function CopyAddress({ label }: { label?: string }) {
  const [done, setDone] = React.useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(ACCOUNT.address)
    setDone(true)
    window.setTimeout(() => setDone(false), 1600)
  }
  return label ? (
    <Button variant="secondary" size="sm" onClick={copy}>
      {done ? <CheckIcon /> : <CopyIcon />}
      {done ? "Address copied" : label}
    </Button>
  ) : (
    <Button variant="ghost" size="icon-xs" aria-label="Copy address" className="text-muted-foreground" onClick={copy}>
      {done ? <CheckIcon /> : <CopyIcon />}
    </Button>
  )
}

/**
 * Pass `view` and `onViewChange` to drive the view from your router (each
 * view is a route: /wallet, /wallet/swap, /wallet/activity, /wallet/approvals).
 */
export function Wallet({ view: viewIn, onViewChange }: { view?: View; onViewChange?: (v: View) => void }) {
  const [ownView, setOwnView] = React.useState<View>("home")
  const view = viewIn ?? ownView
  const go = (v: View) => (onViewChange ? onViewChange(v) : setOwnView(v))

  const [holdings, setHoldings] = React.useState(HOLDINGS)
  const [activity, setActivity] = React.useState<Tx[]>(ACTIVITY)
  const [answers, setAnswers] = React.useState<{ id: string; allowed: boolean }[]>([])
  const open = APPROVALS.filter((a) => !answers.some((x) => x.id === a.id))

  const total = holdings.reduce((s, h) => s + units(h) * (h.price ?? 0), 0)
  const history = React.useMemo(() => ranges(total), [total])
  const tokens: SwapToken[] = holdings
    .filter((h) => h.price !== null)
    .map((h) => ({
      symbol: h.symbol,
      name: h.name,
      price: h.price ?? 0,
      image: h.image,
      balance: units(h),
      network: [...h.networks].sort((a, b) => b.amount - a.amount)[0].name,
    }))

  /** Logs a transaction as pending; it confirms a moment later. */
  function record(tx: Omit<Tx, "id" | "time" | "status">) {
    const id = `t-${Date.now()}`
    setActivity((list) => [{ ...tx, id, time: clock(), status: "pending" }, ...list])
    window.setTimeout(() => setActivity((list) => list.map((t) => (t.id === id ? { ...t, status: "confirmed" } : t))), 3000)
  }

  function swap(o: SwapOrder) {
    return new Promise<void>((done) =>
      window.setTimeout(() => {
        setHoldings((hs) => move(move(hs, o.pay, -o.amount), o.receive, o.out))
        const t = tokens.find((x) => x.symbol === o.pay)
        record({
          kind: "Swap",
          what: `Swapped ${o.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${o.pay} for ${o.out.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${o.receive}`,
          network: t?.network ?? "Base",
          value: o.amount * (t?.price ?? 0),
        })
        done()
      }, 1400)
    )
  }

  function answer(a: Approval, allowed: boolean) {
    setAnswers((x) => [{ id: a.id, allowed }, ...x])
    if (!allowed) return
    if (a.id === "rebalance") {
      const eth = tokens.find((t) => t.symbol === "ETH")?.price ?? 0
      const out = 0.4 * eth * 0.9997
      setHoldings((hs) => move(move(hs, "ETH", -0.4), "USDC", out))
      record({ kind: "Swap", what: `Swapped 0.4 ETH for ${out.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC`, network: "Base", value: 0.4 * eth })
    }
    if (a.id === "allowance") record({ kind: "Approve", what: "Allowed app.swapr.xyz to spend 1,000 USDC", network: "Base" })
    if (a.id === "claim") {
      setHoldings((hs) => move(hs, "USDC", 42.1))
      record({ kind: "Claim", what: "Claimed 42.10 USDC in staking rewards", network: "Base", value: 42.1 })
    }
  }

  const nav: AppNavItem<View>[] = [
    { id: "home", label: "Home", icon: <HouseIcon />, nudge: "lift" },
    { id: "swap", label: "Swap", icon: <ArrowLeftRightIcon />, nudge: "weigh" },
    { id: "activity", label: "Activity", icon: <ActivityIcon />, nudge: "rewind", count: activity.filter((t) => t.status === "pending").length || undefined },
    { id: "approvals", label: "Approvals", icon: <ShieldCheckIcon />, nudge: "drop", count: open.length || undefined, attention: open.length > 0 },
  ]
  const brand = { name: "Coffer", phase: open.length ? ("waiting" as const) : ("idle" as const), active: open.length > 0, onHome: () => go("home") }

  return (
    <div data-slot="wallet" className="grid h-svh grid-cols-1 bg-background md:grid-cols-[14rem_minmax(0,1fr)]">
      <AppNav
        className="hidden border-r border-border/70 md:flex"
        brand={brand}
        items={nav}
        value={view}
        onValueChange={go}
        footer={
          <div className="flex items-center gap-2.5 pl-2">
            <Avatar size="sm">
              <AvatarFallback className="font-mono group-data-[size=sm]/avatar:text-[8px]">{ACCOUNT.address.slice(2, 4)}</AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm">{ACCOUNT.name}</span>
              <span className="truncate eyebrow text-faint-foreground">{short(ACCOUNT.address)}</span>
            </span>
            <span className="ml-auto flex items-center">
              <CopyAddress />
              <ThemeToggle />
            </span>
          </div>
        }
      />

      <main className="flex min-h-0 flex-col">
        <AppNavSelect className="md:hidden" brand={brand} items={nav} value={view} onValueChange={go} trailing={<ThemeToggle />} />

        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === "home" && (
            <div className="mx-auto flex w-full max-w-[76rem] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
              {open.length > 0 && (
                <section aria-label="Needs you" className="flex flex-col gap-2">
                  <h2 className="px-1 eyebrow text-muted-foreground">Needs you · {open.length}</h2>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                      {open.map((a) => (
                        <DecisionChip key={a.id} kind={a.kind} subject={a.subject} onClick={() => go("approvals")}>
                          {a.allowLabel}
                        </DecisionChip>
                      ))}
                    </AnimatePresence>
                  </div>
                </section>
              )}
              <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_24rem]">
                <Portfolio
                  holdings={holdings}
                  ranges={history}
                  formatTime={formatTime}
                  live
                  meta="Prices live · every 30 s"
                  actions={
                    <>
                      <CopyAddress label="Receive" />
                      <Button variant="secondary" size="sm" className="2xl:hidden" onClick={() => go("swap")}>
                        <ArrowLeftRightIcon /> Swap
                      </Button>
                    </>
                  }
                />
                <Swap tokens={tokens} pay="ETH" receive="USDC" route="Uniswap v3 · 0.05% pool" onSwap={swap} className="max-2xl:hidden" />
              </div>
            </div>
          )}

          {view === "swap" && (
            <div className="mx-auto w-full max-w-[28rem] px-4 py-6 sm:py-10">
              <Swap tokens={tokens} pay="ETH" receive="USDC" route="Uniswap v3 · 0.05% pool" onSwap={swap} />
            </div>
          )}

          {view === "activity" && <ActivityView activity={activity} />}

          {view === "approvals" && <ApprovalsView open={open} answers={answers} onAnswer={answer} />}
        </div>
      </main>
    </div>
  )
}

function ActivityView({ activity }: { activity: Tx[] }) {
  return (
    <div className="mx-auto flex w-full max-w-[56rem] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-1 px-1">
        <h1 className="text-xl tracking-[-0.01em]">Activity</h1>
        <p className="text-sm text-muted-foreground">
          {activity.length} transactions · {activity.filter((t) => t.status === "failed").length} failed
        </p>
      </div>
      <Widget>
        <WidgetPanel className="pt-3">
          <Table>
            <TableHeader className="[&_tr]:border-border/70">
              <TableRow className="hover:bg-transparent">
                <TableHead className="eyebrow h-8 font-normal text-muted-foreground max-sm:hidden">When</TableHead>
                <TableHead className="eyebrow h-8 font-normal text-muted-foreground">What</TableHead>
                <TableHead className="eyebrow h-8 text-right font-normal text-muted-foreground">Value</TableHead>
                <TableHead className="eyebrow h-8 text-right font-normal text-muted-foreground max-sm:hidden">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence initial={false}>
                {activity.map((t) => (
                  <motion.tr
                    key={t.id}
                    data-slot="table-row"
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={springSoft}
                    className="border-b border-border/70 transition-colors last:border-0 hover:bg-muted/50"
                  >
                    <TableCell className="eyebrow text-muted-foreground max-sm:hidden">{t.time}</TableCell>
                    <TableCell className="max-w-0 w-full py-2.5">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{t.what}</span>
                        <span className="truncate eyebrow text-muted-foreground">
                          {t.kind} · {t.network}
                          <span className="sm:hidden"> · {t.time}</span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", t.status === "failed" && "text-muted-foreground line-through")}>
                      {t.value === undefined ? "—" : t.kind === "Swap" ? usd(t.value) : `${t.value > 0 ? "+" : "−"}${usd(Math.abs(t.value))}`}
                    </TableCell>
                    <TableCell className="text-right max-sm:hidden">
                      {t.status === "confirmed" ? (
                        <span className="eyebrow text-faint-foreground">Confirmed</span>
                      ) : (
                        <StatusBadge tone={t.status === "failed" ? "destructive" : "neutral"}>
                          {t.status === "failed" ? "Failed" : "Pending"}
                        </StatusBadge>
                      )}
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </WidgetPanel>
      </Widget>
    </div>
  )
}

function ApprovalsView({
  open,
  answers,
  onAnswer,
}: {
  open: Approval[]
  answers: { id: string; allowed: boolean }[]
  onAnswer: (a: Approval, allowed: boolean) => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-1 px-1">
        <h1 className="text-xl tracking-[-0.01em]">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          {open.length ? `${open.length} waiting on you` : "Nothing waiting on you"} · nothing moves without your yes
        </p>
      </div>
      <LayoutGroup>
        <AnimatePresence mode="popLayout">
          {open.map((a) => (
            <motion.div
              key={a.id}
              layout="position"
              transition={springSoft}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
            >
              <Confirmation
                title={a.title}
                description={a.description}
                details={
                  <dl className="flex flex-col gap-1.5 text-sm">
                    {a.details.map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="text-right tabular-nums">{v}</dd>
                      </div>
                    ))}
                  </dl>
                }
                allowLabel={a.allowLabel}
                denyLabel={a.denyLabel}
                onAllow={() => onAnswer(a, true)}
                onDeny={() => onAnswer(a, false)}
              />
            </motion.div>
          ))}
          {answers.length > 0 && (
            <motion.section key="resolved" layout="position" transition={springSoft} className="flex flex-col gap-2">
              <h2 className="px-1 eyebrow text-muted-foreground">Answered today</h2>
              <AnimatePresence initial={false}>
                {answers.map((x) => {
                  const a = APPROVALS.find((p) => p.id === x.id)!
                  return (
                    <motion.div key={x.id} layout="position" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={springSoft}>
                      <ResolvedRow
                        icon={x.allowed ? <CheckIcon /> : <XIcon />}
                        label={`${a.kind} · ${a.subject}`}
                        summary={x.allowed ? a.allowed : a.denied}
                        muted={!x.allowed}
                      />
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </motion.section>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  )
}
