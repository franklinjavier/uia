import { getToolName, isToolUIPart, type UIMessage } from "ai"

import type { AgentPhase } from "@/components/ds/agent-orb"
import type { ToolRegistry } from "@/components/chat/tool-registry"

// Pure reads of a transcript. No React here, so they are easy to reuse in
// tests, servers or other UIs.

type Part = UIMessage["parts"][number]

function toolParts(message?: UIMessage) {
  if (!message || message.role !== "assistant") return []
  return message.parts.filter(isToolUIPart)
}

/** The turn is paused on the person: an open client tool or an approval. */
export function isWaitingOnUser(message: UIMessage | undefined, tools: ToolRegistry) {
  return toolParts(message).some(
    (p) =>
      p.state === "approval-requested" ||
      (p.state === "input-available" && tools[getToolName(p)]?.client === true)
  )
}

/**
 * The person just supplied a client tool's output. Used to continue the turn
 * automatically; server tools that finish in-stream must not re-trigger.
 */
export function answeredClientTool(message: UIMessage | undefined, tools: ToolRegistry) {
  return toolParts(message).some(
    (p) => p.state === "output-available" && tools[getToolName(p)]?.client === true
  )
}

/** What the agent is doing right now, read from the trailing part. */
export function agentPhase(
  status: string,
  waiting: boolean,
  last: UIMessage | undefined,
  tools: ToolRegistry
): AgentPhase {
  if (waiting) return "waiting"
  if (status === "submitted") return "connecting"
  if (status !== "streaming") return "idle"
  if (!last || last.role !== "assistant") return "connecting"

  const part = [...last.parts]
    .reverse()
    .find((p: Part) => p.type !== "step-start" && p.type !== "source-url")
  if (!part) return "connecting"
  if (part.type === "reasoning") return part.state === "streaming" ? "thinking" : "composing"
  if (isToolUIPart(part)) {
    return part.state === "output-available"
      ? "composing"
      : (tools[getToolName(part)]?.phase ?? "working")
  }
  return "composing"
}

export type ChatState = "streaming" | "waiting" | "ready" | "done" | "error"
