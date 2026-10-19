import { useChat, type UseChatOptions } from "@ai-sdk/react"
import {
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai"

import {
  agentPhase,
  answeredClientTool,
  isWaitingOnUser,
  type ChatState,
} from "@/components/chat/chat-state"
import type { ToolRegistry } from "@/components/chat/tool-registry"

// useChat plus what every agent UI needs to know about it: is it busy, is it
// waiting on the person, what is the agent doing, which turn is live.
// Continues the turn automatically after a client tool answer or an
// approval, and never after a server tool that finished in-stream.
export function useAgentChat<M extends UIMessage>({
  tools = {},
  ...options
}: UseChatOptions<M> & { tools?: ToolRegistry }) {
  const chat = useChat<M>({
    sendAutomaticallyWhen: (o) =>
      (answeredClientTool(o.messages.at(-1), tools) &&
        lastAssistantMessageIsCompleteWithToolCalls(o)) ||
      lastAssistantMessageIsCompleteWithApprovalResponses(o),
    ...options,
  } as UseChatOptions<M>)

  const busy = chat.status === "submitted" || chat.status === "streaming"
  const last = chat.messages.at(-1)
  const waiting = !busy && isWaitingOnUser(last, tools)
  const phase = agentPhase(chat.status, waiting, last, tools)
  /** The live turn: the last assistant message while it streams or waits. */
  const activeIndex =
    (busy || waiting) && last?.role === "assistant" ? chat.messages.length - 1 : -1
  const state: ChatState =
    chat.status === "error" ? "error" : busy ? "streaming" : waiting ? "waiting" : "ready"

  return { ...chat, tools, busy, waiting, phase, activeIndex, state }
}

export type AgentChat<M extends UIMessage> = ReturnType<typeof useAgentChat<M>>
