import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  ActionCard,
  ActionCardActions,
  ActionCardDescription,
  ActionCardDisclosure,
  ActionCardHeader,
  ActionCardNote,
  ActionCardPanel,
  ActionCardStatus,
  ActionCardTitle,
} from "@/components/parts/action-card"

// Approval gate before a tool with side effects runs (AI SDK
// `approval-requested`). A ready-made composition of ActionCard parts:
// for a different layout, compose ActionCard* directly. Title states who wants to do what; details hide
// behind a disclosure; Allow is the primary action, Deny always available.
export function Confirmation({
  title,
  description,
  details,
  detailsLabel = "details",
  note,
  onAllow,
  onAlwaysAllow,
  onDeny,
  allowLabel = "Allow",
  denyLabel = "Deny",
  status = "Approval needed",
  className,
  children,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  details?: React.ReactNode
  detailsLabel?: string
  note?: React.ReactNode
  onAllow: () => void
  onAlwaysAllow?: () => void
  onDeny: () => void
  /** Verb for the primary action ("Create issues", "Fazer rollback"). */
  allowLabel?: string
  denyLabel?: string
  /** Status pill text. */
  status?: string
  className?: string
  /** Extra content between the details and the actions. */
  children?: React.ReactNode
}) {
  return (
    <ActionCard className={className}>
      <ActionCardHeader>
        <ActionCardTitle>{title}</ActionCardTitle>
        <ActionCardStatus tone="approval">{status}</ActionCardStatus>
      </ActionCardHeader>
      {description && <ActionCardDescription>{description}</ActionCardDescription>}
      {details && (
        <ActionCardDisclosure show={`Show the ${detailsLabel}`} hide={`Hide the ${detailsLabel}`}>
          <ActionCardPanel>{details}</ActionCardPanel>
        </ActionCardDisclosure>
      )}
      {children}
      {note && <ActionCardNote>{note}</ActionCardNote>}
      <ActionCardActions>
        <Button size="sm" onClick={onAllow}>
          {allowLabel}
        </Button>
        {onAlwaysAllow && (
          <Button size="sm" variant="secondary" onClick={onAlwaysAllow}>
            Always allow
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={onDeny}>
          {denyLabel}
        </Button>
      </ActionCardActions>
    </ActionCard>
  )
}
