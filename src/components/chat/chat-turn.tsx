import * as React from "react"
import { getToolName, isToolUIPart, type UIMessage } from "ai"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { enter } from "@/lib/motion"
import { getMessageText } from "@/lib/ai"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageAvatar, MessageContent } from "@/components/ui/message"
import { Trace } from "@/components/ui/trace"
import { Markdown } from "@/components/parts/markdown"
import { Reasoning } from "@/components/parts/reasoning"
import { SourcesGrid } from "@/components/parts/sources"
import { ToolLine } from "@/components/parts/tool-line"
import { AgentOrb, type AgentPhase } from "@/components/ds/agent-orb"
import { AttachmentChip } from "@/components/parts/attachment"
import { TurnActions } from "@/components/chat/turn-actions"
import { useTurnEnters } from "@/components/chat/chat-thread"
import type { DataRegistry, ToolContext, ToolRegistry } from "@/components/chat/tool-registry"

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

const MotionMessage = motion.create(Message)

// Entrances. What you send lands with a short fade, a lift and a blur
// clearing; the answer follows a beat later, so the two read as a call and
// a response instead of one block appearing.
const sent = { opacity: 0, y: 8, filter: "blur(2px)" }
const answer = { opacity: 0, y: 4 }
const settled = { opacity: 1, y: 0, filter: "blur(0px)" }

type FilePart = Extract<UIMessage["parts"][number], { type: "file" }>

function UserTurn({
  message,
  renderFile,
  className,
  ...props
}: React.ComponentProps<typeof Message> & {
  message: UIMessage
  /** How an attached file shows above the bubble. Default: a chip. */
  renderFile?: (file: FilePart) => React.ReactNode
}) {
  const enters = useTurnEnters()
  const files = message.parts.filter((p): p is FilePart => p.type === "file")
  const text = getMessageText(message)
  return (
    <MotionMessage
      data-slot="user-turn"
      align="end"
      initial={enters ? sent : false}
      animate={settled}
      transition={enter}
      className={className}
      {...(props as React.ComponentProps<typeof MotionMessage>)}
    >
      <MessageContent>
        {files.length > 0 && (
          <div data-slot="user-turn-files" className="flex flex-wrap justify-end gap-1.5">
            {files.map((f, i) => (
              <React.Fragment key={f.url + i}>
                {renderFile ? renderFile(f) : <AttachmentChip name={f.filename ?? "file"} />}
              </React.Fragment>
            ))}
          </div>
        )}
        {text && (
          <Bubble align="end" variant="muted">
            <BubbleContent>{text}</BubbleContent>
          </Bubble>
        )}
      </MessageContent>
    </MotionMessage>
  )
}

function ChatParts({
  message,
  tools = {},
  data = {},
  streaming = false,
  onToolOutput,
  onApproval,
}: ToolHandlers & {
  message: UIMessage
  tools?: ToolRegistry
  /** How `data-<name>` parts render, by name. Unknown ones render nothing. */
  data?: DataRegistry
  streaming?: boolean
}) {
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
    if (part.type.startsWith("data-")) {
      const render = data[part.type.slice(5)]
      const id = (part as { id?: string }).id ?? index
      return render ? <React.Fragment key={`${part.type}-${id}`}>{render((part as unknown as { data: never }).data)}</React.Fragment> : null
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
  data,
  phase = "idle",
  active = false,
  streaming = false,
  pending = false,
  actions,
  onRegenerate,
  onToolOutput,
  onApproval,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Message>, "children"> &
  ToolHandlers & {
    message: UIMessage
    tools?: ToolRegistry
    data?: DataRegistry
    /** What the agent is doing, shown by the orb on the live turn. */
    phase?: AgentPhase
    /** The live turn: only its orb animates. */
    active?: boolean
    streaming?: boolean
    /** Paused on the person (open question, draft, approval). */
    pending?: boolean
    /** Replace the default actions row, or `false` to hide it. */
    actions?: React.ReactNode | false
    /** Adds Regenerate to the default actions row (pass it on the last turn). */
    onRegenerate?: () => void
  }) {
  const text = getMessageText(message)
  const showActions = !streaming && !pending && text && actions !== false

  const enters = useTurnEnters()

  // A request that failed before anything arrived leaves an empty turn:
  // don't draw an orb with nothing next to it (the error line says it).
  if (!streaming && !active && message.parts.length === 0) return null

  return (
    <MotionMessage
      data-slot="assistant-turn"
      initial={enters ? answer : false}
      animate={settled}
      transition={{ ...enter, delay: 0.12 }}
      className={cn("gap-3", className)}
      {...(props as React.ComponentProps<typeof MotionMessage>)}
    >
      {/* Phones: no avatar; the conversation header's orb carries presence and
          the text gets the full width. */}
      <MessageAvatar className="mt-0.5 size-5 min-w-0 self-start overflow-visible rounded-none bg-transparent group-has-data-[slot=message-footer]/message:translate-y-0 max-sm:hidden">
        <AgentOrb phase={active ? phase : "idle"} active={active} />
      </MessageAvatar>
      <MessageContent className="gap-3">
        <ChatParts
          message={message}
          tools={tools}
          data={data}
          streaming={streaming}
          onToolOutput={onToolOutput}
          onApproval={onApproval}
        />
        {showActions && (actions ?? <TurnActions text={text} onRegenerate={onRegenerate} />)}
      </MessageContent>
    </MotionMessage>
  )
}

function ChatTurn({
  renderFile,
  ...props
}: React.ComponentProps<typeof AssistantTurn> & Pick<React.ComponentProps<typeof UserTurn>, "renderFile">) {
  return props.message.role === "user" ? (
    <UserTurn message={props.message} renderFile={renderFile} />
  ) : (
    <AssistantTurn {...props} />
  )
}

export { AssistantTurn, ChatParts, ChatTurn, UserTurn }
