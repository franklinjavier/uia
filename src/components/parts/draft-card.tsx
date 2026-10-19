import * as React from "react"
import {
  AtSignIcon,
  CheckIcon,
  CopyIcon,
  LockIcon,
  MailIcon,
  NewspaperIcon,
  Trash2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  ActionCard,
  ActionCardActions,
  ActionCardFields,
  ActionCardHeader,
  ActionCardNote,
  ActionCardPanel,
  ActionCardStatus,
  ActionCardTitle,
  ResolvedRow,
} from "@/components/parts/action-card"

// Anything that goes out under the person's name: an email, a post, a
// thread. The fields and verbs come with the draft, so one card serves
// every channel.
export type Draft = {
  kind: string // "New email", "New thread"…
  app: string // where it goes out: "Mail", "Blog", "X"
  icon: "mail" | "blog" | "thread"
  title: string // subject / post title
  fields: { label: string; value: string }[]
  summary: string // who/where, for the resolved row: "Beta list · 1,284 people"
  body: string
  sendLabel: string // "Send email", "Post thread"…
  sentVerb: string // "Sent email", "Posted thread"…
}

const ICONS = { mail: MailIcon, blog: NewspaperIcon, thread: AtSignIcon }

// A consequential draft is the approval: reviewed and edited in place, and
// nothing goes out until the person presses the send action. Once resolved
// it shrinks to a summary that can reopen, compactly, to show what went out.
export function DraftCard({
  draft,
  state,
  sentBody,
  onSend,
  onDiscard,
  className,
}: {
  draft: Draft
  className?: string
  state: "ready" | "sent" | "discarded"
  /** The body as it actually went out (with the person's edits). */
  sentBody?: string
  onSend: (body: string) => void
  onDiscard: () => void
}) {
  const [body, setBody] = React.useState(draft.body)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(t)
  }, [copied])

  if (state !== "ready") {
    return (
      <DraftCardResolved
        className={className}
        draft={draft}
        discarded={state === "discarded"}
        body={sentBody ?? draft.body}
      />
    )
  }

  return (
    <ActionCard className={className}>
      <ActionCardHeader>
        <ActionCardTitle>{draft.kind}</ActionCardTitle>
        <div className="-mr-1 flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={copied ? "Copied" : "Copy draft"}
            className="text-muted-foreground"
            onClick={() =>
              navigator.clipboard
                ?.writeText(body)
                .then(() => setCopied(true))
                .catch(() => {})
            }
          >
            {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
          </Button>
          <ActionCardStatus tone="ready">Ready</ActionCardStatus>
        </div>
      </ActionCardHeader>

      <ActionCardPanel>
        <ActionCardFields fields={draft.fields} />
        <textarea
          aria-label="Draft body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="field-sizing-content block max-h-64 min-h-24 w-full resize-none border-t border-border/70 bg-transparent px-3 py-3 leading-6 outline-none focus-visible:bg-muted/30"
        />
      </ActionCardPanel>

      <ActionCardNote icon={<LockIcon />}>
        Nothing goes out until you press {draft.sendLabel}. It can't be undone.
      </ActionCardNote>

      <ActionCardActions>
        <Button size="sm" onClick={() => onSend(body)}>
          {draft.sendLabel}
        </Button>
        <Button size="sm" variant="secondary" onClick={onDiscard}>
          Discard
        </Button>
      </ActionCardActions>
    </ActionCard>
  )
}

// Resolved: a ResolvedRow that reopens to show exactly what went out.
// Discarded drafts dim and swap the app icon for a bin.
export function DraftCardResolved({
  draft,
  discarded,
  body,
  className,
}: {
  draft: Draft
  discarded: boolean
  body: string
  className?: string
}) {
  const Icon = discarded ? Trash2Icon : ICONS[draft.icon]
  return (
    <ResolvedRow
      icon={<Icon />}
      label={draft.app}
      summary={`${discarded ? "Discarded draft" : draft.sentVerb} · ${draft.summary}`}
      muted={discarded}
      className={className}
    >
      <p className="pt-1 font-medium">{draft.title}</p>
      {/* -mx-3 cancels the fields' own inset so labels align with the title */}
      <div className="-mx-3">
        <ActionCardFields size="sm" fields={draft.fields} />
      </div>
      <p className="border-t border-border/70 pt-2.5 text-[13px] leading-5 whitespace-pre-wrap text-foreground/85">
        {body}
      </p>
    </ResolvedRow>
  )
}
