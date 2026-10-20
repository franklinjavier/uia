import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { CheckIcon, SparklesIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { springSnappy } from "@/lib/motion"
import { Spinner } from "@/components/ui/spinner"
import { TickMeter } from "@/components/ds/tick-meter"
import { ActionCard, ActionCardHeader, ActionCardTitle } from "@/components/parts/action-card"

// Plan: a multi-step job the agent runs in front of you. The steps are the
// promise ("here's what I'll do"); each one checks off as it lands, the
// running one spins, and the tick meter fills with them.
//
//   <Plan title="Weekly metrics digest" steps={[
//     { label: "Create saved query", status: "done" },
//     { label: "Schedule for Mondays 09:00", status: "running" },
//     { label: "Post to #product via Slack", status: "todo" },
//   ]} />
//
// A step that needs the person (a connection, an approval) is `waiting`:
// the meter and that step turn `attention` until it moves.

export type PlanStepStatus = "todo" | "running" | "waiting" | "done" | "failed"
export type PlanStep = { label: string; status: PlanStepStatus; detail?: string }

function StepMark({ status }: { status: PlanStepStatus }) {
  return (
    <span className="relative flex size-4 shrink-0 items-center justify-center">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={status}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={springSnappy}
          className="flex size-4 items-center justify-center"
        >
          {status === "done" ? (
            <span className="flex size-4 items-center justify-center rounded-full bg-success text-background">
              <CheckIcon className="size-2.5" strokeWidth={3.5} />
            </span>
          ) : status === "failed" ? (
            <span className="flex size-4 items-center justify-center rounded-full bg-destructive text-background">
              <XIcon className="size-2.5" strokeWidth={3.5} />
            </span>
          ) : status === "running" ? (
            <Spinner className="size-3.5 text-muted-foreground" />
          ) : status === "waiting" ? (
            <span className="size-2 rounded-full bg-attention" />
          ) : (
            <span className="size-3.5 rounded-full border border-border" />
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function Plan({
  title,
  steps,
  icon = <SparklesIcon />,
  className,
}: {
  title: React.ReactNode
  steps: PlanStep[]
  icon?: React.ReactNode
  className?: string
}) {
  const done = steps.filter((s) => s.status === "done").length
  const waiting = steps.some((s) => s.status === "waiting")
  const failed = steps.some((s) => s.status === "failed")

  return (
    <ActionCard data-slot="plan" className={cn("gap-0 p-0", className)}>
      <ActionCardHeader className="items-center px-3.5 pt-3 pb-2.5">
        <span className="flex min-w-0 items-center gap-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground">
          {icon}
          <ActionCardTitle className="truncate pt-0">{title}</ActionCardTitle>
        </span>
        <span className="eyebrow text-muted-foreground tabular-nums">
          {done}/{steps.length}
        </span>
      </ActionCardHeader>
      <div className="border-t border-border/70 px-3.5 pt-3 pb-3.5">
        <TickMeter
          value={steps.length ? done / steps.length : 0}
          ticks={64}
          className={cn(
            "transition-colors duration-300",
            failed ? "text-destructive" : waiting ? "text-attention" : done === steps.length ? "text-success" : "text-brand"
          )}
        />
        <ol className="mt-3 flex flex-col gap-2">
          {steps.map((s) => (
            <li key={s.label} data-status={s.status} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5">
                <StepMark status={s.status} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span
                  className={cn(
                    "transition-colors duration-300",
                    s.status === "todo" ? "text-muted-foreground" : "text-foreground",
                    s.status === "running" && "shimmer"
                  )}
                >
                  {s.label}
                </span>
                {s.detail && <span className="text-xs text-muted-foreground">{s.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </ActionCard>
  )
}

export { Plan }
