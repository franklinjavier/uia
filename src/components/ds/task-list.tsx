import * as React from "react"

import { cn } from "@/lib/utils"
import { StageTrack, StageTrackLabels, type StageStatus } from "@/components/ds/stage-track"
import { WidgetListRow } from "@/components/ds/widget"

// Task list: work moving through a fixed flow (Plan → Build → … → Main),
// one row per task, inside a WidgetList.
//
//   <div className="@container">            ← columns follow the list's own width
//     <WidgetList>
//       <TaskListHeader stages={labels} />  ← stage names once (+ counts when many)
//       {tasks.map((t) => <TaskRow key={t.id} {...t} onClick={…} />)}
//     </WidgetList>
//   </div>
//
// Wide: name · track · now, in three columns. Narrow: name · now on top,
// the track full width below, with the stage names over the list in the
// same grid. Sort with `taskRank` so what needs the person comes first.

export type TaskStage = { label: string; status: StageStatus }

const COLS =
  "grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-y-2.5 @xl:grid-cols-[minmax(8rem,1fr)_minmax(12rem,18rem)_minmax(6rem,8rem)]"

/** 0 needs the person (waiting/failed), 1 moving, 2 queued (nothing started). */
function taskRank(stages: StageStatus[]) {
  return stages.some((s) => s === "waiting" || s === "failed") ? 0 : stages.every((s) => s === "todo") ? 2 : 1
}

/** Index of the stage the task is at (the first not done). */
function taskStage(stages: StageStatus[]) {
  const i = stages.findIndex((s) => s !== "done")
  return i === -1 ? stages.length - 1 : i
}

function TaskListHeader({
  stages,
  taskLabel = "Task",
  nowLabel = "Now",
}: {
  /** Stage names; `count` per stage when the list is long. */
  stages: { label: string; count?: number }[]
  taskLabel?: string
  nowLabel?: string
}) {
  return (
    <>
      <div data-slot="task-list-header" className={cn("grid items-center gap-x-3 px-2 pb-2 @max-xl:hidden", COLS)}>
        <span className="eyebrow text-muted-foreground">{taskLabel}</span>
        <StageTrackLabels stages={stages} />
        <span className="text-right eyebrow text-muted-foreground">{nowLabel}</span>
      </div>
      {/* Narrow: the tracks span the row, so do the names. */}
      <StageTrackLabels className="px-2 pb-2 @xl:hidden" stages={stages} />
    </>
  )
}

function TaskRow({
  id,
  title,
  icon,
  stages,
  now,
  onClick,
  className,
}: {
  /** A short key in mono ("BLOG-5", "T-583"). */
  id: string
  title: React.ReactNode
  /** Who's on it (a ModelIcon, an avatar). */
  icon?: React.ReactNode
  stages: TaskStage[]
  /** Where it is, in words ("Your eye", "Building · 3 of 6"). */
  now: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  const needsYou = taskRank(stages.map((s) => s.status)) === 0
  return (
    <WidgetListRow data-slot="task-row" className={cn(COLS, className)} onClick={onClick}>
      <span className="flex min-w-0 items-center gap-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground">
        {icon}
        <span className="shrink-0 eyebrow text-muted-foreground">{id}</span>
        <span className="truncate">{title}</span>
      </span>
      <StageTrack className="order-last col-span-2 @xl:order-none @xl:col-span-1" stages={stages} />
      <span className={cn("truncate text-right text-xs", needsYou ? "text-foreground" : "text-muted-foreground")}>
        {now}
      </span>
    </WidgetListRow>
  )
}

export { TaskListHeader, TaskRow, taskRank, taskStage }
