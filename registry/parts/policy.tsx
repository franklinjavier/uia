import * as React from "react"

import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import {
  Widget,
  WidgetHeader,
  WidgetList,
  WidgetListRow,
  WidgetPanel,
  WidgetTitle,
} from "@/components/ds/widget"

// Policy: a standing rule the agent applies on the person's behalf. A rule
// is a state, not an action, so it's a Switch, and the whole row is its
// label. The meta line says what kind of decision it covers and how often
// it fired; off, it says its effect instead ("Off · these come back to
// your inbox"). No confirmation: flipping it back undoes it.
//
//   <PolicyList title="Rules">
//     <Policy text="Auto-approve dependency bumps with green checks"
//       category="Reviews" applied={14} on={on} onToggle={setOn} />
//   </PolicyList>

export type PolicyLabels = {
  applied: (n: React.ReactNode) => React.ReactNode
  off: string
}

const EN: PolicyLabels = {
  applied: (n) => <>applied {n}×</>,
  off: "Off · these come back to your inbox",
}

function PolicyList({
  title,
  size = "default",
  className,
  children,
}: {
  title?: React.ReactNode
  size?: "default" | "sm"
  className?: string
  children: React.ReactNode
}) {
  return (
    <Widget size={size} className={className}>
      {title && (
        <WidgetHeader>
          <WidgetTitle>{title}</WidgetTitle>
        </WidgetHeader>
      )}
      <WidgetPanel className="flex flex-col pt-3">
        <WidgetList>{children}</WidgetList>
      </WidgetPanel>
    </Widget>
  )
}

function Policy({
  text,
  category,
  applied,
  on,
  onToggle,
  labels,
}: {
  text: React.ReactNode
  category?: React.ReactNode
  /** How many times it decided for the person. */
  applied?: number
  on: boolean
  /** Omit when the host can't change it here: the switch only shows the state. */
  onToggle?: (on: boolean) => void
  labels?: Partial<PolicyLabels>
}) {
  const l = { ...EN, ...labels }
  const id = React.useId()
  return (
    <WidgetListRow data-slot="policy" className="grid-cols-1 py-0">
      <label
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2.5",
          onToggle && "cursor-pointer"
        )}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span
            id={id}
            className={cn("transition-colors", !on && "text-muted-foreground")}
          >
            {text}
          </span>
          <span className="eyebrow text-muted-foreground">
            {on ? (
              <>
                {category}
                {category && applied !== undefined && " · "}
                {applied !== undefined &&
                  l.applied(<span className="tabular-nums">{applied}</span>)}
              </>
            ) : (
              <span className="text-foreground">{l.off}</span>
            )}
          </span>
        </span>
        <Switch
          aria-labelledby={id}
          checked={on}
          disabled={!onToggle}
          onCheckedChange={(next) => onToggle?.(next)}
          className="data-checked:border-brand data-checked:bg-brand"
        />
      </label>
    </WidgetListRow>
  )
}

export { Policy, PolicyList }
