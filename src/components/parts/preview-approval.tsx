import * as React from "react"
import { EyeIcon, ExternalLinkIcon, LockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  ActionCard,
  ActionCardActions,
  ActionCardDescription,
  ActionCardHeader,
  ActionCardNote,
  ActionCardPanel,
  ActionCardStatus,
  ActionCardTitle,
  ResolvedRow,
} from "@/components/parts/action-card"

// PreviewApproval: a visual change waits for the person's eye before it
// ships. Shows before/after (or any pair of previews), a link to the live
// preview, and two answers: accept, or ask for a change in words. Asking
// for a change is an answer too — the agent continues with the note.
//
//   <PreviewApproval
//     title="Bottega quer publicar a nova vitrine da Loja"
//     before={<img …/>} after={<img …/>} href="https://…"
//     onAccept={() => …} onRequestChanges={(note) => …}
//   />

type Labels = {
  status: string
  before: string
  after: string
  open: string
  accept: string
  requestChanges: string
  send: string
  cancel: string
  placeholder: string
}

const EN: Labels = {
  status: "Needs your eye",
  before: "Before",
  after: "After",
  open: "Open preview",
  accept: "Accept and publish",
  requestChanges: "Ask for changes",
  send: "Send",
  cancel: "Cancel",
  placeholder: "What should change?",
}

export function PreviewApproval({
  title,
  description,
  before,
  after,
  href,
  note,
  labels,
  onAccept,
  onRequestChanges,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  before: React.ReactNode
  after: React.ReactNode
  href?: string
  note?: React.ReactNode
  labels?: Partial<Labels>
  onAccept: () => void
  onRequestChanges: (note: string) => void
  className?: string
}) {
  const l = { ...EN, ...labels }
  const [asking, setAsking] = React.useState(false)
  const [text, setText] = React.useState("")

  return (
    <ActionCard className={className}>
      <ActionCardHeader>
        <ActionCardTitle>{title}</ActionCardTitle>
        <ActionCardStatus tone="approval">{l.status}</ActionCardStatus>
      </ActionCardHeader>
      {description && <ActionCardDescription>{description}</ActionCardDescription>}

      <ActionCardPanel className="grid grid-cols-2 gap-px bg-border/70">
        {[
          { label: l.before, view: before },
          { label: l.after, view: after },
        ].map((side) => (
          <figure key={side.label} className="flex flex-col gap-2 bg-card p-2.5">
            <figcaption className="eyebrow text-muted-foreground">{side.label}</figcaption>
            <div className="aspect-[4/3] overflow-hidden rounded-lg border border-border/70 bg-background">
              {side.view}
            </div>
          </figure>
        ))}
      </ActionCardPanel>

      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="-mt-1 flex w-fit items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLinkIcon className="size-3.5" />
          {l.open}
        </a>
      )}

      {note && <ActionCardNote icon={<LockIcon />}>{note}</ActionCardNote>}

      {asking ? (
        <div className="flex flex-col gap-2">
          <Textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={l.placeholder}
            className="min-h-16 rounded-xl bg-card text-sm"
          />
          <ActionCardActions>
            <Button size="sm" disabled={!text.trim()} onClick={() => onRequestChanges(text.trim())}>
              {l.send}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
              {l.cancel}
            </Button>
          </ActionCardActions>
        </div>
      ) : (
        <ActionCardActions>
          <Button size="sm" onClick={onAccept}>
            {l.accept}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAsking(true)}>
            {l.requestChanges}
          </Button>
        </ActionCardActions>
      )}
    </ActionCard>
  )
}

/** The settled record: accepted (and what happened) or changes requested. */
export function PreviewApprovalResolved({
  label,
  accepted,
  summary,
  note,
  className,
}: {
  label: React.ReactNode
  accepted: boolean
  summary: React.ReactNode
  /** The change that was asked for, shown when the row expands. */
  note?: string
  className?: string
}) {
  return (
    <ResolvedRow icon={<EyeIcon />} label={label} summary={summary} muted={!accepted} className={className}>
      {note ? <p className="text-muted-foreground">“{note}”</p> : undefined}
    </ResolvedRow>
  )
}
