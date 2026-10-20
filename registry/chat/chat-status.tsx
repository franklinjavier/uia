import * as React from "react"

import { cn } from "@/lib/utils"
import { StatusDot, type Tone } from "@/components/ds/status"
import type { ChatState } from "@/components/chat/chat-state"

// One-line status of a conversation: a dot (attention when it waits on the
// person, ink while it streams) and a mono label.

const TONE: Record<ChatState, Tone> = {
  waiting: "attention",
  streaming: "brand",
  ready: "success",
  done: "success",
  error: "destructive",
}

const LABEL: Record<ChatState, string> = {
  waiting: "Waiting for you",
  streaming: "Streaming",
  ready: "Ready",
  done: "Done",
  error: "Something went wrong",
}

function ChatStatus({
  state,
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { state: ChatState }) {
  return (
    <span
      data-slot="chat-status"
      data-state={state}
      className={cn("flex min-w-0 items-center gap-2.5", className)}
      {...props}
    >
      <StatusDot tone={TONE[state]} pulse={state === "waiting"} />
      <span className="eyebrow truncate text-muted-foreground">{children ?? LABEL[state]}</span>
    </span>
  )
}

export { ChatStatus }
