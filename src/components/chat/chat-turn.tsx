import * as React from "react"
import { getToolName, isToolUIPart, type UIMessage } from "ai"

import { cn } from "@/lib/utils"
import { getMessageText } from "@/lib/ai"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageAvatar, MessageContent } from "@/components/ui/message"
import { Trace } from "@/components/ui/trace"
import { Markdown } from "@/components/parts/markdown"
import { Reasoning } from "@/components/parts/reasoning"
import { SourcesGrid } from "@/components/parts/sources"
import { ToolLine } from "@/components/parts/tool-line"
import { AgentOrb, type AgentPhase } from "@/components/ds/agent-orb"
import { TurnActions } from "@/components/chat/turn-actions"
import type { ToolContext, ToolRegistry } from "@/components/chat/tool-registry"

// Turns of a conversation.
//
//   <ChatTurn>       picks UserTurn or AssistantTurn by role
//   <UserTurn>       right-aligned muted bubble
//   <AssistantTurn>  orb avatar · <ChatParts> · turn actions
//   <ChatParts>      just the parts, for custom turn chrome
//
// Text, reasoning and sources render here; every tool part is looked up in
// the `tools` registry (see tool-registry.ts).

export type ToolHandlers = {
  onToolOutput?: (tool: string, toolCallId: string, output: unknown) => void
  onApproval?: (approvalId: string, approved: boolean) => void
}

function UserTurn({
  message,
  className,
  ...props
}: React.ComponentProps<typeof Message> & { message: UIMessage }) {
  return (
    <Message data-slot="user-turn" align="end" className={className} {...props}>
      <MessageContent>
        <Bubble align="end" variant="muted">
          <BubbleContent>{getMessageText(message)}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

function ChatParts({
  message,
  tools = {},
  streaming = false,
  onToolOutput,
  onApproval,
}: ToolHandlers & { message: UIMessage; tools?: ToolRegistry; streaming?: boolean }) {
  const sources = message.parts.flatMap((p) =>
    p.type === "source-url" ? [{ url: p.url, title: p.title }] : []
  )
  const firstSource = message.parts.findIndex((p) => p.type === "source-url")

  return message.parts.map((part, index) => {
    if (part.type === "text") {
      return part.text.trim() ? <Markdown key={index}>{part.text}</Markdown> : null
    }
    if (part.type === "reasoning") {
      return (
        <Trace key={index}>
          <Reasoning text={part.text} running={streaming && part.state === "streaming"} />
        </Trace>
      )
    }
    if (part.type === "source-url") {
      return index === firstSource ? <SourcesGrid key={index} sources={sources} /> : null
    }
    if (!isToolUIPart(part)) return null

    const name = getToolName(part)
    const tool = tools[name]
    if (!tool) {
      // Unknown tool: still show that something ran.
      return (
        <Trace key={part.toolCallId}>
          <ToolLine
            part={part}
            titles={{
              running: `Running ${name}`,
              done: `Ran ${name}`,
              error: `${name} failed`,
              denied: `Denied ${name}`,
            }}
          />
        </Trace>
      )
    }

    const ctx: ToolContext = {
      streaming,
      addOutput: (output) => onToolOutput?.(name, part.toolCallId, output),
      respond: (approved) => {
        if ("approval" in part && part.approval) onApproval?.(part.approval.id, approved)
      },
    }
    return <React.Fragment key={part.toolCallId}>{tool.render(part as never, ctx)}</React.Fragment>
  })
}

function AssistantTurn({
  message,
  tools,
  phase = "idle",
  active = false,
  streaming = false,
  pending = false,
  actions,
  onToolOutput,
  onApproval,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Message>, "children"> &
  ToolHandlers & {
    message: UIMessage
    tools?: ToolRegistry
    /** What the agent is doing, shown by the orb on the live turn. */
    phase?: AgentPhase
    /** The live turn: only its orb animates. */
    active?: boolean
    streaming?: boolean
    /** Paused on the person (open question, draft, approval). */
    pending?: boolean
    /** Replace the default actions row, or `false` to hide it. */
    actions?: React.ReactNode | false
  }) {
  const text = getMessageText(message)
  const showActions = !streaming && !pending && text && actions !== false

  return (
    <Message data-slot="assistant-turn" className={cn("gap-3", className)} {...props}>
      {/* Phones: no avatar; the conversation header's orb carries presence and
          the text gets the full width. */}
      <MessageAvatar className="mt-0.5 size-5 min-w-0 self-start overflow-visible rounded-none bg-transparent group-has-data-[slot=message-footer]/message:translate-y-0 max-sm:hidden">
        <AgentOrb phase={active ? phase : "idle"} active={active} />
      </MessageAvatar>
      <MessageContent className="gap-3">
        <ChatParts
          message={message}
          tools={tools}
          streaming={streaming}
          onToolOutput={onToolOutput}
          onApproval={onApproval}
        />
        {showActions && (actions ?? <TurnActions text={text} />)}
      </MessageContent>
    </Message>
  )
}

function ChatTurn(props: React.ComponentProps<typeof AssistantTurn>) {
  return props.message.role === "user" ? (
    <UserTurn message={props.message} />
  ) : (
    <AssistantTurn {...props} />
  )
}

export { AssistantTurn, ChatParts, ChatTurn, UserTurn }
