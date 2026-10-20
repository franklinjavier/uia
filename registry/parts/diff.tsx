import * as React from "react"
import { FileCode2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ActionCard,
  ActionCardActions,
  ActionCardHeader,
  ActionCardPanel,
  ActionCardStatus,
  ActionCardTitle,
  ResolvedRow,
} from "@/components/parts/action-card"

// Diff: a code change waiting for review. What it does in a few plain
// lines first, then only the hunks that matter, file by file: additions
// on a faint success wash, removals on a faint destructive wash and
// struck through, so the change reads without colour-coding the whole
// card. The answers sit at the bottom (approve, send back). Once
// answered, pass `resolved` and it shrinks to a ResolvedRow.
//
//   <Diff title="T-583 · Chat client backend: session tokens" status="High risk"
//     summary={["Adds a session table and a login route."]}
//     files={[{ path: "src/auth/session.ts", lines: ["- const ttl = Infinity", "+ const ttl = 30 * DAY"] }]}
//     actions={[{ label: "Approve", onClick: approve },
//               { label: "Return with note", kind: "secondary", onClick: back }]} />

export type DiffFile = {
  path: string
  /** Lines as in a unified diff: "+ added", "- removed", anything else is context. */
  lines: string[]
}

export type DiffAction = {
  label: string
  kind?: "primary" | "secondary"
  onClick: () => void
}

function Diff({
  eyebrow,
  title,
  status,
  summary = [],
  files,
  actions = [],
  resolved,
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  /** Pill text, when the review waits on the person ("High risk"). */
  status?: string
  summary?: React.ReactNode[]
  files: DiffFile[]
  actions?: DiffAction[]
  /** Answered: one quiet row. `declined` dims it (sent back, rejected). */
  resolved?: {
    label: React.ReactNode
    summary: React.ReactNode
    declined?: boolean
  }
  className?: string
}) {
  if (resolved)
    return (
      <ResolvedRow
        icon={<FileCode2Icon />}
        label={resolved.label}
        summary={resolved.summary}
        muted={resolved.declined}
        className={className}
      />
    )
  return (
    <ActionCard className={className}>
      <ActionCardHeader>
        {eyebrow ? (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="eyebrow text-muted-foreground">{eyebrow}</span>
            <ActionCardTitle>{title}</ActionCardTitle>
          </div>
        ) : (
          <ActionCardTitle>{title}</ActionCardTitle>
        )}
        {status && (
          <ActionCardStatus tone="approval">{status}</ActionCardStatus>
        )}
      </ActionCardHeader>
      {summary.length > 0 && (
        <ul className="-mt-1 flex flex-col gap-1 text-muted-foreground">
          {summary.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-current" />
              {s}
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ActionCardPanel className="divide-y divide-border/70">
          {files.map((f) => (
            <div key={f.path} className="flex flex-col">
              <span className="flex items-center gap-1.5 px-3 pt-2.5 pb-1.5 font-mono text-xs text-muted-foreground">
                <FileCode2Icon className="size-3.5" />
                {f.path}
              </span>
              <pre className="overflow-x-auto px-3 pb-2.5 font-mono text-xs leading-5">
                {f.lines.map((l, i) => (
                  <span
                    key={i}
                    className={cn(
                      "block",
                      l.startsWith("+") && "bg-success/5 text-foreground",
                      l.startsWith("-") &&
                        "bg-destructive/5 text-muted-foreground line-through decoration-muted-foreground/40"
                    )}
                  >
                    {l}
                  </span>
                ))}
              </pre>
            </div>
          ))}
        </ActionCardPanel>
      )}
      {actions.length > 0 && (
        <ActionCardActions>
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
        </ActionCardActions>
      )}
    </ActionCard>
  )
}

export { Diff }
