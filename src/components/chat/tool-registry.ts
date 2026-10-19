import type * as React from "react"
import type { UIMessage } from "ai"

import type { AgentPhase } from "@/components/ds/agent-orb"

// The tool registry is how an app teaches the chat to render its tools.
// The chat kit knows text, reasoning and sources; every `tool-*` part is
// looked up here by name. Unknown tools fall back to a generic trace line.
//
//   const tools = defineTools<MyMessage>()({
//     webSearch: { phase: "searching", render: (part) => <ToolLine … /> },
//     askQuestions: { client: true, render: (part, ctx) => <AskUser … /> },
//   })
//   <AssistantTurn message={m} tools={tools} … />

export type ToolContext = {
  /** Submit a client-executed tool's result (an answer, a sent draft). */
  addOutput: (output: unknown) => void
  /** Answer an approval request (`approval-requested` parts). */
  respond: (approved: boolean) => void
  /** True while this turn is still streaming. */
  streaming: boolean
}

export type ToolDefinition<P = unknown> = {
  render: (part: P, ctx: ToolContext) => React.ReactNode
  /**
   * Client-executed: the person supplies the output (questions, drafts).
   * While such a part is `input-available` the chat waits on the person,
   * and supplying the output continues the turn automatically.
   */
  client?: boolean
  /** What the agent orb shows while this tool runs. Default "working". */
  phase?: AgentPhase
}

export type ToolRegistry = Record<string, ToolDefinition<never>>

/** Names of the typed tools carried by a message type. */
export type ToolNames<M extends UIMessage> =
  M["parts"][number] extends infer P
    ? P extends { type: `tool-${infer N}` }
      ? N
      : never
    : never

/** The part type of one tool, with its input/output types and states. */
export type ToolPartOf<M extends UIMessage, N extends string> = Extract<
  M["parts"][number],
  { type: `tool-${N}` }
>

/**
 * Type-safe registry for a message type: each renderer receives exactly its
 * tool's part (input, output and state narrowed).
 */
export function defineTools<M extends UIMessage>() {
  return <T extends { [N in ToolNames<M>]?: ToolDefinition<ToolPartOf<M, N>> }>(
    tools: T
  ) => tools as unknown as ToolRegistry
}
