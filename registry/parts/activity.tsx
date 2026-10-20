import * as React from "react"
import { Undo2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Widget,
  WidgetHeader,
  WidgetList,
  WidgetListRow,
  WidgetPanel,
  WidgetTitle,
} from "@/components/ds/widget"

// Activity: what the agent did for the person without asking, each entry
// with why — the trust surface. One row per action: the time (mono), the
// subject and what was done, the reason muted under it (and the rule that
// did it, fainter), and on the right Undo while it can still be undone or
// "Final" when it can't. Whether it can be undone comes from the host,
// never from the agent. Undone rows dim and say so.
//
//   <ActivityList title="Decided for you">
//     <ActivityItem time="08:52" subject="blog" what="Reverted 3f2a1c"
//       why="The production check failed twice" rule="Revert failed deploys"
//       onUndo={() => undo("d-1")} />
//     <ActivityItem time="08:40" subject="bottega" what="Merged T-580" why="All gates green" />
//   </ActivityList>

export type ActivityLabels = {
  undo: string
  undone: string
  final: string
  rule: string
}

const EN: ActivityLabels = {
  undo: "Undo",
  undone: "Undone",
  final: "Final",
  rule: "rule",
}

function ActivityList({
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

function ActivityItem({
  time,
  subject,
  what,
  why,
  rule,
  undone = false,
  onUndo,
  labels,
}: {
  /** When it happened, already in the product's format ("08:52"). */
  time: React.ReactNode
  /** What it was about (a project, an account), before the action. */
  subject?: React.ReactNode
  what: React.ReactNode
  why?: React.ReactNode
  /** The standing rule that made the call, if one did. */
  rule?: string
  undone?: boolean
  /** Omit when it can't be undone: the row says "Final". */
  onUndo?: () => void
  labels?: Partial<ActivityLabels>
}) {
  const l = { ...EN, ...labels }
  return (
    <WidgetListRow
      data-slot="activity-item"
      className="grid-cols-[3rem_minmax(0,1fr)_auto] items-start"
      dimmed={undone}
    >
      <span className="pt-0.5 eyebrow text-muted-foreground tabular-nums">
        {time}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span>
          {subject && (
            <span className="text-muted-foreground">{subject} · </span>
          )}
          {what}
        </span>
        {(why || rule) && (
          <span className="text-xs text-muted-foreground">
            {why}
            {rule && (
              <span className="text-faint-foreground">
                {why ? " · " : ""}
                {l.rule}: {rule.toLowerCase()}
              </span>
            )}
          </span>
        )}
      </span>
      {undone ? (
        <span className="pt-0.5 eyebrow text-muted-foreground">{l.undone}</span>
      ) : onUndo ? (
        <Button
          size="xs"
          variant="ghost"
          className="text-muted-foreground"
          onClick={onUndo}
        >
          <Undo2Icon />
          {l.undo}
        </Button>
      ) : (
        <span className="pt-0.5 eyebrow text-faint-foreground">{l.final}</span>
      )}
    </WidgetListRow>
  )
}

export { ActivityItem, ActivityList }
