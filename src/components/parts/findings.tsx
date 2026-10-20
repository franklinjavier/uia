import * as React from "react"

import { cn } from "@/lib/utils"

// Findings: what the agent pulled out of a source, ranked, each pointing
// back to where it came from. Severity is a three-bar signal (the only
// colour: high reads destructive, medium attention, low muted); the
// reference ("P. 12", "L. 40", "03:12") sits right, in mono, so the person
// can check the claim.
//
//   <Findings title="Risks in q3-board-deck.pdf" icon={<FileBadge name="q3-board-deck.pdf" />}
//     items={[{ text: "Two enterprise renewals slipped to Q4", severity: "high", ref: "P. 12" }]} />

export type Severity = "high" | "medium" | "low"
export type Finding = { text: string; severity: Severity; ref?: string }

const LEVEL: Record<Severity, number> = { high: 3, medium: 2, low: 1 }
const TONE: Record<Severity, string> = {
  high: "text-destructive",
  medium: "text-attention",
  low: "text-muted-foreground",
}
const WORD: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" }

function SeveritySignal({ severity }: { severity: Severity }) {
  const level = LEVEL[severity]
  return (
    <span role="img" aria-label={`${WORD[severity]} severity`} className={cn("flex h-3 shrink-0 items-end gap-[2px]", TONE[severity])}>
      {[0.45, 0.72, 1].map((h, i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-[1px]", i < level ? "bg-current" : "bg-current/20")}
          style={{ height: `${h * 100}%` }}
        />
      ))}
    </span>
  )
}

function Findings({
  title,
  icon,
  items,
  className,
}: {
  title: React.ReactNode
  icon?: React.ReactNode
  items: Finding[]
  className?: string
}) {
  return (
    <div data-slot="findings" className={cn("not-typeset overflow-hidden rounded-2xl border border-border/70 bg-card text-sm", className)}>
      <div className="flex items-center gap-2 px-3.5 pt-3 pb-2.5">
        {icon}
        <span className="min-w-0 truncate font-medium">{title}</span>
      </div>
      <ul className="border-t border-border/70">
        {items.map((f) => (
          <li
            key={f.text}
            className="relative flex items-center gap-3 px-3.5 py-2.5 before:absolute before:inset-x-3.5 before:top-0 before:h-px before:bg-border/70 first:before:hidden"
          >
            <SeveritySignal severity={f.severity} />
            <span className="min-w-0 flex-1 text-pretty">{f.text}</span>
            {f.ref && <span className="shrink-0 eyebrow text-faint-foreground">{f.ref}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export { Findings, SeveritySignal }
