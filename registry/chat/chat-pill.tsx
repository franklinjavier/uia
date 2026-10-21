import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { enter } from "@/lib/motion"
import { AgentOrb, type AgentPhase } from "@/components/ds/agent-orb"

// ChatPill: the assistant, minimised. The work keeps going; the pill keeps
// saying what it's doing (the orb always moves — breathing when idle — and
// the eyebrow names the phase) so the person can look away without losing
// track. When the agent waits on them
// the "Open" tag turns `attention`. Click anywhere to bring the panel back.
//
//   {minimised ? <ChatPill phase={chat.phase} onOpen={() => setMinimised(false)} /> : <Panel … />}
//
// Give it the same `layoutId` as the panel and it morphs into it on open
// (and back on minimise) inside a motion `LayoutGroup`.

const STATUS: Record<AgentPhase, string> = {
  idle: "Ready",
  connecting: "Starting",
  thinking: "Thinking",
  searching: "Searching",
  working: "Working",
  composing: "Writing",
  waiting: "Needs you",
}

function ChatPill({
  name = "Assistant",
  phase = "idle",
  status,
  onOpen,
  layoutId,
  className,
}: {
  name?: string
  phase?: AgentPhase
  /** Override the phase word ("3 of 4 steps"). */
  status?: string
  onOpen: () => void
  /** Shared with the panel it opens into, so one morphs into the other. */
  layoutId?: string
  className?: string
}) {
  const busy = phase !== "idle"
  const waiting = phase === "waiting"
  return (
    <motion.button
      type="button"
      data-slot="chat-pill"
      data-phase={phase}
      onClick={onOpen}
      layoutId={layoutId}
      // Set in style (not a class) so motion corrects it while morphing.
      style={{ borderRadius: 28 }}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={enter}
      aria-label={`Open ${name}`}
      className={cn(
        "flex h-14 items-center gap-3 border border-border bg-card py-2 pr-2.5 pl-2.5 text-left shadow-[0_12px_40px_-14px_rgb(0_0_0/0.18)] dark:shadow-[0_12px_40px_-14px_rgb(0_0_0/0.6)] outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/30",
        className
      )}
    >
      <AgentOrb phase={phase} size={32} />
      <span className="flex min-w-0 flex-col pr-2">
        <span className="text-sm">{name}</span>
        <span className={cn("eyebrow", busy && !waiting ? "shimmer text-muted-foreground" : "text-muted-foreground")}>
          {status ?? STATUS[phase]}
        </span>
      </span>
      <span
        className={cn(
          "ml-auto rounded-full px-2 py-1 eyebrow transition-colors",
          waiting ? "bg-attention/10 text-attention" : "bg-muted text-muted-foreground"
        )}
      >
        Open
      </span>
    </motion.button>
  )
}

export { ChatPill }
