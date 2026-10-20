import * as React from "react"
import { ScaleIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ActionCard,
  ActionCardActions,
  ActionCardDescription,
  ActionCardHeader,
  ActionCardStatus,
  ActionCardTitle,
} from "@/components/parts/action-card"

// DecisionCard: one decision the agent needs from the person, self-contained
// so it reads the same in an inbox, a page or a chat reply.
//
//   what (eyebrow + title) · why (context) · the options, the agent's pick
//   marked · what happens if you go with it · the buttons
//
// Actions are data ({ label, kind, onClick }), so a host — or an agent's
// spec — can describe them. "primary"/"secondary" answer the decision;
// "aside" opens something (the diff, a preview) and sits on the right.
// An urgent card glows (`urgent`); answering drains the glow before the
// callback runs, so the host can remove the card right after.
//
//   <DecisionCard agent="davinci" urgent
//     eyebrow="blog · Production incident" title="RSS returns 500 since v12"
//     context="Bisect points at 3f2a1c."
//     consequence="Revert through full gates; BLOG-4 goes back to build."
//     actions={[{ label: "Revert 3f2a1c", kind: "primary", onClick: revert },
//               { label: "Keep and investigate", kind: "secondary", onClick: keep }]} />

export type DecisionOption = { id: string; label: string; hint?: string }

export type DecisionAction = {
  label: string
  icon?: React.ReactNode
  /** primary/secondary answer the decision; aside opens something. */
  kind?: "primary" | "secondary" | "aside"
  onClick: () => void
}

export type DecisionLabels = {
  pick: string
  consequence: string
  irreversible: string
  agreement: (accepted: number, total: number, category?: string) => React.ReactNode
  makeRule: string
}

const DRAIN_MS = 320

function DecisionCard({
  agent = "the agent",
  eyebrow,
  title,
  context,
  options,
  pick,
  onChoose,
  consequence,
  actions = [],
  irreversible = false,
  urgent = false,
  agreement,
  onMakeRule,
  ruleThreshold = 0.9,
  labels: labelsIn,
  className,
}: {
  /** The agent's name, used in the default labels. */
  agent?: string
  eyebrow?: React.ReactNode
  title: React.ReactNode
  context?: React.ReactNode
  options?: DecisionOption[]
  /** The agent's suggested option id. */
  pick?: string
  onChoose?: (option: DecisionOption, isPick: boolean) => void
  /** What happens with the agent's pick, in one line. */
  consequence?: React.ReactNode
  actions?: DecisionAction[]
  /** Mark only the exception: most decisions can be undone. */
  irreversible?: boolean
  /** The one that can't wait: a warm glow until it's answered. */
  urgent?: boolean
  /** How often the person went with the agent's pick in this category. */
  agreement?: { accepted: number; total: number; category?: string }
  /** Offered once agreement reaches `ruleThreshold`. */
  onMakeRule?: () => void
  ruleThreshold?: number
  labels?: Partial<DecisionLabels>
  className?: string
}) {
  const labels: DecisionLabels = {
    pick: `${agent}'s pick`,
    consequence: `If you go with ${agent}:`,
    irreversible: "Irreversible",
    agreement: (a, t, c) => (
      <>
        You went with {agent}'s pick{" "}
        <span className="text-foreground tabular-nums">
          {a} of {t}
        </span>{" "}
        times{c ? ` in ${c.toLowerCase()}` : ""}.
      </>
    ),
    makeRule: "Make it a rule",
    ...labelsIn,
  }
  const [settling, setSettling] = React.useState(false)
  const settle = (then: () => void) => {
    setSettling(true)
    window.setTimeout(then, urgent ? DRAIN_MS : 0)
  }
  const ratio = agreement ? agreement.accepted / agreement.total : 0
  const answers = actions.filter((a) => a.kind !== "aside")
  const asides = actions.filter((a) => a.kind === "aside")

  return (
    <ActionCard data-slot="decision-card" tone={urgent && !settling ? "attention" : "default"} className={className}>
      <ActionCardHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          {eyebrow && <span className="eyebrow text-muted-foreground">{eyebrow}</span>}
          <ActionCardTitle>{title}</ActionCardTitle>
        </div>
        {irreversible && <ActionCardStatus tone="neutral">{labels.irreversible}</ActionCardStatus>}
      </ActionCardHeader>
      {context && <ActionCardDescription className="mt-0">{context}</ActionCardDescription>}

      {options && options.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {options.map((o, i) => {
            const isPick = o.id === pick
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => settle(() => onChoose?.(o, isPick))}
                className={cn(
                  "flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/30",
                  isPick ? "border-foreground/40" : "border-border/80"
                )}
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-muted eyebrow text-muted-foreground">
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-x-2">
                    {o.label}
                    {isPick && (
                      <span className="rounded-full bg-foreground/5 px-1.5 eyebrow text-muted-foreground">
                        {labels.pick}
                      </span>
                    )}
                  </span>
                  {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {consequence && (
        <p className="text-xs text-muted-foreground">
          <span className="text-foreground">{labels.consequence}</span> {consequence}
        </p>
      )}

      {actions.length > 0 && (
        <ActionCardActions className="flex-wrap">
          {answers.map((a) => (
            <Button
              key={a.label}
              size="sm"
              variant={a.kind === "secondary" ? "secondary" : "default"}
              onClick={() => settle(a.onClick)}
            >
              {a.icon}
              {a.label}
            </Button>
          ))}
          {asides.map((a, i) => (
            <Button key={a.label} size="sm" variant="ghost" className={cn(i === 0 && "ml-auto")} onClick={a.onClick}>
              {a.icon}
              {a.label}
            </Button>
          ))}
        </ActionCardActions>
      )}

      {/* Repeated agreement is a sign the decision shouldn't be theirs. */}
      {agreement && (
        <div className="-mx-3.5 -mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-b-2xl border-t border-border/70 bg-card/60 px-3.5 py-2.5 text-xs">
          <span className="text-muted-foreground">
            {labels.agreement(agreement.accepted, agreement.total, agreement.category)}
          </span>
          {onMakeRule && ratio >= ruleThreshold && (
            <Button size="xs" variant="outline" className="ml-auto rounded-full" onClick={() => settle(onMakeRule)}>
              <ScaleIcon />
              {labels.makeRule}
            </Button>
          )}
        </div>
      )}
    </ActionCard>
  )
}

export { DecisionCard }
