import * as React from "react"
import { motion } from "motion/react"
import { ChevronRightIcon, ChevronsUpDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { enter, springSoft } from "@/lib/motion"
import { Spinner } from "@/components/ui/spinner"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

// ActionCard: the one shape every human-in-the-loop moment takes.
//
//   ActionCard
//   ├─ ActionCardHeader     who wants to do what  ·  ActionCardStatus
//   ├─ ActionCardDescription  one or two muted lines
//   ├─ ActionCardDisclosure   "Show the …" → details on demand
//   ├─ ActionCardPanel        inset surface: fields, lists, editable body
//   ├─ ActionCardNote         trust fine print
//   └─ ActionCardActions      primary (default) · secondary · tertiary (ghost, right)
//
// Pending cards ask; resolved cards shrink to a status and stop asking.

function ActionCard({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) {
  return (
    // Appears where it lands. No layout animation: the transcript moves
    // under it while text streams and scroll anchors, and animating that
    // makes the card fly in from above.
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={enter}
      data-slot="action-card"
      className={cn(
        "not-typeset flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/60 p-3.5 text-sm shadow-xs dark:bg-accent/50",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
}

function ActionCardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="action-card-header"
      className={cn("flex min-h-6 items-start justify-between gap-3", className)}
      {...props}
    />
  )
}

function ActionCardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="action-card-title"
      className={cn("min-w-0 pt-0.5 font-medium text-pretty", className)}
      {...props}
    />
  )
}

const STATUS = {
  approval: "bg-attention/10 text-attention",
  action: "bg-attention/10 text-attention",
  ready: "bg-foreground/5 text-muted-foreground",
  done: "bg-success/10 text-success",
  error: "bg-destructive/10 text-destructive",
  neutral: "bg-foreground/5 text-muted-foreground",
} as const

export type ActionStatus = keyof typeof STATUS

function ActionCardStatus({
  tone,
  className,
  children,
}: {
  tone: ActionStatus
  className?: string
  children: React.ReactNode
}) {
  const waiting = tone === "approval" || tone === "action"
  return (
    <motion.span
      key={tone}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springSoft}
      data-slot="action-card-status"
      data-tone={tone}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs whitespace-nowrap",
        STATUS[tone],
        className
      )}
    >
      {waiting ? (
        <Spinner className="size-3" />
      ) : (
        <span className="size-1.5 rounded-full bg-current" />
      )}
      {children}
    </motion.span>
  )
}

function ActionCardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="action-card-description"
      className={cn("-mt-2 text-pretty text-muted-foreground", className)}
      {...props}
    />
  )
}

function ActionCardDisclosure({
  show,
  hide,
  defaultOpen = false,
  children,
}: {
  show: string
  hide: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="-mt-1 flex flex-col">
      <CollapsibleTrigger className="group/disclosure flex w-fit items-center gap-1 rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30">
        <ChevronRightIcon className="size-3.5 transition-transform duration-200 group-aria-expanded/disclosure:rotate-90" />
        {open ? hide : show}
      </CollapsibleTrigger>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
        <div className="pt-2.5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ActionCardPanel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="action-card-panel"
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-card",
        className
      )}
      {...props}
    />
  )
}

function ActionCardFields({
  fields,
  size = "default",
}: {
  fields: { label: string; value: React.ReactNode }[]
  size?: "default" | "sm"
}) {
  return (
    <dl
      data-slot="action-card-fields"
      data-size={size}
      className="divide-y divide-border/70 data-[size=sm]:text-xs"
    >
      {fields.map((f) => (
        <div
          key={f.label}
          className="grid grid-cols-[4.5rem_1fr] items-baseline gap-3 px-3 py-2 in-data-[size=sm]:py-1.5"
        >
          <dt className="text-muted-foreground">{f.label}</dt>
          <dd className="min-w-0 truncate">{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function ActionCardNote({
  icon,
  className,
  children,
}: {
  icon?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <p
      data-slot="action-card-note"
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0",
        className
      )}
    >
      {icon}
      {children}
    </p>
  )
}

function ActionCardActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="action-card-actions"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  )
}

// ResolvedRow: what every human-in-the-loop moment becomes once settled
// (answered, sent, approved, discarded, denied). One quiet line —
// icon · label · what happened — that expands in place to show the record.
// `muted` dims it for moments that did not go ahead (discarded, denied).
function ResolvedRow({
  icon,
  label,
  summary,
  muted = false,
  className,
  children,
}: {
  icon: React.ReactNode
  label: React.ReactNode
  summary: React.ReactNode
  muted?: boolean
  className?: string
  /** Details shown when the row expands. Omit for a static row. */
  children?: React.ReactNode
}) {
  const head = (
    <>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted text-muted-foreground [&_svg]:size-3.5">
        {icon}
      </span>
      <span className="shrink-0 font-medium">{label}</span>
      <span className="min-w-0 truncate text-muted-foreground">{summary}</span>
    </>
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: muted ? 0.6 : 1 }}
      transition={enter}
      data-slot="resolved-row"
      data-muted={muted || undefined}
      className={cn(
        "not-typeset rounded-2xl border border-border/80 bg-card text-sm shadow-xs data-muted:shadow-none",
        className
      )}
    >
      {children ? (
        <Collapsible>
          <CollapsibleTrigger className="group/resolved flex w-full min-w-0 items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
            {head}
            <ChevronsUpDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground transition-colors group-hover/resolved:text-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
            <div className="flex flex-col gap-2 px-3.5 pb-3.5">{children}</div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <div className="flex min-w-0 items-center gap-2.5 px-3 py-2.5">{head}</div>
      )}
    </motion.div>
  )
}

// A resolved moment, recorded quietly in the transcript.
function TranscriptEvent({
  icon,
  className,
  children,
}: {
  icon?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={enter}
      data-slot="transcript-event"
      className={cn(
        "not-typeset flex items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground [&_svg]:size-3.5",
        className
      )}
    >
      {icon}
      {children}
    </motion.div>
  )
}

export {
  ActionCard,
  ActionCardActions,
  ActionCardDescription,
  ActionCardDisclosure,
  ActionCardFields,
  ActionCardHeader,
  ActionCardNote,
  ActionCardPanel,
  ActionCardStatus,
  ActionCardTitle,
  ResolvedRow,
  TranscriptEvent,
}
