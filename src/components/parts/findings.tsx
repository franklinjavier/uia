import * as React from "react"

import { cn } from "@/lib/utils"
import { Widget, WidgetHeader, WidgetList, WidgetListRow, WidgetPanel, WidgetTitle } from "@/components/ds/widget"

// Findings: what the agent pulled out of a source, ranked, each pointing
// back to where it came from. Severity is a three-bar signal (the only
// colour: high reads destructive, medium attention, low muted); the
// reference ("P. 12", "L. 40", "03:12") sits right, in mono, so the person
// can check the claim. A Widget at size="sm" with a WidgetList: the same
// shell and rows as any list on a page.
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
    <Widget size="sm" data-slot="findings" className={cn("not-typeset", className)}>
      <WidgetHeader>
        {icon}
        <WidgetTitle className="min-w-0 truncate">{title}</WidgetTitle>
      </WidgetHeader>
      <WidgetPanel className="py-1.5">
        <WidgetList>
          {items.map((f) => (
            <WidgetListRow key={f.text} className="grid-cols-[auto_minmax(0,1fr)_auto]">
              <SeveritySignal severity={f.severity} />
              <span className="text-pretty">{f.text}</span>
              {f.ref ? <span className="eyebrow text-faint-foreground">{f.ref}</span> : <span />}
            </WidgetListRow>
          ))}
        </WidgetList>
      </WidgetPanel>
    </Widget>
  )
}

export { Findings, SeveritySignal }
