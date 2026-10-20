import * as React from "react"
import {
  CodeIcon,
  GlobeIcon,
  PenLineIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { getMessageText } from "@/lib/ai"
import { AgentOrb } from "@/components/ds/agent-orb"
import { ModelIcon } from "@/components/ds/model-icons"
import { Widget, WidgetHeader, WidgetPanel, WidgetTitle } from "@/components/ds/widget"
import { ChatEmpty, ChatSuggestion } from "@/components/chat/chat-empty"
import { ChatThread, ChatThreadItem } from "@/components/chat/chat-thread"
import { ChatTurn } from "@/components/chat/chat-turn"
import {
  Composer,
  ComposerAttach,
  ComposerInput,
  ComposerMic,
  ComposerModelSelect,
  ComposerSubmit,
  ComposerToolbar,
} from "@/components/chat/composer"
import { useAgentChat } from "@/components/chat/use-agent-chat"
import {
  CHAINED_CONTINUATION_ID,
  SCENARIOS,
  transports,
  type ChatMessage,
  type ScenarioKey,
} from "@/playground/assistant/scripts"
import { tools } from "@/playground/assistant/tools"

// The playground's assistant: nothing here but composition of the chat kit
// (components/chat) with the demo's tools and scripted conversations.

const SCENARIO_ICONS = { globe: GlobeIcon, pen: PenLineIcon, code: CodeIcon }

const MODELS = {
  claude: { name: "Claude", provider: "Anthropic", icon: <ModelIcon family="claude" /> },
  gpt: { name: "GPT", provider: "OpenAI", icon: <ModelIcon family="openai" /> },
  gemini: { name: "Gemini", provider: "Google", icon: <ModelIcon family="gemini" /> },
  llama: { name: "Llama", provider: "Meta", icon: <ModelIcon family="meta" /> },
  grok: { name: "Grok", provider: "xAI", icon: <ModelIcon family="grok" /> },
}

export type AssistantLayout = "widget" | "full"

export function Assistant({ layout = "widget" }: { layout?: AssistantLayout }) {
  const [scenario, setScenario] = React.useState<ScenarioKey>("draft")
  const [run, setRun] = React.useState(0)
  const [started, setStarted] = React.useState(false)

  return (
    <Session
      key={`${scenario}-${run}`}
      layout={layout}
      scenario={scenario}
      autoStart={started}
      onPick={(key) => {
        setScenario(key)
        setStarted(true)
        setRun((r) => r + 1)
      }}
    />
  )
}

function Session({
  layout,
  scenario,
  autoStart,
  onPick,
}: {
  layout: AssistantLayout
  scenario: ScenarioKey
  autoStart: boolean
  onPick: (key: ScenarioKey) => void
}) {
  const script = SCENARIOS[scenario].chat
  const chat = useAgentChat<ChatMessage>({
    messages: script.get(0),
    transport: transports[scenario],
    tools,
  })
  const { messages, sendMessage, setMessages, busy, waiting } = chat
  const [model, setModel] = React.useState<keyof typeof MODELS>("claude")

  const next = script.next(messages)
  const send = () => {
    if (next && !busy && !waiting) void sendMessage(next)
  }
  useScriptedSession({ autoStart, next, messages, busy, sendMessage, setMessages })

  const full = layout === "full"

  const header = (
    <>
      <AgentOrb phase={chat.phase} />
      <WidgetTitle>Assistant</WidgetTitle>
    </>
  )

  const column = full ? "mx-auto w-full max-w-[720px]" : ""

  const conversation =
    messages.length === 0 ? (
      <ChatEmpty title="Good evening" description="What are we working on?" size={full ? "lg" : "default"}>
        {(Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => {
          const Icon = SCENARIO_ICONS[SCENARIOS[key].icon]
          return (
            <ChatSuggestion key={key} icon={<Icon />} onClick={() => onPick(key)}>
              {SCENARIOS[key].label}
            </ChatSuggestion>
          )
        })}
      </ChatEmpty>
    ) : (
      <ChatThread busy={busy} className={cn(full && cn(column, "px-6 py-10"))}>
        {messages.map((message, index) => (
          <ChatThreadItem key={index} message={message}>
            <ChatTurn
              message={message}
              tools={tools}
              phase={chat.phase}
              active={index === chat.activeIndex}
              streaming={busy && index === messages.length - 1}
              pending={waiting && index === messages.length - 1}
              onToolOutput={(tool, toolCallId, output) =>
                chat.addToolOutput({ tool, toolCallId, output } as never)
              }
              onApproval={(id, approved) => chat.addToolApprovalResponse({ id, approved })}
            />
          </ChatThreadItem>
        ))}
      </ChatThread>
    )

  const composer = (
    <Composer onSubmit={send}>
      <ComposerInput
        readOnly
        aria-label="Next scripted message"
        value={next && !waiting && !busy ? getMessageText(next) : ""}
        placeholder={waiting ? "Answer above to continue…" : "Ask anything…"}
      />
      <ComposerToolbar>
        <ComposerAttach />
        <ComposerModelSelect models={MODELS} value={model} onValueChange={setModel} />
        <ComposerMic className="ml-auto" />
        <ComposerSubmit busy={busy} onStop={chat.stop} disabled={!next || waiting} />
      </ComposerToolbar>
    </Composer>
  )

  if (full) {
    return (
      <div data-slot="assistant-page" className="flex h-svh w-full flex-col bg-background">
        {/* pr-16 leaves room for the playground's theme toggle */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/70 pr-16 pl-5">
          {header}
        </header>
        <div className="relative min-h-0 flex-1">{conversation}</div>
        <div className={cn(column, "shrink-0 px-6 pb-6")}>
          <div className="rounded-2xl border border-border bg-card shadow-xs">{composer}</div>
        </div>
      </div>
    )
  }

  return (
    <Widget className="max-w-[620px]">
      <WidgetHeader>{header}</WidgetHeader>
      {/* One panel: the conversation and its composer belong together. */}
      <WidgetPanel className="flex flex-col overflow-hidden p-0">
        <div className="h-[480px]">{conversation}</div>
        <div className="border-t border-border/70">{composer}</div>
      </WidgetPanel>
    </Widget>
  )
}

/* Playground-only plumbing for scripted conversations. */
function useScriptedSession({
  autoStart,
  next,
  messages,
  busy,
  sendMessage,
  setMessages,
}: {
  autoStart: boolean
  next: ChatMessage | null
  messages: ChatMessage[]
  busy: boolean
  sendMessage: (m: ChatMessage) => Promise<void>
  setMessages: (fn: (prev: ChatMessage[]) => ChatMessage[]) => void
}) {
  // Start the scenario with its first scripted turn. Scheduled and cleared
  // on cleanup so StrictMode's mount → unmount → mount sends exactly once.
  React.useEffect(() => {
    if (!autoStart || messages.length > 0 || !next) return
    const t = window.setTimeout(() => void sendMessage(next), 0)
    return () => window.clearTimeout(t)
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // See CHAINED_CONTINUATION_ID in scripts.ts.
  React.useEffect(() => {
    const last = messages.at(-1)
    if (busy || !last || last.id === CHAINED_CONTINUATION_ID) return
    if (!last.parts.some((p) => p.type === "tool-composeDraft")) return
    setMessages((prev) =>
      prev.map((m, i) => (i === prev.length - 1 ? { ...m, id: CHAINED_CONTINUATION_ID } : m))
    )
  }, [busy, messages, setMessages])
}
