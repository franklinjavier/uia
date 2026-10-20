import * as React from "react"
import { motion } from "motion/react"
import {
  AlertTriangleIcon,
  CheckIcon,
  CircleDotIcon,
  XIcon,
} from "lucide-react"

import { enter } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Stepper, type StepStatus } from "@/components/ds/stepper"
import { StatusBadge } from "@/components/ds/status"
import {
  ActionCardFields,
  ActionCardNote,
  ActionCardPanel,
  ResolvedRow,
} from "@/components/parts/action-card"

// StatusCard: a state the person should know about, with the steps it went
// through and what comes next — an incident (detected → reverted →
// healthy), a deploy, a migration. One line says where it is (title + a
// toned pill), the stepper shows how far along, the fields hold the
// specifics, the note says what happens next. Actions are optional: most
// states are just read. Once it's over, pass `resolved` and the card
// shrinks to a ResolvedRow (wrap it in PartTransition to animate that).
//
//   <StatusCard eyebrow="blog · Incident" title="RSS returns 500 since v12"
//     tone="warning" status="Reverting"
//     steps={[{ label: "Detected", status: "done" },
//             { label: "Reverted", status: "active" },
//             { label: "Healthy", status: "todo" }]}
//     note="BLOG-4 goes back to build once the check is green." />

export type StatusCardTone = "neutral" | "success" | "warning" | "destructive"

export type StatusCardAction = {
  label: string
  kind?: "primary" | "secondary"
  onClick: () => void
}

const RESOLVED_ICON: Record<StatusCardTone, React.ReactNode> = {
  neutral: <CircleDotIcon />,
  success: <CheckIcon />,
  warning: <AlertTriangleIcon />,
  destructive: <XIcon />,
}

function StatusCard({
  eyebrow,
  title,
  tone = "neutral",
  status,
  steps,
  fields,
  note,
  actions = [],
  resolved,
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  /** The state's tone: neutral → warning → destructive; success when it's fine again. */
  tone?: StatusCardTone
  /** Pill text: where it is now ("Reverting", "Healthy"). */
  status?: string
  steps: { label: string; status: StepStatus }[]
  fields?: { label: string; value: React.ReactNode }[]
  /** What happens next, in one line. */
  note?: React.ReactNode
  actions?: StatusCardAction[]
  /** Settled: the card becomes one quiet row. */
  resolved?: { label: React.ReactNode; summary: React.ReactNode }
  className?: string
}) {
  if (resolved)
    return (
      <ResolvedRow
        icon={RESOLVED_ICON[tone]}
        label={resolved.label}
        summary={resolved.summary}
        className={className}
      />
    )
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={enter}
      data-slot="status-card"
      data-tone={tone}
      className={cn(
        "not-typeset flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 text-sm shadow-xs",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {eyebrow && (
            <span className="eyebrow text-muted-foreground">{eyebrow}</span>
          )}
          <span className="text-[15px] leading-6 tracking-[-0.01em] text-pretty">
            {title}
          </span>
        </div>
        {status && (
          <StatusBadge tone={tone} className="mt-0.5">
            {status}
          </StatusBadge>
        )}
      </div>

      {steps.length > 0 && <Stepper stages={steps} labeled />}

      {fields && fields.length > 0 && (
        <ActionCardPanel>
          <ActionCardFields size="sm" fields={fields} />
        </ActionCardPanel>
      )}

      {note && <ActionCardNote>{note}</ActionCardNote>}

      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((a) => (
            <Button
              key={a.label}
              size="sm"
              variant={a.kind === "secondary" ? "secondary" : "default"}
              onClick={a.onClick}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </motion.div>
  )
}

export { StatusCard }
