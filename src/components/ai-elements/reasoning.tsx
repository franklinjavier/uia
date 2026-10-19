import * as React from "react"

import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"

// "Thinking" while it streams (open), "Thought 3s" once done (closed),
// unless the person toggled it. Duration is measured on the client.
export function Reasoning({ text, running }: { text: string; running: boolean }) {
  const [open, setOpen] = React.useState<boolean>()
  const startedAt = React.useRef<number | null>(null)
  const [duration, setDuration] = React.useState<number>()

  React.useEffect(() => {
    if (running && startedAt.current === null) startedAt.current = Date.now()
    if (!running && startedAt.current !== null && duration === undefined) {
      setDuration(Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)))
    }
  }, [running, duration])

  return (
    <TraceCollapsible open={open ?? running} onOpenChange={setOpen}>
      <TraceCollapsibleTrigger>
        <TraceLine status={running ? "running" : undefined}>
          {/* No icon: the agent orb beside it already says "thinking".
              Tool lines keep theirs because they name the tool. */}
          <TraceTitle>{running ? "Thinking" : "Thought"}</TraceTitle>
          {!running && duration !== undefined && (
            <TraceDescription>{duration}s</TraceDescription>
          )}
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent className="whitespace-pre-wrap">
        {text}
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}
