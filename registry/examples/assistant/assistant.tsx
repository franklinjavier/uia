import * as React from "react"
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AttachmentChip,
  AttachmentPreview,
} from "@/components/parts/attachment"
import {
  ConnectPrompt,
  type ConnectState,
} from "@/components/parts/connect-prompt"
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

const SCENARIO_ICONS = {
  globe: GlobeIcon,
  pen: PenLineIcon,
  code: CodeIcon,
  chart: ChartColumnIcon,
  file: FileTextIcon,
}

const MODELS = {
  claude: {
    name: "Claude",
    provider: "Anthropic",
    icon: <ModelIcon family="claude" />,
  },
  gpt: { name: "GPT", provider: "OpenAI", icon: <ModelIcon family="openai" /> },
  gemini: {
    name: "Gemini",
    provider: "Google",
    icon: <ModelIcon family="gemini" />,
  },
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
  const [scenario, setScenario] = React.useState<ScenarioKey>(
    initialScenario ?? "draft"
  )
  const [run, setRun] = React.useState(0)
  const [started, setStarted] = React.useState(Boolean(initialScenario))
  // Lives here, not in the session: picking a scenario or starting over
  // remounts the session, and must not close the chat.
  const [minimised, setMinimised] = React.useState(!defaultOpen)
  // Whether the page should play its entrance (the pill growing into it):
  // only when it opens from the pill, not when a session remounts inside it.
  const [morph, setMorph] = React.useState(!defaultOpen)
  // A picked suggestion on its way to becoming the first bubble.
  const [flight, setFlight] = React.useState<Flight | null>(null)

  return (
    <>
      <Session
        key={`${scenario}-${run}`}
        minimised={minimised}
        morph={morph}
        onMinimisedChange={(m) => {
          setMorph(!m)
          setMinimised(m)
        }}
        scenario={scenario}
        autoStart={started}
        onPick={(key, from) => {
          if (from) setFlight({ id: run, text: from.text, from: from.rect })
          setMorph(false)
          setScenario(key)
          setStarted(true)
          setRun((r) => r + 1)
        }}
        onReset={() => {
          setMorph(false)
          setStarted(false)
          setRun((r) => r + 1)
        }}
      />
      <AnimatePresence>
        {flight && (
          <FlyingPrompt
            key={flight.id}
            flight={flight}
            onLanded={() => setFlight(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function Session({
  minimised,
  morph,
  onMinimisedChange: setMinimised,
  scenario,
  autoStart,
  onPick,
  onReset,
}: {
  minimised: boolean
  morph: boolean
  onMinimisedChange: (minimised: boolean) => void
  scenario: ScenarioKey
  autoStart: boolean
  onPick: (key: ScenarioKey, from?: { text: string; rect: DOMRect }) => void
  onReset: () => void
}) {
  const script = SCENARIOS[scenario].chat
  // One overloaded request in the metrics scenario, to show the error line.
  const [transport] = React.useState(() =>
    failOnce(
      transports[scenario],
      "Translate",
      "The model is over capacity right now. Nothing was sent."
    )
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
    chat.addToolOutput({
      tool: "connectApp",
      toolCallId,
      output: { connected },
    } as never)
  )

  const next = script.next(messages)
  const send = () => {
    if (next && !busy && !waiting) void sendMessage(next)
  }
  useScriptedSession({
    autoStart,
    next,
    messages,
    busy,
    sendMessage,
    setMessages,
  })

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
      <ChatEmpty
        title="Good evening"
        description="What are we working on?"
        size="lg"
      >
        {(Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => {
          const Icon = SCENARIO_ICONS[SCENARIOS[key].icon]
          return (
            <ChatSuggestion
              key={key}
              icon={<Icon />}
              onClick={(e) => onPick(key, pickedText(e.currentTarget))}
            >
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
                index === messages.length - 1 && !busy
                  ? () => void chat.regenerate()
                  : undefined
              }
              phase={chat.phase}
              active={index === chat.activeIndex}
              streaming={busy && index === messages.length - 1}
              pending={waiting && index === messages.length - 1}
              onToolOutput={(tool, toolCallId, output) =>
                chat.addToolOutput({ tool, toolCallId, output } as never)
              }
              onApproval={(id, approved) =>
                chat.addToolApprovalResponse({ id, approved })
              }
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
  const nextFiles = ready
    ? (next?.parts.filter((p) => p.type === "file") ?? [])
    : []
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
          connect.pending
            ? "Connect Slack above to continue…"
            : waiting
              ? "Answer above to continue…"
              : "Ask anything…"
        }
      />
      <ComposerToolbar>
        <ComposerAttach />
        <ComposerToggle
          icon={<GlobeIcon />}
          pressed={search}
          live={chat.phase === "searching"}
          onPressedChange={setSearch}
        >
          Search
        </ComposerToggle>
        <ComposerToggle
          icon={<BrainIcon />}
          pressed={think}
          live={chat.phase === "thinking"}
          onPressedChange={setThink}
        >
          Think
        </ComposerToggle>
        <ComposerModelSelect
          models={MODELS}
          value={model}
          onValueChange={setModel}
        />
        <ComposerMic className="ml-auto" />
        <ComposerSubmit
          busy={busy}
          onStop={chat.stop}
          disabled={!next || waiting}
        />
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
            <Weightless>
              <ChatPill
                layoutId={SURFACE}
                phase={chat.phase}
                onOpen={() => setMinimised(false)}
              />
            </Weightless>
          </motion.div>
        ) : (
          // Open: the pill grows into the page as a card — edge, shadow and
          // round corners held until the very end, so you watch it expand —
          // and its content arrives once the shape has mostly settled.
          <motion.div
            key="open"
            layoutId={SURFACE}
            data-slot="assistant-page"
            transition={MORPH}
            initial={
              morph ? { borderRadius: 28, boxShadow: edges().card } : false
            }
            animate={{
              borderRadius: morph ? [28, 24, 0] : 0,
              boxShadow: morph
                ? [edges().card, edges().card, edges().none]
                : edges().none,
              transition: { ...MORPH, times: [0, 0.86, 1] },
            }}
            className="flex h-svh w-full flex-col overflow-hidden bg-background"
          >
            <motion.div
              initial={morph ? { opacity: 0 } : false}
              animate={{ opacity: 1, transition: { ...easeOut, delay: 0.4 } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              className="flex min-h-0 flex-1 flex-col"
            >
              {/* pr-16 leaves room for the playground's theme toggle */}
              <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/70 pr-16 pl-5">
                {header}
              </header>
              <div className="relative min-h-0 flex-1">{conversation}</div>
              <div
                className={cn(column, "flex shrink-0 flex-col gap-2 px-6 pb-6")}
              >
                <AnimatePresence>{connect.prompt}</AnimatePresence>
                <div className="rounded-2xl border border-border bg-card shadow-xs">
                  {composer}
                </div>
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
const MORPH = { duration: 0.75, ease: [0.6, 0.04, 0.2, 1] } as const

/**
 * The card's edge while it grows: a hairline ring and a soft shadow, as
 * literal colours so motion can tween them (tokens can't be interpolated).
 */
function edges() {
  const dark = document.documentElement.classList.contains("dark")
  const ring = dark ? "255, 255, 255" : "0, 0, 0"
  return {
    card: `0 0 0 1px rgba(${ring}, ${dark ? 0.12 : 0.09}), 0 24px 64px -24px rgba(0, 0, 0, ${dark ? 0.6 : 0.2})`,
    none: `0 0 0 1px rgba(${ring}, 0), 0 24px 64px -24px rgba(0, 0, 0, 0)`,
  }
}

/**
 * Zero gravity: the closed pill drifts as if in orbit — three slow, out of
 * step motions (rise, sway, tilt) so the path never visibly repeats.
 */
function Weightless({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion()
  if (reduced) return <>{children}</>
  const drift = (duration: number) =>
    ({
      duration,
      ease: "easeInOut",
      repeat: Infinity,
      repeatType: "mirror",
    }) as const
  return (
    <motion.div animate={{ y: [-5, 6] }} transition={drift(5.2)}>
      <motion.div animate={{ x: [-4, 5] }} transition={drift(7.9)}>
        <motion.div animate={{ rotate: [-0.8, 0.9] }} transition={drift(6.4)}>
          {children}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

function HeaderAction({
  label,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className="text-muted-foreground"
            {...props}
          />
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

type Flight = { id: number; text: string; from: DOMRect }

/** The picked suggestion's words and where they sit on screen. */
function pickedText(button: HTMLElement) {
  const text = button.textContent?.trim() ?? ""
  const node = [...button.childNodes].find(
    (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()
  )
  const range = document.createRange()
  if (node) range.selectNodeContents(node)
  return {
    text,
    rect: node ? range.getBoundingClientRect() : button.getBoundingClientRect(),
  }
}

const FIRST_BUBBLE = '[data-slot="user-turn"] [data-slot="bubble-content"]'

/**
 * The picked suggestion carried to where the conversation starts: its words
 * lift off the row, travel (sideways briskly, down gently, so the path
 * arcs), and settle into the first bubble as it takes shape around them. The
 * real bubble stays hidden until they land.
 */
function FlyingPrompt({
  flight,
  onLanded,
}: {
  flight: Flight
  onLanded: () => void
}) {
  const [to, setTo] = React.useState<{ rect: DOMRect; text: string } | null>(
    null
  )
  const target = React.useRef<HTMLElement | null>(null)

  // Wait for the first bubble, hide it, and aim at where it will rest.
  React.useEffect(() => {
    let raf = 0
    const look = () => {
      const el = document.querySelector<HTMLElement>(FIRST_BUBBLE)
      if (!el) return void (raf = requestAnimationFrame(look))
      const turn = el.closest<HTMLElement>('[data-slot="user-turn"]')
      el.style.visibility = "hidden"
      target.current = el
      const r = el.getBoundingClientRect()
      // The turn is still rising into place: aim at where it ends up.
      const lift = turn
        ? new DOMMatrixReadOnly(getComputedStyle(turn).transform).m42
        : 0
      setTo({
        rect: new DOMRect(r.x, r.y - lift, r.width, r.height),
        text: el.textContent ?? "",
      })
    }
    raf = requestAnimationFrame(look)
    return () => {
      cancelAnimationFrame(raf)
      if (target.current) target.current.style.visibility = ""
    }
  }, [])

  const { from } = flight
  const land = () => {
    if (target.current) target.current.style.visibility = ""
    onLanded()
  }
  return (
    <>
      {/* The agent answers once the words have landed, not mid-flight. */}
      <style>{`[data-slot="assistant-turn"] { visibility: hidden }`}</style>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed z-50 overflow-hidden rounded-2xl text-sm leading-6"
        initial={{
          left: from.x,
          top: from.y,
          width: from.width,
          height: from.height,
        }}
        animate={
          to
            ? {
                left: to.rect.x,
                top: to.rect.y,
                width: to.rect.width,
                height: to.rect.height,
              }
            : {
                left: from.x,
                top: from.y - 4,
                width: from.width,
                height: from.height,
              }
        }
        transition={{
          default: { duration: 0.85, ease: [0.45, 0, 0.2, 1] },
          top: { duration: 0.85, ease: [0.25, 0.1, 0.15, 1] },
        }}
        onAnimationComplete={() => to && land()}
      >
        {/* The bubble taking shape around the words. */}
        <motion.div
          className="absolute inset-0 rounded-2xl bg-muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: to ? 1 : 0 }}
          transition={{ duration: 0.5, delay: to ? 0.3 : 0 }}
        />
        <motion.span
          className="absolute top-0 left-0 whitespace-nowrap text-foreground"
          initial={{ x: 0, y: 0 }}
          animate={to ? { x: 14, y: 6, opacity: [1, 1, 0] } : { x: 0, y: 0 }}
          transition={{
            duration: 0.85,
            ease: [0.45, 0, 0.2, 1],
            times: [0, 0.75, 1],
          }}
        >
          {flight.text}
        </motion.span>
        {to && (
          <motion.span
            className="absolute inset-0 px-3.5 py-1.5 wrap-break-word"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: 0.62 }}
          >
            {to.text}
          </motion.span>
        )}
      </motion.div>
    </>
  )
}

/** An attached file, with its gist on hover when we know it. */
function FileChip({ name }: { name: string }) {
  const file = FILES[name as keyof typeof FILES]
  const chip = <AttachmentChip name={name} />
  return file ? (
    <AttachmentPreview file={{ name, ...file }}>{chip}</AttachmentPreview>
  ) : (
    chip
  )
}

/**
 * Drives the docked ConnectPrompt: finds the open connectApp call, runs
 * ask → connecting → connected, answers the tool, and clears itself a
 * moment after it says what happens next.
 */
function useConnect(
  messages: ChatMessage[],
  answer: (toolCallId: string, connected: boolean) => void
) {
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

  const visible =
    id !== null && (open || (shownFor === id && state === "connected"))
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
      <path
        fill="#E01E5A"
        d="M5 15a2 2 0 1 1-2-2h2v2Zm1 0a2 2 0 1 1 4 0v5a2 2 0 1 1-4 0v-5Z"
      />
      <path
        fill="#36C5F0"
        d="M9 5a2 2 0 1 1 2-2v2H9Zm0 1a2 2 0 1 1 0 4H4a2 2 0 1 1 0-4h5Z"
      />
      <path
        fill="#2EB67D"
        d="M19 9a2 2 0 1 1 2 2h-2V9Zm-1 0a2 2 0 1 1-4 0V4a2 2 0 1 1 4 0v5Z"
      />
      <path
        fill="#ECB22E"
        d="M15 19a2 2 0 1 1-2 2v-2h2Zm0-1a2 2 0 1 1 0-4h5a2 2 0 1 1 0 4h-5Z"
      />
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
      prev.map((m, i) =>
        i === prev.length - 1 ? { ...m, id: CHAINED_CONTINUATION_ID } : m
      )
    )
  }, [busy, messages, setMessages])
}
