import * as React from "react"
import type { UIMessage } from "ai"
import { AnimatePresence, LayoutGroup, motion, type TargetAndTransition } from "motion/react"
import {
  CheckIcon,
  HistoryIcon,
  InboxIcon,
  LayersIcon,
  MoonIcon,
  RotateCcwIcon,
  ScaleIcon,
  SunIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { enter, springSoft } from "@/lib/motion"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AgentOrb } from "@/components/ds/agent-orb"
import { ModelIcon } from "@/components/ds/model-icons"
import { StageTrack, StageTrackLabels } from "@/components/ds/stage-track"
import { StatusBadge, StatusDot } from "@/components/ds/status"
import {
  Widget,
  WidgetFooter,
  WidgetHeader,
  WidgetList,
  WidgetListRow,
  WidgetPanel,
  WidgetTitle,
} from "@/components/ds/widget"
import {
  ActionCard,
  ActionCardActions,
  ActionCardDescription,
  ActionCardHeader,
  ActionCardStatus,
  ActionCardTitle,
  ResolvedRow,
} from "@/components/parts/action-card"
import { ChatThread, ChatThreadItem } from "@/components/chat/chat-thread"
import { ChatTurn } from "@/components/chat/chat-turn"
import {
  Composer,
  ComposerInput,
  ComposerSubmit,
  ComposerToolbar,
} from "@/components/chat/composer"
import type { ToolRegistry } from "@/components/chat/tool-registry"
import { DiffCard, EvidenceCard, QuotaCard } from "@/examples/davinci/cards"
import { RISKY_DIFF, type Project } from "@/examples/davinci/data"
import { BlogPreview } from "@/examples/davinci/davinci"
import {
  DECIDED,
  BUSY_STATE,
  QUEUE,
  RULES,
  STAGES,
  SINCE,
  STATE,
  type Decided,
  type QueueItem,
  type ProjectState,
  type Rule,
  type Urgency,
} from "@/examples/davinci2/data"

// davinci v2. One entry point, four surfaces:
//   Inbox     decisions as state: self-contained, grouped by urgency, each
//             with its consequence and whether it can be undone; repeated
//             agreement offers to become a rule.
//   Threads   one conversation per project, for intent and digging in.
//   Projects  state to look at when you want, never because you must.
//   Decided   what davinci decided for you, with undo: the trust surface.
//   Rules     decisions that became policy.
// Deep dives open in a side panel (a sheet on phones), not inline.

export type View =
  "inbox" | `thread:${Project}` | "projects" | "decided" | "rules"
type Panel =
  { kind: "diff" } | { kind: "preview" } | { kind: "task"; key: string } | null
type Answer = { label: string; by: "you" | "rule"; pick: boolean; at: string }

const URGENCY: Record<Urgency, string> = {
  now: "Now",
  today: "Today",
  later: "Can wait",
}

let seq = 0
const mid = () => `v2-${++seq}`
const say = (role: "user" | "assistant", text: string): UIMessage => ({
  id: mid(),
  role,
  parts: [{ type: "text", text }],
})
/** A message that points at an inbox item; the thread shows its live status. */
const refTo = (text: string, ...ids: string[]): UIMessage => ({
  id: mid(),
  role: "assistant",
  parts: [
    { type: "text", text },
    ...ids.map(
      (id) =>
        ({
          type: "tool-ref",
          toolCallId: id,
          state: "input-available",
          input: {},
        }) as UIMessage["parts"][number]
    ),
  ],
})
const tool = (text: string, name: string): UIMessage => ({
  id: mid(),
  role: "assistant",
  parts: [
    { type: "text", text },
    {
      type: `tool-${name}`,
      toolCallId: name,
      state: "input-available",
      input: {},
    } as UIMessage["parts"][number],
  ],
})

const THREADS: Record<Project, UIMessage[]> = {
  blog: [
    say("user", "Add an Open Source section, sorted by stars"),
    refTo(
      "Done as **BLOG-5**: built, gates and review passed. It changed a screen, so it needs your eye.",
      "q-preview"
    ),
    refTo(
      "Production check failed after v12: the RSS page returns 500. Bisect points at **3f2a1c** (BLOG-4).",
      "q-incident"
    ),
  ],
  bottega: [
    say("user", "Why was the factory idle last night?"),
    tool(
      "The chat watcher lost its session at 22:30; four tasks waited on an unanswered question until Melzi's redelivery at 03:40. **The event door (T-413) closes this**, it's building now.",
      "evidence"
    ),
  ],
}

/**
 * Pass `view` and `onViewChange` to drive the view from your router (each
 * view its own route); leave them out and it keeps the view itself.
 */
// A thread is a conversation with davinci: its still orb, the same one a
// past message carries, stands for it.
// A thread is a conversation with davinci: its still orb, the same one a
// past message carries, stands for it. Hovering the entry wakes it.
function ThreadIcon({ live = false }: { live?: boolean }) {
  return (
    <span className="flex size-4 items-center justify-center">
      <AgentOrb active={live} className="scale-90 opacity-100" />
    </span>
  )
}

// Hover nudges for the side nav, one small gesture per icon that says what
// the place is: the inbox takes something in, projects stack up, the log
// rewinds, rules weigh. Played once per hover, never looping.
const NUDGE = {
  drop: { y: [0, 2, 0] },
  lift: { y: [0, -2, 0], scale: [1, 1.06, 1] },
  rewind: { rotate: [0, -40, 0] },
  weigh: { rotate: [0, -10, 7, 0] },
} satisfies Record<string, TargetAndTransition>

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      className="text-muted-foreground"
      aria-label={dark ? "Light theme" : "Dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}

export function DavinciInbox({
  view: viewProp,
  onViewChange,
}: {
  view?: View
  onViewChange?: (view: View) => void
}) {
  const [ownView, setOwnView] = React.useState<View>("inbox")
  // Simulation: the factory under load. Lives in the URL (`?busy`) so a
  // reload, or a phone without the side nav, keeps it.
  const [busy, setBusyState] = React.useState(() =>
    new URLSearchParams(window.location.search).has("busy")
  )
  const setBusy = (on: boolean) => {
    const url = new URL(window.location.href)
    if (on) url.searchParams.set("busy", "")
    else url.searchParams.delete("busy")
    url.search = url.search.replace(/=(?=&|$)/g, "")
    window.history.replaceState(null, "", url)
    setBusyState(on)
  }
  const factory = busy ? BUSY_STATE : STATE
  const [hovered, setHovered] = React.useState<View | null>(null)
  const view = viewProp ?? ownView
  const setView = (v: View) => (onViewChange ? onViewChange(v) : setOwnView(v))
  const [panel, setPanel] = React.useState<Panel>(null)
  const [answers, setAnswers] = React.useState<Record<string, Answer>>({})
  const [rules, setRules] = React.useState<(Rule & { off?: boolean })[]>(RULES)
  const [decided, setDecided] =
    React.useState<(Decided & { undone?: boolean })[]>(DECIDED)
  const [threads, setThreads] = React.useState(THREADS)
  const [typing, setTyping] = React.useState(false)

  const open = QUEUE.filter((q) => !answers[q.id])
  const now = () =>
    new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    })

  function answer(q: QueueItem, label: string, pick: boolean) {
    setAnswers((a) => ({ ...a, [q.id]: { label, by: "you", pick, at: now() } }))
    if (panel) setPanel(null)
  }

  function makeRule(q: QueueItem) {
    const option = q.options?.find((o) => o.id === q.pick)
    const rule: Rule = {
      id: `r-${q.id}`,
      category: q.category,
      text: `${q.category}: ${option?.label.toLowerCase() ?? "take davinci's pick"} when the plan is under 40 lines`,
      applied: 1,
    }
    setRules((r) => [rule, ...r])
    setAnswers((a) => ({
      ...a,
      [q.id]: {
        label: option?.label ?? "davinci's pick",
        by: "rule",
        pick: true,
        at: now(),
      },
    }))
    setDecided((d) => [
      {
        id: `d-${q.id}`,
        time: now(),
        project: q.project,
        what: `${option?.label ?? "Approved"}: ${q.title}`,
        why: "Your new rule",
        rule: rule.id,
        reversible: true,
      },
      ...d,
    ])
  }

  // An answer stays undoable from the inbox; one made by a new rule takes
  // the rule (and its record) back with it.
  function undo(id: string) {
    const a = answers[id]
    setAnswers((all) => {
      const next = { ...all }
      delete next[id]
      return next
    })
    if (a?.by === "rule") {
      setRules((r) => r.filter((x) => x.id !== `r-${id}`))
      setDecided((d) => d.filter((x) => x.id !== `d-${id}`))
    }
  }

  function ask(project: Project, text: string) {
    setThreads((t) => ({ ...t, [project]: [...t[project], say("user", text)] }))
    setTyping(true)
    window.setTimeout(() => {
      setTyping(false)
      const reply = /quota/i.test(text)
        ? tool(
            "Codex is fine. **Claude is tight**: 94% by Monday 09:00. Reviews already go to Codex (rule).",
            "quota"
          )
        : say(
            "assistant",
            "Noted. It becomes a task here; it reaches your inbox only if it needs a decision."
          )
      setThreads((t) => ({ ...t, [project]: [...t[project], reply] }))
    }, 800)
  }

  const nav: {
    id: View
    label: string
    icon: React.ReactNode
    nudge?: keyof typeof NUDGE
    count?: number
    attention?: boolean
  }[] = [
    {
      id: "inbox",
      label: "Inbox",
      icon: <InboxIcon />,
      nudge: "drop",
      count: open.length,
      attention: open.length > 0,
    },
    { id: "thread:blog", label: "blog", icon: <ThreadIcon live={hovered === "thread:blog"} /> },
    { id: "thread:bottega", label: "bottega", icon: <ThreadIcon live={hovered === "thread:bottega"} /> },
    { id: "projects", label: "Projects", icon: <LayersIcon />, nudge: "lift" },
    {
      id: "decided",
      label: "Decided for you",
      icon: <HistoryIcon />,
      nudge: "rewind",
      count: decided.filter((d) => !d.undone).length,
    },
    {
      id: "rules",
      label: "Rules",
      icon: <ScaleIcon />,
      nudge: "weigh",
      count: rules.filter((r) => !r.off).length,
    },
  ]
  const label = (v: View) => nav.find((n) => n.id === v)!.label

  return (
    <div
      data-slot="davinci-inbox"
      className={cn(
        "grid h-svh grid-cols-1 bg-background md:grid-cols-[14rem_minmax(0,1fr)]",
        panel && "lg:grid-cols-[14rem_minmax(0,1fr)_26rem]"
      )}
    >
      {/* Navigation: one entry, everything one click away. */}
      <nav className="hidden min-h-0 flex-col gap-1 border-r border-border/70 p-3 md:flex">
        <button
          type="button"
          onClick={() => {
            setView("inbox")
            setPanel(null)
          }}
          className="flex h-11 items-center gap-2.5 rounded-xl px-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <AgentOrb
            phase={typing ? "composing" : open.length ? "waiting" : "idle"}
            active={typing || open.length > 0}
          />
          <span className="text-[15px]">davinci</span>
        </button>
        {nav.map((n, i) => (
          <React.Fragment key={n.id}>
            {(i === 1 || i === 3) && (
              <div className="mt-3 px-2 pb-1 eyebrow text-faint-foreground">
                {i === 1 ? "Threads" : "Look"}
              </div>
            )}
            <motion.button
              type="button"
              onClick={() => {
                setView(n.id)
                setPanel(null)
              }}
              initial="rest"
              animate="rest"
              whileHover="hover"
              onHoverStart={() => setHovered(n.id)}
              onHoverEnd={() => setHovered(null)}
              aria-current={view === n.id}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-xl px-2 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30",
                view === n.id && "bg-muted text-foreground"
              )}
            >
              <motion.span
                variants={{ rest: { y: 0, scale: 1, rotate: 0 }, hover: n.nudge ? NUDGE[n.nudge] : {} }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="flex size-4 items-center justify-center [&>svg]:size-4"
              >
                {n.icon}
              </motion.span>
              {n.label}
              {n.count !== undefined && (
                <span
                  className={cn(
                    "ml-auto eyebrow tabular-nums",
                    n.attention ? "text-attention" : "text-faint-foreground"
                  )}
                >
                  {n.count}
                </span>
              )}
            </motion.button>
          </React.Fragment>
        ))}
        {/* Not part of the product: a switch to see the screens under load. */}
        <label className="mt-auto flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-dashed border-border px-2 py-2">
          <span className="flex flex-col">
            <span className="text-xs">Busy factory</span>
            <span className="eyebrow text-faint-foreground">Simulation</span>
          </span>
          <Switch size="sm" checked={busy} onCheckedChange={setBusy} />
        </label>
        <div className="mt-2 flex items-center justify-between gap-2 pl-2">
          <span className="eyebrow text-faint-foreground">
            Next digest 21:00
          </span>
          <ThemeToggle />
        </div>
      </nav>

      <main className="flex min-h-0 flex-col">
        {/* Phones: the same entry as a select. */}
        <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border/70 px-4 md:hidden">
          <button
            type="button"
            aria-label="Inbox"
            onClick={() => {
              setView("inbox")
              setPanel(null)
            }}
            className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <AgentOrb
              phase={open.length ? "waiting" : "idle"}
              active={open.length > 0}
            />
          </button>
          <Select
            value={view}
            onValueChange={(v) => {
              if (!v) return
              setView(v as View)
              setPanel(null)
            }}
          >
            <SelectTrigger aria-label="View" className="ml-auto">
              <SelectValue>{(v: View) => label(v)}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false}>
              {nav.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.label}
                  {n.count !== undefined ? ` · ${n.count}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ThemeToggle />
        </header>

        {view === "inbox" && (
          <Inbox
            open={open}
            answers={answers}
            onAnswer={answer}
            onRule={makeRule}
            onUndo={undo}
            onPanel={setPanel}
            decidedCount={decided.filter((d) => !d.undone).length}
            onDecided={() => setView("decided")}
            onProjects={() => setView("projects")}
            since={SINCE[busy ? "busy" : "calm"]}
          />
        )}
        {view.startsWith("thread:") && (
          <Thread
            project={view.slice(7) as Project}
            messages={threads[view.slice(7) as Project]}
            typing={typing}
            onAsk={(text) => ask(view.slice(7) as Project, text)}
            answers={answers}
            onInbox={() => setView("inbox")}
          />
        )}
        {view === "projects" && (
          <Projects
            state={factory}
            onTask={(key) => setPanel({ kind: "task", key })}
          />
        )}
        {view === "decided" && (
          <DecidedLog
            items={decided}
            rules={rules}
            onUndo={(id) =>
              setDecided((d) =>
                d.map((x) => (x.id === id ? { ...x, undone: true } : x))
              )
            }
          />
        )}
        {view === "rules" && (
          <Rules
            items={rules}
            onToggle={(id) =>
              setRules((r) =>
                r.map((x) => (x.id === id ? { ...x, off: !x.off } : x))
              )
            }
          />
        )}
      </main>

      {/* Deep dives: a side panel on wide screens, a sheet on phones. */}
      <AnimatePresence>
        {panel && (
          <motion.aside
            key={panel.kind}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={enter}
            className="fixed inset-0 z-[60] flex min-h-0 flex-col bg-background lg:static lg:z-auto lg:border-l lg:border-border/70"
          >
            <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border/70 px-4">
              <span className="text-[15px]">
                {panel.kind === "diff"
                  ? `${RISKY_DIFF.key} · diff`
                  : panel.kind === "preview"
                    ? "BLOG-5 · before / after"
                    : panel.key}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                className="ml-auto text-muted-foreground"
                onClick={() => setPanel(null)}
              >
                <XIcon />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {panel.kind === "diff" && (
                <DiffCard
                  diff={RISKY_DIFF}
                  state={
                    answers["q-diff"]
                      ? answers["q-diff"].label === "Approve"
                        ? "approved"
                        : "returned"
                      : "open"
                  }
                  onDecide={(ok) =>
                    answer(
                      QUEUE.find((q) => q.id === "q-diff")!,
                      ok ? "Approve" : "Return",
                      ok
                    )
                  }
                />
              )}
              {panel.kind === "preview" && (
                <div className="flex flex-col gap-4">
                  {[false, true].map((after) => (
                    <figure key={String(after)} className="flex flex-col gap-2">
                      <figcaption className="eyebrow text-muted-foreground">
                        {after ? "After" : "Before"} · 400 and 1440 px
                      </figcaption>
                      <div className="aspect-[16/10] overflow-hidden rounded-xl border border-border/70 bg-card">
                        <BlogPreview after={after} />
                      </div>
                    </figure>
                  ))}
                </div>
              )}
              {panel.kind === "task" && (
                <TaskPath state={factory} taskKey={panel.key} />
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------- inbox ------------------------------ */

function Inbox({
  open,
  answers,
  onAnswer,
  onRule,
  onUndo,
  onPanel,
  decidedCount,
  onDecided,
  onProjects,
  since,
}: {
  since: { shipped: number; stuck: number }
  open: QueueItem[]
  answers: Record<string, Answer>
  onAnswer: (q: QueueItem, label: string, pick: boolean) => void
  onRule: (q: QueueItem) => void
  onUndo: (id: string) => void
  onPanel: (p: Panel) => void
  decidedCount: number
  onDecided: () => void
  onProjects: () => void
}) {
  // Newest first: it lands right under the cards it left.
  const answered = Object.keys(answers)
    .reverse()
    .map((id) => QUEUE.find((q) => q.id === id)!)
  const urgent = open.find((q) => q.urgency === "now")

  // "Now" stays in reach: once its card scrolls away, a compact bar pins it.
  const scroller = React.useRef<HTMLDivElement>(null)
  const nowCard = React.useRef<HTMLElement>(null)
  const [nowAway, setNowAway] = React.useState(false)
  React.useEffect(() => {
    const el = nowCard.current
    if (!el || !scroller.current) return setNowAway(false)
    const io = new IntersectionObserver(
      ([e]) => setNowAway(!e.isIntersecting),
      { root: scroller.current, threshold: 0.15 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [urgent?.id])

  const link =
    "underline decoration-border underline-offset-4 hover:text-foreground"

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
      <AnimatePresence>
        {urgent && nowAway && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={enter}
            className="sticky top-0 z-10 border-b border-border/70 bg-background/90 backdrop-blur"
          >
            <div className="mx-auto flex w-full max-w-[44rem] items-center gap-3 px-4 py-2.5 sm:px-6">
              <StatusDot tone="attention" pulse />
              <span className="shrink-0 eyebrow text-attention">Now</span>
              <button
                type="button"
                onClick={() =>
                  nowCard.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
                className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
              >
                {urgent.title}
              </button>
              {urgent.kind === "incident" && (
                <Button
                  size="xs"
                  className="shrink-0 rounded-full"
                  onClick={() => onAnswer(urgent, "Reverted 3f2a1c", true)}
                >
                  Revert
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-8 px-4 pt-6 pb-28 sm:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl tracking-[-0.01em]">
            {open.length
              ? `${open.length} decisions need you`
              : "Nothing needs you"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Since 21:00:{" "}
            <button type="button" onClick={onProjects} className={link}>
              {since.shipped} shipped
            </button>
            ,{" "}
            <button type="button" onClick={onProjects} className={link}>
              {since.stuck} stuck
            </button>
            ,{" "}
            <button type="button" onClick={onDecided} className={link}>
              {decidedCount} decided for you
            </button>
            .
          </p>
        </div>

        {/* Every move shows where things went: an answered card sinks toward
            "Answered today" and its row drops in from above; the cards below
            glide up into the gap; Undo plays it backwards. */}
        <LayoutGroup>
          <AnimatePresence initial={false} mode="popLayout">
            {(["now", "today", "later"] as Urgency[]).map((u) => {
              const items = open.filter((q) => q.urgency === u)
              if (!items.length) return null
              return (
                <motion.section
                  key={u}
                  layout="position"
                  ref={u === "now" ? nowCard : undefined}
                  exit={{ opacity: 0 }}
                  transition={{ ...enter, layout: springSoft }}
                  className="flex scroll-my-24 flex-col gap-3"
                >
                  <h2
                    className={cn(
                      "px-1 eyebrow",
                      u === "now" ? "text-attention" : "text-muted-foreground"
                    )}
                  >
                    {URGENCY[u]}
                  </h2>
                  <AnimatePresence initial={false} mode="popLayout">
                    {items.map((q) => (
                      <motion.div
                        key={q.id}
                        layout="position"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.98 }}
                        transition={{ ...enter, layout: springSoft }}
                      >
                        <QueueCard
                          item={q}
                          onAnswer={onAnswer}
                          onRule={onRule}
                          onPanel={onPanel}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.section>
              )
            })}

            {answered.length > 0 && (
              <motion.section
                key="answered"
                layout="position"
                exit={{ opacity: 0 }}
                transition={{ ...enter, layout: springSoft }}
                className="flex flex-col gap-2"
              >
                <h2 className="px-1 eyebrow text-muted-foreground">
                  Answered today
                </h2>
                <AnimatePresence initial={false} mode="popLayout">
                  {answered.map((q) => {
                    const a = answers[q.id]
                    return (
                      <motion.div
                        key={q.id}
                        layout="position"
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ ...enter, delay: 0.12, layout: springSoft }}
                        className="relative flex items-center gap-2"
                      >
                        {/* The row that just arrived glows once, so the eye finds it. */}
                        <motion.span
                          aria-hidden
                          initial={{ opacity: 1 }}
                          animate={{ opacity: 0 }}
                          transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
                          className="pointer-events-none absolute -inset-x-2 -inset-y-1 rounded-xl bg-muted"
                        />
                        <ResolvedRow
                          className="relative min-w-0 flex-1"
                          icon={a.by === "rule" ? <ScaleIcon /> : <CheckIcon />}
                          label={a.label}
                          summary={`${q.title} · ${a.at}${a.by === "rule" ? " · by your new rule" : a.pick ? " · davinci's pick" : ""}`}
                        />
                        {(q.reversible || a.by === "rule") && (
                          <Button
                            size="xs"
                            variant="ghost"
                            className="relative shrink-0 text-muted-foreground"
                            onClick={() => onUndo(q.id)}
                          >
                            <Undo2Icon />
                            Undo
                          </Button>
                        )}
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </motion.section>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </div>
    </div>
  )
}

function QueueCard({
  item: q,
  onAnswer,
  onRule,
  onPanel,
}: {
  item: QueueItem
  onAnswer: (q: QueueItem, label: string, pick: boolean) => void
  onRule: (q: QueueItem) => void
  onPanel: (p: Panel) => void
}) {
  const ratio = q.agreement ? q.agreement.accepted / q.agreement.total : 0
  // Answering drains the urgent glow first; the card leaves once it's out.
  const [settling, setSettling] = React.useState(false)
  const settle = (then: () => void) => {
    setSettling(true)
    window.setTimeout(then, q.urgency === "now" ? 320 : 0)
  }
  const answer = (label: string, pick: boolean) =>
    settle(() => onAnswer(q, label, pick))
  return (
    <ActionCard
      tone={q.urgency === "now" && !settling ? "attention" : "default"}
    >
      <ActionCardHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="eyebrow text-muted-foreground">
            {q.project} · {q.category}
          </span>
          <ActionCardTitle>{q.title}</ActionCardTitle>
        </div>
        {/* Mark the exception only: most decisions can be undone. */}
        {!q.reversible && (
          <ActionCardStatus tone="neutral">Irreversible</ActionCardStatus>
        )}
      </ActionCardHeader>
      <ActionCardDescription className="mt-0">
        {q.context}
      </ActionCardDescription>

      {q.kind === "choice" && q.options && (
        <div className="flex flex-col gap-1.5">
          {q.options.map((o, i) => {
            const pick = o.id === q.pick
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => answer(o.label, pick)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/30",
                  pick ? "border-foreground/40" : "border-border/80"
                )}
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-muted eyebrow text-muted-foreground">
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-x-2">
                    {o.label}
                    {pick && (
                      <span className="rounded-full bg-foreground/5 px-1.5 eyebrow text-muted-foreground">
                        davinci's pick
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {o.hint}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        <span className="text-foreground">If you go with davinci:</span>{" "}
        {q.consequence}
      </p>

      {q.kind !== "choice" && (
        <ActionCardActions className="flex-wrap">
          {q.kind === "incident" && (
            <>
              <Button size="sm" onClick={() => answer("Reverted 3f2a1c", true)}>
                <RotateCcwIcon />
                Revert 3f2a1c
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => answer("Kept v12", false)}
              >
                Keep and investigate
              </Button>
            </>
          )}
          {q.kind === "diff" && (
            <>
              <Button size="sm" onClick={() => answer("Approve", true)}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => answer("Return", false)}
              >
                Return with note
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => onPanel({ kind: "diff" })}
              >
                See the diff
              </Button>
            </>
          )}
          {q.kind === "preview" && (
            <>
              <Button size="sm" onClick={() => answer("Promoted BLOG-5", true)}>
                Promote
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => answer("Adjust BLOG-5", false)}
              >
                Adjust
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => onPanel({ kind: "preview" })}
              >
                Before / after
              </Button>
            </>
          )}
        </ActionCardActions>
      )}

      {/* Repeated agreement is a sign the decision shouldn't be yours. */}
      {q.agreement && (
        <div className="-mx-3.5 -mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-b-2xl border-t border-border/70 bg-card/60 px-3.5 py-2.5 text-xs">
          <span className="text-muted-foreground">
            You went with davinci's pick{" "}
            <span className="text-foreground tabular-nums">
              {q.agreement.accepted} of {q.agreement.total}
            </span>{" "}
            times in {q.category.toLowerCase()}.
          </span>
          {ratio >= 0.9 && (
            <Button
              size="xs"
              variant="outline"
              className="ml-auto rounded-full"
              onClick={() => settle(() => onRule(q))}
            >
              <ScaleIcon />
              Make it a rule
            </Button>
          )}
        </div>
      )}
    </ActionCard>
  )
}

/* ------------------------------ threads ----------------------------- */

const SUGGEST: Record<Project, string[]> = {
  blog: ["Why did the RSS break?", "What's next for the blog?"],
  bottega: ["Will the quota last?", "What did you decide overnight?"],
}

function Thread({
  project,
  messages,
  typing,
  onAsk,
  answers,
  onInbox,
}: {
  project: Project
  messages: UIMessage[]
  typing: boolean
  onAsk: (text: string) => void
  answers: Record<string, Answer>
  onInbox: () => void
}) {
  const [input, setInput] = React.useState("")
  const tools: ToolRegistry = {
    evidence: { render: () => <EvidenceCard /> },
    quota: { render: () => <QuotaCard /> },
    // Live status of the inbox item a message talks about: never stale.
    ref: {
      render: (part: { toolCallId: string }) => {
        const q = QUEUE.find((x) => x.id === part.toolCallId)!
        const a = answers[q.id]
        return (
          <button
            type="button"
            onClick={onInbox}
            className="not-typeset flex w-fit items-center gap-2 rounded-full border border-border/80 bg-card px-3 py-1.5 text-xs shadow-xs transition-colors hover:bg-muted/60"
          >
            {a ? (
              <CheckIcon className="size-3.5 text-muted-foreground" />
            ) : (
              <StatusDot tone="attention" />
            )}
            <span className="text-muted-foreground">{q.title}</span>
            <span>
              {a
                ? `${a.label} · ${a.at}`
                : q.urgency === "now"
                  ? "Waits in your inbox · Now"
                  : "Waits in your inbox"}
            </span>
          </button>
        )
      },
    },
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/70 px-4 py-2.5 text-sm sm:px-6">
        <span className="eyebrow text-muted-foreground">Thread</span>
        <span>{project}</span>
        <button
          type="button"
          onClick={onInbox}
          className="ml-auto text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
        >
          Decisions live in the inbox
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <ChatThread
          busy={typing}
          className="mx-auto w-full max-w-[44rem] gap-6 px-4 py-6 sm:px-6"
        >
          {messages.map((m, i) => (
            <ChatThreadItem key={m.id} message={m}>
              <ChatTurn
                message={m}
                tools={tools}
                phase={typing ? "composing" : "idle"}
                active={typing && i === messages.length - 1}
                actions={false}
              />
            </ChatThreadItem>
          ))}
        </ChatThread>
      </div>
      <div className="mx-auto w-full max-w-[44rem] shrink-0 px-4 pb-4 sm:px-6">
        <div className="mb-2 flex [scrollbar-width:none] gap-2 overflow-x-auto">
          {SUGGEST[project].map((s) => (
            <Button
              key={s}
              variant="outline"
              size="sm"
              className="shrink-0 rounded-full font-normal"
              onClick={() => onAsk(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        <div className="rounded-2xl border border-border bg-card shadow-xs">
          <Composer
            onSubmit={() => {
              if (!input.trim()) return
              onAsk(input.trim())
              setInput("")
            }}
          >
            <ComposerInput
              aria-label={`Message about ${project}`}
              placeholder={`Ask about ${project}…`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-12"
            />
            <ComposerToolbar>
              <ComposerSubmit
                className="ml-auto"
                busy={false}
                disabled={!input.trim()}
              />
            </ComposerToolbar>
          </Composer>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ projects ---------------------------- */

// Container queries: the table follows its own width (a side panel may be open).
const COLS =
  "grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-y-2.5 @xl:grid-cols-[minmax(8rem,1fr)_minmax(12rem,18rem)_minmax(6rem,8rem)]"

// Many tasks in flight: what needs you first, then what's moving, then the
// queue; past a handful the rest folds away, and the stage names carry how
// many tasks sit at each stage, so the pile-up shows without reading rows.
const FOLD_AFTER = 8
const SHOWN = 6

type Task = ProjectState["tasks"][number]
const rank = (t: Task) =>
  t.stages.some((s) => s === "waiting" || s === "failed")
    ? 0
    : t.stages.every((s) => s === "todo")
      ? 2
      : 1
const atStage = (t: Task) => {
  const i = t.stages.findIndex((s) => s !== "done")
  return i === -1 ? t.stages.length - 1 : i
}

function Projects({
  state,
  onTask,
}: {
  state: ProjectState[]
  onTask: (key: string) => void
}) {
  const [unfolded, setUnfolded] = React.useState<Record<string, boolean>>({})
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="@container mx-auto flex w-full max-w-[52rem] flex-col gap-8 px-4 pt-6 pb-28 sm:px-6">
        <p className="text-sm text-muted-foreground">
          To look at when you want. Nothing here needs you; that's what the
          inbox is for.
        </p>
        {state.map((p) => {
          const many = p.tasks.length > FOLD_AFTER
          const tasks = [...p.tasks].sort(
            (x, y) => rank(x) - rank(y) || atStage(y) - atStage(x)
          )
          const queued = tasks.filter((t) => rank(t) === 2).length
          const shown = many && !unfolded[p.id] ? tasks.slice(0, SHOWN) : tasks
          const labels = STAGES.map((label, i) => ({
            label,
            count: many
              ? tasks.filter((t) => rank(t) < 2 && atStage(t) === i).length
              : undefined,
          }))
          return (
            <Widget key={p.id}>
              <WidgetHeader>
                <WidgetTitle>{p.id}</WidgetTitle>
                <span className="truncate eyebrow text-muted-foreground">
                  {p.live}
                  {many && (
                    <>
                      {" · "}
                      <span className="tabular-nums">
                        {tasks.length - queued}
                      </span>{" "}
                      in flight
                      {queued > 0 && (
                        <>
                          {" · "}
                          <span className="tabular-nums">{queued}</span> queued
                        </>
                      )}
                    </>
                  )}
                </span>
                <StatusBadge
                  tone={p.health === "ok" ? "success" : "warning"}
                  className="ml-auto"
                >
                  {p.health === "ok" ? "Healthy" : "Degraded"}
                </StatusBadge>
              </WidgetHeader>
              <WidgetPanel className="flex flex-col pt-3">
                <WidgetList>
                  <div
                    className={cn(
                      "grid items-center gap-x-3 px-2 pb-2 @max-xl:hidden",
                      COLS
                    )}
                  >
                    <span className="eyebrow text-muted-foreground">Task</span>
                    <StageTrackLabels stages={labels} />
                    <span className="text-right eyebrow text-muted-foreground">
                      Now
                    </span>
                  </div>
                  {/* Narrow: the tracks span the row, so do the names. */}
                  <StageTrackLabels
                    className="px-2 pb-2 @xl:hidden"
                    stages={labels}
                  />
                  {shown.map((t) => (
                    <WidgetListRow
                      key={t.key}
                      className={COLS}
                      onClick={() => onTask(t.key)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <ModelIcon
                          family={t.family}
                          className="size-4 text-muted-foreground"
                        />
                        <span className="shrink-0 eyebrow text-muted-foreground">
                          {t.key}
                        </span>
                        <span className="truncate">{t.title}</span>
                      </span>
                      <StageTrack
                        className="order-last col-span-2 @xl:order-none @xl:col-span-1"
                        stages={t.stages.map((status, i) => ({
                          label: STAGES[i],
                          status,
                        }))}
                      />
                      <span
                        className={cn(
                          "truncate text-right text-xs",
                          rank(t) === 0
                            ? "text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {t.now}
                      </span>
                    </WidgetListRow>
                  ))}
                </WidgetList>
              </WidgetPanel>
              {many && (
                <WidgetFooter>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="-ml-1 text-muted-foreground"
                    onClick={() =>
                      setUnfolded((u) => ({ ...u, [p.id]: !u[p.id] }))
                    }
                  >
                    {unfolded[p.id]
                      ? "Show fewer"
                      : `Show ${tasks.length - SHOWN} more`}
                  </Button>
                </WidgetFooter>
              )}
            </Widget>
          )
        })}
      </div>
    </div>
  )
}

function TaskPath({
  state,
  taskKey,
}: {
  state: ProjectState[]
  taskKey: string
}) {
  const task = state.flatMap((p) => p.tasks).find((t) => t.key === taskKey)!
  const steps = STAGES.slice(
    0,
    task.stages.findIndex((s) => s !== "done") === -1
      ? STAGES.length
      : task.stages.findIndex((s) => s !== "done") + 1
  )
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[15px]">{task.title}</span>
        <span className="text-sm text-muted-foreground">{task.now}</span>
      </div>
      <StageTrack
        labeled
        stages={task.stages.map((status, i) => ({ label: STAGES[i], status }))}
      />
      <div className="flex flex-col gap-2">
        <span className="eyebrow text-faint-foreground">Today</span>
        {steps.map((s, i) => (
          <div
            key={s}
            className="grid grid-cols-[3rem_1fr_auto] items-baseline gap-2 text-sm"
          >
            <span className="eyebrow text-muted-foreground tabular-nums">{`${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "34" : "12"}`}</span>
            <span>
              {s === "Plan"
                ? "Plan written from the conversation"
                : s === "Build"
                  ? "Built and committed"
                  : s === "Gates"
                    ? "Gates passed"
                    : s === "Review"
                      ? "Reviewed by the other family"
                      : s === "Next"
                        ? "On next"
                        : "On main"}
            </span>
            <span className="eyebrow text-faint-foreground tabular-nums">
              {["48 s", "7 min", "52 s", "3 min", "1 min", "—"][i]}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        More detail:{" "}
        <code className="font-mono">bottega task show {task.key}</code>
      </p>
    </div>
  )
}

/* ------------------------------ decided ----------------------------- */

function DecidedLog({
  items,
  rules,
  onUndo,
}: {
  items: (Decided & { undone?: boolean })[]
  rules: Rule[]
  onUndo: (id: string) => void
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-4 px-4 pt-6 pb-28 sm:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl tracking-[-0.01em]">Decided for you</h1>
          <p className="text-sm text-muted-foreground">
            Everything davinci decided without asking, with why. Undo what you
            disagree with.
          </p>
        </div>
        <WidgetPanel className="flex flex-col pt-3">
          <WidgetList>
            {items.map((d) => {
              const rule = rules.find((r) => r.id === d.rule)
              return (
                <WidgetListRow
                  key={d.id}
                  className="grid-cols-[3rem_minmax(0,1fr)_auto] items-start"
                  dimmed={d.undone}
                >
                  <span className="pt-0.5 eyebrow text-muted-foreground tabular-nums">
                    {d.time}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span>
                      <span className="text-muted-foreground">
                        {d.project} ·{" "}
                      </span>
                      {d.what}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {d.why}
                      {rule && (
                        <span className="text-faint-foreground">
                          {" "}
                          · rule: {rule.text.toLowerCase()}
                        </span>
                      )}
                    </span>
                  </span>
                  {d.undone ? (
                    <span className="pt-0.5 eyebrow text-muted-foreground">
                      Undone
                    </span>
                  ) : d.reversible ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => onUndo(d.id)}
                    >
                      <Undo2Icon />
                      Undo
                    </Button>
                  ) : (
                    <span className="pt-0.5 eyebrow text-faint-foreground">
                      Final
                    </span>
                  )}
                </WidgetListRow>
              )
            })}
          </WidgetList>
        </WidgetPanel>
      </div>
    </div>
  )
}

/* ------------------------------- rules ------------------------------ */

function Rules({
  items,
  onToggle,
}: {
  items: (Rule & { off?: boolean })[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-4 px-4 pt-6 pb-28 sm:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl tracking-[-0.01em]">Rules</h1>
          <p className="text-sm text-muted-foreground">
            Decisions that stopped being yours. Each one came from agreeing with
            davinci again and again.
          </p>
        </div>
        <WidgetPanel className="flex flex-col pt-3">
          <WidgetList>
            {items.map((r) => (
              // A rule is a standing state, not an action: a switch shows it at
              // a glance. The whole row is its label.
              <WidgetListRow key={r.id} className="grid-cols-1 py-0">
                <label className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2.5">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span
                      className={cn(
                        "transition-colors",
                        r.off && "text-muted-foreground"
                      )}
                    >
                      {r.text}
                    </span>
                    <span className="eyebrow text-muted-foreground">
                      {r.off ? (
                        <span className="text-foreground">
                          Off · these come back to your inbox
                        </span>
                      ) : (
                        <>
                          {r.category} · applied{" "}
                          <span className="tabular-nums">{r.applied}</span>×
                        </>
                      )}
                    </span>
                  </span>
                  <Switch
                    checked={!r.off}
                    onCheckedChange={() => onToggle(r.id)}
                    className="data-checked:border-brand data-checked:bg-brand"
                  />
                </label>
              </WidgetListRow>
            ))}
          </WidgetList>
        </WidgetPanel>
      </div>
    </div>
  )
}
