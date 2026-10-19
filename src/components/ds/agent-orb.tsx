import { ThinkingOrb, type OrbState } from "thinking-orbs"

import { cn } from "@/lib/utils"

// The assistant's presence. One phase per thing the agent can be doing, each
// mapped to a thinking-orbs state. Monochrome on purpose: the attention
// colour stays the only hue, and the dotted ink matches the eyebrow/tick
// language.
//
// Only the active turn animates (`active`); past turns hold a still frame,
// so the moving orb always marks who is speaking now.

export type AgentPhase =
  | "idle" // nothing in flight
  | "connecting" // request sent, no token yet
  | "thinking" // reasoning streams
  | "searching" // a search tool runs
  | "working" // any other tool runs
  | "composing" // answer text streams
  | "waiting" // paused on the person (question, draft, approval)

const STATE: Record<AgentPhase, OrbState> = {
  idle: "breathing",
  connecting: "connecting",
  thinking: "solving",
  searching: "searching",
  working: "working",
  composing: "composing",
  waiting: "listening",
}

const LABEL: Record<AgentPhase, string> = {
  idle: "Assistant",
  connecting: "Assistant is connecting",
  thinking: "Assistant is thinking",
  searching: "Assistant is searching",
  working: "Assistant is working",
  composing: "Assistant is writing",
  waiting: "Assistant is waiting for you",
}

export function AgentOrb({
  phase = "idle",
  size = 20,
  active = true,
  className,
}: {
  phase?: AgentPhase
  size?: 20 | 32 | 64
  active?: boolean
  className?: string
}) {
  return (
    <ThinkingOrb
      data-slot="agent-orb"
      data-phase={phase}
      state={STATE[phase]}
      size={size}
      paused={!active}
      aria-label={LABEL[phase]}
      className={cn("shrink-0", !active && "opacity-60", className)}
    />
  )
}
