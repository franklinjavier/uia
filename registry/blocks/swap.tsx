import * as React from "react"
import { ArrowDownIcon, ArrowRightIcon, CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Widget, WidgetHeader, WidgetPanel, WidgetTitle, type WidgetSize } from "@/components/ds/widget"

// Swap: trade one token for another, with the cost said before you commit.
//
//   YOU PAY · BASE                                     [50%] [Max]
//   1.25                                                  [ETH ▾]
//   ≈ $4,058.63                                    BALANCE 2.1 ETH
//                         (↓ flips the pair)
//   YOU RECEIVE · BASE
//   4,056.20                                             [USDC ▾]
//   ≈ $4,056.20                                 BALANCE 5,210.4 USDC
//   1 ETH = 3,246.2 USDC                          REFRESHES IN 12 S
//   Network cost · Fee · Price impact · Max slippage · At least · Route
//   [               Review swap →                ]   (all in one card)
//
// One verb at a time, full width: Review swap → (the quote freezes, the
// costs stand out) Edit · Swap 1.25 ETH for 4,053 USDC → Swapping… → Swapped. A pure view: tokens and
// costs in, `onSwap` out (return a promise; the button waits on it).

export type SwapToken = {
  symbol: string
  name: string
  /** Per unit, in the display currency. */
  price: number
  balance: number
  network: string
  /** The token's logo; its symbol stands in without one. */
  image?: string
}

export type SwapOrder = { pay: string; receive: string; amount: number; out: number; atLeast: number }

export type SwapProps = {
  tokens: SwapToken[]
  pay?: string
  receive?: string
  /** What the network charges for the swap, in the display currency. */
  networkCost?: number
  /** The wallet's own fee as a fraction; 0 says "None". */
  fee?: number
  /** Max slippage as a fraction. */
  slippage?: number
  /** How the order is filled ("Uniswap v3 · 0.05% pool"). */
  route?: string
  /** Seconds between quote refreshes. */
  refresh?: number
  onSwap?: (order: SwapOrder) => Promise<void> | void
  title?: React.ReactNode
  currency?: string
  locale?: string
  size?: WidgetSize
  className?: string
}

function Mark({ token, symbol }: { token?: SwapToken; symbol: string }) {
  return (
    <Avatar size="sm" className="size-5">
      {token?.image && <AvatarImage src={token.image} alt="" />}
      <AvatarFallback className="font-mono group-data-[size=sm]/avatar:text-[7px]">{symbol.slice(0, 3)}</AvatarFallback>
    </Avatar>
  )
}

function TokenSelect({
  tokens,
  value,
  onValueChange,
  disabled,
  label,
}: {
  tokens: SwapToken[]
  value: string
  onValueChange: (v: string) => void
  disabled?: boolean
  label: string
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onValueChange(v as string)} disabled={disabled}>
      <SelectTrigger aria-label={label} className="rounded-full pl-1.5">
        <SelectValue>
          {(v: string) => (
            <>
              <Mark token={tokens.find((t) => t.symbol === v)} symbol={v} />
              {v}
            </>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end" alignItemWithTrigger={false}>
        {tokens.map((t) => (
          <SelectItem key={t.symbol} value={t.symbol}>
            <Mark token={t} symbol={t.symbol} />
            {t.symbol}
            <span className="eyebrow text-muted-foreground">{t.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function Swap({
  tokens,
  pay: payIn,
  receive: receiveIn,
  networkCost = 0.03,
  fee = 0,
  slippage = 0.005,
  route,
  refresh = 15,
  onSwap,
  title = "Swap",
  currency = "USD",
  locale = "en-US",
  size,
  className,
}: SwapProps) {
  const [pay, setPay] = React.useState(payIn ?? tokens[0]?.symbol)
  const [receive, setReceive] = React.useState(receiveIn ?? tokens[1]?.symbol)
  const [text, setText] = React.useState("")
  const [step, setStep] = React.useState<"edit" | "review" | "swapping" | "done">("edit")
  const [left, setLeft] = React.useState(refresh)

  const from = tokens.find((t) => t.symbol === pay) ?? tokens[0]
  const to = tokens.find((t) => t.symbol === receive) ?? tokens[1]
  const amount = Number(text.replace(",", ".")) || 0
  const usd = amount * from.price
  // Bigger orders move the price more; a quiet stand-in for a real quote.
  const impact = Math.min(0.03, usd / 4_000_000)
  const out = ((usd * (1 - fee)) / to.price) * (1 - impact)
  const atLeast = out * (1 - slippage)
  const over = amount > from.balance
  const locked = step !== "edit"

  // The quote refreshes on a clock, and holds still while you review it.
  React.useEffect(() => {
    if (locked) return
    const t = window.setInterval(() => setLeft((s) => (s <= 1 ? refresh : s - 1)), 1000)
    return () => window.clearInterval(t)
  }, [locked, refresh])

  const money = (v: number) => v.toLocaleString(locale, { style: "currency", currency, maximumFractionDigits: 2 })
  const num = (v: number, max = 4) => v.toLocaleString(locale, { maximumFractionDigits: v >= 1000 ? 2 : max })
  const pct = (v: number) => `${(v * 100).toLocaleString(locale, { maximumFractionDigits: 2 })}%`

  const flip = () => {
    setPay(to.symbol)
    setReceive(from.symbol)
    setText(out ? String(Number(out.toFixed(4))) : "")
  }
  const pick = (side: "pay" | "receive", v: string) => {
    // Picking the other side's token swaps the pair instead of matching it.
    if (v === (side === "pay" ? receive : pay)) flip()
    else if (side === "pay") setPay(v)
    else setReceive(v)
  }
  const part = (k: number) => setText(String(Number((from.balance * k).toFixed(6))))

  async function confirm() {
    setStep("swapping")
    await onSwap?.({ pay: from.symbol, receive: to.symbol, amount, out, atLeast })
    setStep("done")
    window.setTimeout(() => {
      setStep("edit")
      setText("")
    }, 1800)
  }

  const details: [string, React.ReactNode][] = [
    ["Network cost", `${money(networkCost)} · paid in ${from.symbol}`],
    ["Fee", fee ? pct(fee) : "None"],
    ["Price impact", impact ? `−${pct(impact)}` : "—"],
    ["Max slippage", pct(slippage)],
    ["Receive at least", `${num(atLeast)} ${to.symbol}`],
    ...(route ? ([["Route", route]] as [string, React.ReactNode][]) : []),
  ]

  return (
    <Widget size={size} className={className}>
      <WidgetHeader>
        <WidgetTitle>{title}</WidgetTitle>
      </WidgetHeader>

      <WidgetPanel className="flex flex-col gap-1">
        <InputGroup className="h-auto flex-col items-stretch rounded-2xl p-1">
          <InputGroupAddon align="block-start" className="justify-between gap-2 pt-2">
            <span className="eyebrow font-normal text-muted-foreground">You pay · {from.network}</span>
            <span className="-my-1 flex items-center">
              <Button variant="ghost" size="xs" disabled={locked} onClick={() => part(0.5)}>
                50%
              </Button>
              <Button variant="ghost" size="xs" disabled={locked} onClick={() => part(1)}>
                Max
              </Button>
            </span>
          </InputGroupAddon>
          <div className="flex items-center gap-2 px-1.5">
            <InputGroupInput
              aria-label={`Amount of ${from.symbol}`}
              inputMode="decimal"
              placeholder="0"
              value={text}
              disabled={locked}
              aria-invalid={over || undefined}
              onChange={(e) => setText(e.target.value.replace(/[^\d.,]/g, ""))}
              className="h-12 px-1 text-3xl tracking-[-0.03em] tabular-nums md:text-3xl"
            />
            <TokenSelect tokens={tokens} value={from.symbol} onValueChange={(v) => pick("pay", v)} disabled={locked} label="Pay with" />
          </div>
          <InputGroupAddon align="block-end" className="justify-between gap-2 pb-2">
            <span className={cn("eyebrow font-normal tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>
              {over ? `More than you have` : `≈ ${money(usd)}`}
            </span>
            <span className="eyebrow font-normal text-muted-foreground tabular-nums">
              Balance {num(from.balance)} {from.symbol}
            </span>
          </InputGroupAddon>
        </InputGroup>

        <div className="relative z-10 -my-3 flex justify-center">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Flip"
            disabled={locked}
            onClick={flip}
            className="rounded-full bg-card shadow-xs"
          >
            <ArrowDownIcon />
          </Button>
        </div>

        <InputGroup className="h-auto flex-col items-stretch rounded-2xl p-1">
          <InputGroupAddon align="block-start" className="pt-2">
            <span className="eyebrow font-normal text-muted-foreground">You receive · {to.network}</span>
          </InputGroupAddon>
          <div className="flex items-center gap-2 px-1.5">
            <InputGroupInput
              aria-label={`Amount of ${to.symbol}`}
              readOnly
              tabIndex={-1}
              placeholder="0"
              value={out ? num(out) : ""}
              className="h-12 px-1 text-3xl tracking-[-0.03em] tabular-nums md:text-3xl"
            />
            <TokenSelect tokens={tokens} value={to.symbol} onValueChange={(v) => pick("receive", v)} disabled={locked} label="Receive" />
          </div>
          <InputGroupAddon align="block-end" className="justify-between gap-2 pb-2">
            <span className="eyebrow font-normal text-muted-foreground tabular-nums">≈ {money(out * to.price)}</span>
            <span className="eyebrow font-normal text-muted-foreground tabular-nums">
              Balance {num(to.balance)} {to.symbol}
            </span>
          </InputGroupAddon>
        </InputGroup>

        {/* The rate, and how fresh it is; it holds still while you review. */}
        <div className="flex items-center justify-between gap-3 px-1 pt-2 eyebrow text-muted-foreground tabular-nums">
          <span>
            1 {from.symbol} = {num(from.price / to.price)} {to.symbol}
          </span>
          <span className="text-faint-foreground">{locked ? "Quote held" : `Refreshes in ${left} s`}</span>
        </div>

        <dl
          className={cn(
            "mt-2 flex flex-col gap-1.5 rounded-xl px-1 py-2 text-xs transition-colors",
            step === "review" && "bg-muted/60 px-3"
          )}
        >
          {details.map(([k, v], i) => (
            <React.Fragment key={k}>
              {k === "Receive at least" && <Separator className="my-1 bg-border/70" />}
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className={cn("text-right tabular-nums", i === details.length - 1 && route && "truncate")}>{v}</dd>
              </div>
            </React.Fragment>
          ))}
        </dl>

        <div className="mt-3 flex gap-2">
          {step === "review" && (
            <Button variant="secondary" size="lg" onClick={() => setStep("edit")}>
              Edit
            </Button>
          )}
          {step === "edit" ? (
            <Button variant="brand" size="lg" className="flex-1" disabled={!amount || over} onClick={() => setStep("review")}>
              {over ? "Not enough " + from.symbol : amount ? "Review swap" : "Enter an amount"}
              {amount > 0 && !over && <ArrowRightIcon data-icon="inline-end" />}
            </Button>
          ) : (
            <Button variant="brand" size="lg" className="flex-1" disabled={step !== "review"} onClick={confirm}>
              {step === "swapping" ? (
                <>
                  <Spinner /> Swapping…
                </>
              ) : step === "done" ? (
                <>
                  <CheckIcon /> Swapped
                </>
              ) : (
                `Swap ${num(amount)} ${from.symbol} for ${num(out)} ${to.symbol}`
              )}
            </Button>
          )}
        </div>
      </WidgetPanel>
    </Widget>
  )
}
