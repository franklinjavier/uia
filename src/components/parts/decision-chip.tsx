import * as React from "react"
import { motion } from "motion/react"
import { ArrowUpRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { enter } from "@/lib/motion"

// DecisionChip: a pending decision, compact, for a strip of "needs you"
// items outside the conversation (dashboards, headers). It names the kind
// and the thing, says what is being asked in one line, and opens the full
// decision card (in the conversation) on click. The attention dot is the
// only colour: everything in the strip waits on the person.
//
//   <DecisionChip kind="Preview" subject="Loja" onClick={open}>
//     Aceitar a nova vitrine
//   </DecisionChip>

function DecisionChip({
  kind,
  subject,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof motion.button>, "children"> & {
  kind: string
  subject: string
  children: React.ReactNode
}) {
  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={enter}
      data-slot="decision-chip"
      className={cn(
        "group/chip flex min-w-0 flex-col gap-1.5 rounded-2xl border border-border/80 bg-card p-3.5 text-left shadow-xs outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30",
        className
      )}
      {...props}
    >
      <span className="flex items-center gap-2">
        <span className="size-1.5 shrink-0 rounded-full bg-attention" />
        <span className="eyebrow truncate text-muted-foreground">
          {kind} · {subject}
        </span>
        <ArrowUpRightIcon className="ml-auto size-3.5 shrink-0 text-muted-foreground transition-colors group-hover/chip:text-foreground" />
      </span>
      <span className="truncate text-sm">{children}</span>
    </motion.button>
  )
}

export { DecisionChip }
