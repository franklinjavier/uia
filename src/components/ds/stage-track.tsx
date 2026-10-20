import * as React from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { springSoft } from "@/lib/motion"

// StageTrack: where something is in a fixed sequence of stages, on one line.
// Dots joined by hairlines; each dot says its stage's state. Put the stage
// names once, in a header that uses the same grid (`stageTrackGrid`), not
// under every track.
//
//   done     filled ink              the stage is behind us
//   active   ink ring, half filled   work is happening here
//   waiting  attention              it waits on the person
//   failed   destructive             it broke; see the detail
//   todo     hollow hairline         not reached yet

type StageStatus = "done" | "active" | "waiting" | "failed" | "todo"

const DOT: Record<StageStatus, string> = {
  done: "border-foreground bg-foreground",
  active: "border-foreground bg-[linear-gradient(90deg,var(--foreground)_50%,transparent_50%)]",
  waiting: "border-attention bg-attention",
  failed: "border-destructive bg-destructive",
  todo: "border-border bg-card",
}

const LABELS: Record<StageStatus, string> = {
  done: "done",
  active: "in progress",
  waiting: "waiting for you",
  failed: "failed",
  todo: "to do",
}

/** Grid template for a track with `n` stages; reuse it for the header. */
function stageTrackGrid(n: number) {
  return { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }
}

function StageTrack({
  stages,
  statusLabels,
  className,
  ...props
}: Omit<React.ComponentProps<"ol">, "children"> & {
  stages: { label: string; status: StageStatus }[]
  /** Screen-reader words for each state, in the product's language. */
  statusLabels?: Partial<Record<StageStatus, string>>
}) {
  const words = { ...LABELS, ...statusLabels }
  return (
    <ol
      data-slot="stage-track"
      className={cn("grid items-center", className)}
      style={stageTrackGrid(stages.length)}
      {...props}
    >
      {stages.map((s, i) => {
        const next = stages[i + 1]
        return (
          <li
            key={s.label}
            data-status={s.status}
            aria-label={`${s.label}: ${words[s.status]}`}
            className="relative flex items-center"
          >
            <motion.span
              initial={false}
              animate={{ scale: s.status === "waiting" ? 1.15 : 1 }}
              transition={springSoft}
              className={cn("relative z-10 size-2.5 shrink-0 rounded-full border transition-colors duration-300", DOT[s.status])}
            />
            {next && (
              <span
                className={cn(
                  "h-px flex-1 transition-colors duration-300",
                  s.status === "done" ? "bg-foreground/40" : "bg-border"
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

export { StageTrack, stageTrackGrid, type StageStatus }
