import * as React from "react"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
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
import { easeOut } from "@/lib/motion"
import { getMessageText } from "@/lib/ai"
import { AgentOrb } from "@/components/ds/agent-orb"
import { ModelIcon } from "@/components/ds/model-icons"
import { WidgetTitle } from "@/components/ds/widget"
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
//
// It starts closed, as a ChatPill with the orb breathing in the middle of an
// empty page. Opening it morphs the pill into the full-page chat (shared
// `layoutId`); Minimise morphs it back.

const SCENARIO_ICONS = { globe: GlobeIcon, pen: PenLineIcon, code: CodeIcon, chart: ChartColumnIcon, file: FileTextIcon }

const MODELS = {
  claude: { name: "Claude", provider: "Anthropic", icon: <ModelIcon family="claude" /> },
  gpt: { name: "GPT", provider: "OpenAI", icon: <ModelIcon family="openai" /> },
  gemini: { name: "Gemini", provider: "Google", icon: <ModelIcon family="gemini" /> },
  llama: { name: "Llama", provider: "Meta", icon: <ModelIcon family="meta" /> },
  grok: { name: "Grok", provider: "xAI", icon: <ModelIcon family="grok" /> },
}

export function Assistant({
  initialScenario,
  defaultOpen = Boolean(initialScenario),
}: {
  /** Start straight into a scripted scenario instead of the empty state. */
  initialScenario?: ScenarioKey
  /** Start open instead of as the pill (default: open when a scenario is given). */
  defaultOpen?: boolean
}) {
  const [scenario, setScenario] = React.useState<ScenarioKey>(initialScenario ?? "draft")
  const [run, setRun] = React.useState(0)
  const [started, setStarted] = React.useState(Boolean(initialScenario))
  // Lives here, not in the session: picking a scenario or starting over
  // remounts the session, and must not close the chat.
  const [minimised, setMinimised] = React.useState(!defaultOpen)

  return (
    <Session
      key={`${scenario}-${run}`}
      minimised={minimised}
      onMinimisedChange={setMinimised}
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
  minimised,
  onMinimisedChange: setMinimised,
  scenario,
  autoStart,
  onPick,
  onReset,
}: {
  minimised: boolean
  onMinimisedChange: (minimised: boolean) => void
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

  // Header actions only when they do something: start over once there's a
  // conversation, and get out of the way (the chat folds back into its pill).
  const header = (
    <>
      <AgentOrb phase={chat.phase} />
      <WidgetTitle>Assistant</WidgetTitle>
      <span className="ml-auto flex items-center gap-0.5">
        {messages.length > 0 && (
          <HeaderAction label="New chat" onClick={onReset}>
            <SquarePenIcon />
          </HeaderAction>
        )}
        <HeaderAction label="Minimise" onClick={() => setMinimised(true)}>
          <MinusIcon />
        </HeaderAction>
      </span>
    </>
  )

  const column = "mx-auto w-full max-w-[720px]"

  const conversation =
    messages.length === 0 ? (
      <ChatEmpty title="Good evening" description="What are we working on?" size="lg">
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
      <ChatThread busy={busy} className={cn(column, "px-6 py-10")}>
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

  return (
    <LayoutGroup>
      <AnimatePresence mode="popLayout" initial={false}>
        {minimised ? (
          // Closed: just the pill, the orb breathing in the middle of the page.
          <motion.div
            key="closed"
            data-slot="assistant-closed"
            className="flex h-svh w-full items-center justify-center bg-background px-6"
            exit={{ opacity: 1 }}
          >
            <ChatPill layoutId={SURFACE} phase={chat.phase} onOpen={() => setMinimised(false)} />
          </motion.div>
        ) : (
          // Open: the pill grows into the page; its content arrives once the
          // shape has mostly settled.
          <motion.div
            key="open"
            layoutId={SURFACE}
            data-slot="assistant-page"
            transition={MORPH}
            style={{ borderRadius: 0 }}
            className="flex h-svh w-full flex-col overflow-hidden bg-background"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { ...easeOut, delay: 0.18 } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              className="flex min-h-0 flex-1 flex-col"
            >
              {/* pr-16 leaves room for the playground's theme toggle */}
              <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/70 pr-16 pl-5">
                {header}
              </header>
              <div className="relative min-h-0 flex-1">{conversation}</div>
              <div className={cn(column, "flex shrink-0 flex-col gap-2 px-6 pb-6")}>
                <AnimatePresence>{connect.prompt}</AnimatePresence>
                <div className="rounded-2xl border border-border bg-card shadow-xs">{composer}</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </LayoutGroup>
  )
}

/** The pill and the page are one surface: this id lets one morph into the other. */
const SURFACE = "assistant-surface"
const MORPH = { type: "spring", bounce: 0.12, duration: 0.6 } as const

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
