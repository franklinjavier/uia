import * as React from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { springSoft } from "@/lib/motion"

// Stepper: where something is in a fixed sequence of stages, on one line.
// Dots joined by hairlines; each dot says its stage's state. In a list, put
// the stage names once, in a header that uses the same grid
// (`stepperGrid`), not under every track. A track that stands alone
// (a detail panel) names its own stages with `labeled`.
//
//   done     filled ink              the stage is behind us
//   active   ink ring, half filled   work is happening here
//   waiting  attention              it waits on the person
//   failed   destructive             it broke; see the detail
//   todo     hollow hairline         not reached yet

type StepStatus = "done" | "active" | "waiting" | "failed" | "todo"

const DOT: Record<StepStatus, string> = {
  done: "border-foreground bg-foreground",
  active: "border-foreground bg-[linear-gradient(90deg,var(--foreground)_50%,transparent_50%)]",
  waiting: "border-attention bg-attention",
  failed: "border-destructive bg-destructive",
  todo: "border-border bg-card",
}

const LABELS: Record<StepStatus, string> = {
  done: "done",
  active: "in progress",
  waiting: "waiting for you",
  failed: "failed",
  todo: "to do",
}

/** Grid template for a track with `n` stages; reuse it for the header. */
function stepperGrid(n: number) {
  return { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }
}

function Stepper({
  stages,
  statusLabels,
  labeled = false,
  className,
  ...props
}: Omit<React.ComponentProps<"ol">, "children"> & {
  stages: { label: string; status: StepStatus }[]
  /** Screen-reader words for each state, in the product's language. */
  statusLabels?: Partial<Record<StepStatus, string>>
  /** Stage names under the dots, for a track that stands alone. */
  labeled?: boolean
}) {
  const words = { ...LABELS, ...statusLabels }
  if (labeled) {
    return (
      <div data-slot="stepper-labeled" className={cn("flex flex-col gap-1.5", className)}>
        <Stepper stages={stages} statusLabels={statusLabels} {...props} />
        <StepperLabels stages={stages} />
      </div>
    )
  }
  return (
    <ol
      data-slot="stepper"
      className={cn("grid items-center", className)}
      style={stepperGrid(stages.length)}
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

/**
 * The stage names on the track's grid: a list header, or under a lone
 * track. The stage you're at (not done, not to do) reads in ink.
 */
function StepperLabels({
  stages,
  className,
}: {
  /** `count`: how many items sit at that stage, for a header over many tracks. */
  stages: { label: string; status?: StepStatus; count?: number }[]
  className?: string
}) {
  return (
    <div aria-hidden className={cn("grid", className)} style={stepperGrid(stages.length)}>
      {stages.map((s) => (
        <span
          key={s.label}
          className={cn(
            "flex min-w-0 flex-col text-xs",
            s.status && s.status !== "done" && s.status !== "todo" ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <span className="truncate">{s.label}</span>
          {s.count !== undefined && (
            <span className={cn("text-sm tabular-nums", s.count ? "text-foreground" : "text-faint-foreground")}>{s.count}</span>
          )}
        </span>
      ))}
    </div>
  )
}

export { Stepper, StepperLabels, stepperGrid, type StepStatus }
