import * as React from "react"
import type { ToolUIPart } from "ai"

import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"

// One tool call as a Trace line. Titles follow the AI Elements convention:
// present tense while running, past tense when done.
//
//   input-streaming / input-available → running   "Searching …"
//   output-available                  → done      "Searched the web"
//   output-error                      → error     "Search failed"
//   output-denied / denied response   → muted     "Search skipped"
//
// No icon: the verb names the tool, and every trace line (reasoning
// included) starts on the same column. Pass `children` to make a finished
// line expandable with its details (results, output…).

type Titles = { running: string; done: string; error: string; denied: string }

export function toolPhase(part: Pick<ToolUIPart, "state"> & { approval?: { approved?: boolean } }) {
  if (
    part.state === "output-denied" ||
    (part.state === "approval-responded" && part.approval?.approved === false)
  )
    return "denied" as const
  if (part.state === "output-error") return "error" as const
  if (part.state === "output-available") return "done" as const
  return "running" as const
}

export function ToolLine({
  part,
  titles,
  description,
  children,
}: {
  part: Pick<ToolUIPart, "state"> & { approval?: { approved?: boolean } }
  titles: Titles
  description?: React.ReactNode
  children?: React.ReactNode
}) {
  const phase = toolPhase(part)

  const line = (
    <TraceLine
      status={phase === "running" ? "running" : phase === "error" ? "error" : undefined}
    >
      <TraceTitle>{titles[phase]}</TraceTitle>
      {description && phase !== "running" && (
        <TraceDescription>{description}</TraceDescription>
      )}
    </TraceLine>
  )

  if (!children || phase !== "done") return line

  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent>{children}</TraceCollapsibleContent>
    </TraceCollapsible>
  )
}
