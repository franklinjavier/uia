import * as React from "react"
import { AnimatePresence } from "motion/react"
import {
  BrainIcon,
  ChartColumnIcon,
  CodeIcon,
  FileTextIcon,
  GlobeIcon,
  MinusIcon,
  PenLineIcon,
  SquarePenIcon,
} from "lucide-react"
import { getToolName, isToolUIPart } from "ai"

import { cn } from "@/lib/utils"
import { getMessageText } from "@/lib/ai"
import { AgentOrb } from "@/components/ds/agent-orb"
import { ModelIcon } from "@/components/ds/model-icons"
import { Widget, WidgetHeader, WidgetPanel, WidgetTitle } from "@/components/ds/widget"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AttachmentChip, AttachmentPreview } from "@/components/parts/attachment"
import { ConnectPrompt, type ConnectState } from "@/components/parts/connect-prompt"
import { ChatError } from "@/components/chat/chat-error"
import { ChatPill } from "@/components/chat/chat-pill"
import { ChatEmpty, ChatSuggestion } from "@/components/chat/chat-empty"
import { ChatThread, ChatThreadItem } from "@/components/chat/chat-thread"
import { ChatTurn } from "@/components/chat/chat-turn"
import {
  Composer,
  ComposerAttach,
  ComposerAttachments,
  ComposerInput,
  ComposerMic,
  ComposerModelSelect,
  ComposerSubmit,
  ComposerToggle,
  ComposerToolbar,
} from "@/components/chat/composer"
import { useAgentChat } from "@/components/chat/use-agent-chat"
import {
  CHAINED_CONTINUATION_ID,
  failOnce,
  FILES,
  SCENARIOS,
  transports,
  type ChatMessage,
  type ScenarioKey,
} from "@/examples/assistant/scripts"
import { data, tools } from "@/examples/assistant/tools"

// The playground's assistant: nothing here but composition of the chat kit
// (components/chat) with the demo's tools and scripted conversations.

const SCENARIO_ICONS = { globe: GlobeIcon, pen: PenLineIcon, code: CodeIcon, chart: ChartColumnIcon, file: FileTextIcon }

const MODELS = {
  claude: { name: "Claude", provider: "Anthropic", icon: <ModelIcon family="claude" /> },
  gpt: { name: "GPT", provider: "OpenAI", icon: <ModelIcon family="openai" /> },
  gemini: { name: "Gemini", provider: "Google", icon: <ModelIcon family="gemini" /> },
  llama: { name: "Llama", provider: "Meta", icon: <ModelIcon family="meta" /> },
  grok: { name: "Grok", provider: "xAI", icon: <ModelIcon family="grok" /> },
}

export type AssistantLayout = "widget" | "full"

export function Assistant({
  layout = "widget",
  initialScenario,
}: {
  layout?: AssistantLayout
  /** Start straight into a scripted scenario instead of the empty state. */
  initialScenario?: ScenarioKey
}) {
  const [scenario, setScenario] = React.useState<ScenarioKey>(initialScenario ?? "draft")
  const [run, setRun] = React.useState(0)
  const [started, setStarted] = React.useState(Boolean(initialScenario))

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
      onReset={() => {
        setStarted(false)
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
  onReset,
}: {
  layout: AssistantLayout
  scenario: ScenarioKey
  autoStart: boolean
  onPick: (key: ScenarioKey) => void
  onReset: () => void
}) {
  const script = SCENARIOS[scenario].chat
  // One overloaded request in the metrics scenario, to show the error line.
  const [transport] = React.useState(() =>
    failOnce(transports[scenario], "Translate", "The model is over capacity right now. Nothing was sent.")
  )
  const chat = useAgentChat<ChatMessage>({
    messages: script.get(0),
    transport,
    tools,
  })
  const { messages, sendMessage, setMessages, busy, waiting } = chat
  const [model, setModel] = React.useState<keyof typeof MODELS>("claude")
  const [search, setSearch] = React.useState(true)
  const [think, setThink] = React.useState(true)
  const [minimised, setMinimised] = React.useState(false)

  // A client tool answered outside the transcript: Connect docks above the
  // composer while the turn waits on it, then says what happens next.
  const connect = useConnect(messages, (toolCallId, connected) =>
    chat.addToolOutput({ tool: "connectApp", toolCallId, output: { connected } } as never)
  )

  const next = script.next(messages)
  const send = () => {
    if (next && !busy && !waiting) void sendMessage(next)
  }
  useScriptedSession({ autoStart, next, messages, busy, sendMessage, setMessages })

  const full = layout === "full"

  // Two header actions, both real: start over, and get out of the way.
  const header = (
    <>
      <AgentOrb phase={chat.phase} />
      <WidgetTitle>Assistant</WidgetTitle>
      <span className="ml-auto flex items-center gap-0.5">
        <HeaderAction label="New chat" onClick={onReset} disabled={messages.length === 0}>
          <SquarePenIcon />
        </HeaderAction>
        <HeaderAction label="Minimise" onClick={() => setMinimised(true)}>
          <MinusIcon />
        </HeaderAction>
      </span>
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
              data={data}
              renderFile={(f) => <FileChip name={f.filename ?? "file"} />}
              onRegenerate={
                index === messages.length - 1 && !busy ? () => void chat.regenerate() : undefined
              }
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
        {chat.error && (
          <ChatError
            message={chat.error.message}
            retryLabel={model === "gpt" ? "Retry" : "Retry with GPT"}
            onRetry={() => {
              setModel("gpt")
              void chat.regenerate()
            }}
          />
        )}
      </ChatThread>
    )

  const ready = Boolean(next) && !waiting && !busy
  const nextFiles = ready ? (next?.parts.filter((p) => p.type === "file") ?? []) : []
  const composer = (
    <Composer onSubmit={send}>
      <ComposerAttachments>
        {nextFiles.map((f) => (
          <FileChip key={f.url} name={f.filename ?? "file"} />
        ))}
      </ComposerAttachments>
      <ComposerInput
        readOnly
        aria-label="Next scripted message"
        value={ready && next ? getMessageText(next) : ""}
        placeholder={
          connect.pending ? "Connect Slack above to continue…" : waiting ? "Answer above to continue…" : "Ask anything…"
        }
      />
      <ComposerToolbar>
        <ComposerAttach />
        <ComposerToggle icon={<GlobeIcon />} pressed={search} live={chat.phase === "searching"} onPressedChange={setSearch}>
          Search
        </ComposerToggle>
        <ComposerToggle icon={<BrainIcon />} pressed={think} live={chat.phase === "thinking"} onPressedChange={setThink}>
          Think
        </ComposerToggle>
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
        <div className={cn(column, "flex shrink-0 flex-col gap-2 px-6 pb-6")}>
          <AnimatePresence>{connect.prompt}</AnimatePresence>
          <div className="rounded-2xl border border-border bg-card shadow-xs">{composer}</div>
        </div>
      </div>
    )
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {minimised ? (
        <ChatPill key="pill" phase={chat.phase} onOpen={() => setMinimised(false)} />
      ) : (
        <Widget key="panel" className="w-full max-w-[620px]">
          <WidgetHeader>{header}</WidgetHeader>
          {/* One panel: the conversation and its composer belong together. */}
          <WidgetPanel className="flex flex-col overflow-hidden p-0">
            <div className="h-[480px]">{conversation}</div>
            <AnimatePresence>
              {connect.prompt && <div className="border-t border-border/70 p-2">{connect.prompt}</div>}
            </AnimatePresence>
            <div className="border-t border-border/70">{composer}</div>
          </WidgetPanel>
        </Widget>
      )}
    </AnimatePresence>
  )
}

function HeaderAction({
  label,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={label} className="text-muted-foreground" {...props} />}
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** An attached file, with its gist on hover when we know it. */
function FileChip({ name }: { name: string }) {
  const file = FILES[name as keyof typeof FILES]
  const chip = <AttachmentChip name={name} />
  return file ? <AttachmentPreview file={{ name, ...file }}>{chip}</AttachmentPreview> : chip
}

/**
 * Drives the docked ConnectPrompt: finds the open connectApp call, runs
 * ask → connecting → connected, answers the tool, and clears itself a
 * moment after it says what happens next.
 */
function useConnect(messages: ChatMessage[], answer: (toolCallId: string, connected: boolean) => void) {
  const part = messages
    .at(-1)
    ?.parts.find((p) => isToolUIPart(p) && getToolName(p) === "connectApp") as
    | Extract<ChatMessage["parts"][number], { type: "tool-connectApp" }>
    | undefined
  const [state, setState] = React.useState<ConnectState>("ask")
  const [shownFor, setShownFor] = React.useState<string | null>(null)

  const open = part?.state === "input-available"
  const id = part?.toolCallId ?? null

  React.useEffect(() => {
    if (state !== "connected" || !shownFor) return
    const t = window.setTimeout(() => setShownFor(null), 2600)
    return () => window.clearTimeout(t)
  }, [state, shownFor])

  const visible = id !== null && (open || (shownFor === id && state === "connected"))
  const prompt =
    visible && part?.input ? (
      <ConnectPrompt
        key={id}
        app={part.input.app ?? "Slack"}
        icon={<SlackMark />}
        reason={part.input.reason ?? ""}
        done={part.input.done}
        state={open ? state : "connected"}
        onConnect={() => {
          setState("connecting")
          setShownFor(id)
          window.setTimeout(() => {
            setState("connected")
            answer(id, true)
          }, 1100)
        }}
      />
    ) : null

  return { prompt, pending: open }
}

function SlackMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="#E01E5A" d="M5 15a2 2 0 1 1-2-2h2v2Zm1 0a2 2 0 1 1 4 0v5a2 2 0 1 1-4 0v-5Z" />
      <path fill="#36C5F0" d="M9 5a2 2 0 1 1 2-2v2H9Zm0 1a2 2 0 1 1 0 4H4a2 2 0 1 1 0-4h5Z" />
      <path fill="#2EB67D" d="M19 9a2 2 0 1 1 2 2h-2V9Zm-1 0a2 2 0 1 1-4 0V4a2 2 0 1 1 4 0v5Z" />
      <path fill="#ECB22E" d="M15 19a2 2 0 1 1-2 2v-2h2Zm0-1a2 2 0 1 1 0-4h5a2 2 0 1 1 0 4h-5Z" />
    </svg>
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
