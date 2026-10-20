import * as React from "react"
import { motion, type TargetAndTransition } from "motion/react"

import { cn } from "@/lib/utils"
import { AgentOrb, type AgentPhase } from "@/components/ds/agent-orb"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// AppNav: the side navigation of an agent app (see example-davinci).
//
//   ◌ davinci            brand: the agent's orb + name; click = home
//   Inbox          6     counts: faint, `attention` only where the person is needed
//   THREADS              sections from `item.section`
//   ◌ blog               `agent: true` items are conversations: the still orb,
//                        waking on hover
//   Projects
//   ───────────────
//   footer slot          digest time, theme toggle, simulation switches
//
// Each icon has one small hover gesture (`nudge`) that says what the place
// is, played once per hover. Phones get <AppNavSelect> in the header
// instead: the orb (home), a select with the same items, a trailing slot.

export type AppNavNudge = "drop" | "lift" | "rewind" | "weigh"

const NUDGE: Record<AppNavNudge, TargetAndTransition> = {
  drop: { y: [0, 2, 0] },
  lift: { y: [0, -2, 0], scale: [1, 1.06, 1] },
  rewind: { rotate: [0, -40, 0] },
  weigh: { rotate: [0, -10, 7, 0] },
}

export type AppNavItem<T extends string = string> = {
  id: T
  label: string
  icon?: React.ReactNode
  /** A conversation with the agent: the orb is its icon. */
  agent?: boolean
  nudge?: AppNavNudge
  count?: number
  /** The count needs the person (orange). */
  attention?: boolean
  /** Section header shown above the first item of each section. */
  section?: string
}

export type AppNavBrand = {
  name: string
  phase?: AgentPhase
  active?: boolean
  onHome?: () => void
}

function OrbIcon({ live }: { live: boolean }) {
  return (
    <span className="flex size-4 items-center justify-center">
      <AgentOrb active={live} className="scale-90 opacity-100" />
    </span>
  )
}

function AppNav<T extends string>({
  brand,
  items,
  value,
  onValueChange,
  footer,
  className,
}: {
  brand: AppNavBrand
  items: AppNavItem<T>[]
  value: T
  onValueChange: (id: T) => void
  footer?: React.ReactNode
  className?: string
}) {
  const [hovered, setHovered] = React.useState<T | null>(null)
  return (
    <nav data-slot="app-nav" className={cn("flex min-h-0 flex-col gap-1 p-3", className)}>
      <button
        type="button"
        onClick={brand.onHome}
        className="flex h-11 items-center gap-2.5 rounded-xl px-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <AgentOrb phase={brand.phase ?? "idle"} active={brand.active ?? false} />
        <span className="text-[15px]">{brand.name}</span>
      </button>
      {items.map((n, i) => (
        <React.Fragment key={n.id}>
          {n.section && n.section !== items[i - 1]?.section && (
            <div className="mt-3 px-2 pb-1 eyebrow text-faint-foreground">{n.section}</div>
          )}
          <motion.button
            type="button"
            onClick={() => onValueChange(n.id)}
            initial="rest"
            animate="rest"
            whileHover="hover"
            onHoverStart={() => setHovered(n.id)}
            onHoverEnd={() => setHovered(null)}
            aria-current={value === n.id ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-2.5 rounded-xl px-2 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30",
              value === n.id && "bg-muted text-foreground"
            )}
          >
            <motion.span
              variants={{ rest: { y: 0, scale: 1, rotate: 0 }, hover: n.nudge ? NUDGE[n.nudge] : {} }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex size-4 items-center justify-center [&>svg]:size-4"
            >
              {n.agent ? <OrbIcon live={hovered === n.id} /> : n.icon}
            </motion.span>
            <span className="truncate">{n.label}</span>
            {n.count !== undefined && (
              <span className={cn("ml-auto eyebrow tabular-nums", n.attention ? "text-attention" : "text-faint-foreground")}>
                {n.count}
              </span>
            )}
          </motion.button>
        </React.Fragment>
      ))}
      {footer && <div className="mt-auto flex flex-col gap-2">{footer}</div>}
    </nav>
  )
}

/** Phones: orb (home) · a select with the same items · a trailing slot. */
function AppNavSelect<T extends string>({
  brand,
  items,
  value,
  onValueChange,
  trailing,
  className,
}: {
  brand: AppNavBrand
  items: AppNavItem<T>[]
  value: T
  onValueChange: (id: T) => void
  trailing?: React.ReactNode
  className?: string
}) {
  const label = (v: T) => items.find((n) => n.id === v)?.label
  return (
    <header data-slot="app-nav-select" className={cn("flex h-14 shrink-0 items-center gap-2.5 border-b border-border/70 px-4", className)}>
      <button
        type="button"
        aria-label={brand.name}
        onClick={brand.onHome}
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <AgentOrb phase={brand.phase ?? "idle"} active={brand.active ?? false} />
      </button>
      <Select value={value} onValueChange={(v) => v && onValueChange(v as T)}>
        <SelectTrigger aria-label="View" className="ml-auto">
          <SelectValue>{(v: T) => label(v)}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false}>
          {items.map((n) => (
            <SelectItem key={n.id} value={n.id}>
              {n.label}
              {n.count !== undefined ? ` · ${n.count}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {trailing}
    </header>
  )
}

export { AppNav, AppNavSelect }
