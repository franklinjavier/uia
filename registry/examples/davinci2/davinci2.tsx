import * as React from "react"
import type { UIMessage } from "ai"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import {
  CheckIcon,
  HistoryIcon,
  InboxIcon,
  LayersIcon,
  RotateCcwIcon,
  ScaleIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { enter, springSoft } from "@/lib/motion"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import type { AgentPhase } from "@/components/ds/agent-orb"
import { ModelIcon } from "@/components/ds/model-icons"
import { Stepper } from "@/components/ds/stepper"
import { TaskListHeader, TaskRow, taskRank, taskStage } from "@/components/ds/task-list"
import { AppNav, AppNavSelect, type AppNavItem } from "@/components/app/app-nav"
import { ThemeToggle } from "@/components/app/theme-toggle"
import { DecisionCard, type DecisionAction } from "@/components/parts/decision-card"
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
import { ResolvedRow } from "@/components/parts/action-card"
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
// Deep dives open in a side panel (a sheet below lg), not inline.

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

// lg and up: the panel is a third column; below, a sheet.
const WIDE = "(min-width: 64rem)"
function useWide() {
  return React.useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(WIDE)
      mq.addEventListener("change", onChange)
      return () => mq.removeEventListener("change", onChange)
    },
    () => window.matchMedia(WIDE).matches
  )
}

/**
 * Pass `view` and `onViewChange` to drive the view from your router (each
 * view its own route); leave them out and it keeps the view itself.
 */
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
  const view = viewProp ?? ownView
  const setView = (v: View) => (onViewChange ? onViewChange(v) : setOwnView(v))
  const [panel, setPanel] = React.useState<Panel>(null)
  const wide = useWide()
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

  const nav: AppNavItem<View>[] = [
    { id: "inbox", label: "Inbox", icon: <InboxIcon />, nudge: "drop", count: open.length, attention: open.length > 0 },
    { id: "thread:blog", label: "blog", agent: true, section: "Threads" },
    { id: "thread:bottega", label: "bottega", agent: true, section: "Threads" },
    { id: "projects", label: "Projects", icon: <LayersIcon />, nudge: "lift", section: "Look" },
    {
      id: "decided",
      label: "Decided for you",
      icon: <HistoryIcon />,
      nudge: "rewind",
      count: decided.filter((d) => !d.undone).length,
      section: "Look",
    },
    {
      id: "rules",
      label: "Rules",
      icon: <ScaleIcon />,
      nudge: "weigh",
      count: rules.filter((r) => !r.off).length,
      section: "Look",
    },
  ]
  const go = (v: View) => {
    setView(v)
    setPanel(null)
  }
  const brand = {
    name: "davinci",
    phase: (typing ? "composing" : open.length ? "waiting" : "idle") as AgentPhase,
    active: typing || open.length > 0,
    onHome: () => go("inbox"),
  }

  // The sheet animates out after `panel` is null: keep the last one shown.
  const [shown, setShown] = React.useState<Panel>(panel)
  if (panel && panel !== shown) setShown(panel)
  const panelTitle = (p: NonNullable<Panel>) =>
    p.kind === "diff"
      ? `${RISKY_DIFF.key} · diff`
      : p.kind === "preview"
        ? "BLOG-5 · before / after"
        : p.key
  const panelBody = (p: NonNullable<Panel>) => (
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {p.kind === "diff" && (
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
        {p.kind === "preview" && (
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
        {p.kind === "task" && (
          <TaskPath state={factory} taskKey={p.key} />
        )}
      </div>
  )

  return (
    <div
      data-slot="davinci-inbox"
      className={cn(
        "grid h-svh grid-cols-1 bg-background md:grid-cols-[14rem_minmax(0,1fr)]",
        panel && "lg:grid-cols-[14rem_minmax(0,1fr)_26rem]"
      )}
    >
      {/* Navigation: one entry, everything one click away. */}
      <AppNav
        className="hidden border-r border-border/70 md:flex"
        brand={brand}
        items={nav}
        value={view}
        onValueChange={go}
        footer={
          <>
            {/* Not part of the product: a switch to see the screens under load. */}
            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-dashed border-border px-2 py-2">
              <span className="flex flex-col">
                <span className="text-xs">Busy factory</span>
                <span className="eyebrow text-faint-foreground">Simulation</span>
              </span>
              <Switch size="sm" checked={busy} onCheckedChange={setBusy} />
            </label>
            <div className="flex items-center justify-between gap-2 pl-2">
              <span className="eyebrow text-faint-foreground">Next digest 21:00</span>
              <ThemeToggle />
            </div>
          </>
        }
      />

      <main className="flex min-h-0 flex-col">
        {/* Phones: the same entry as a select. */}
        <AppNavSelect className="md:hidden" brand={brand} items={nav} value={view} onValueChange={go} trailing={<ThemeToggle />} />

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

      {/* Deep dives: a third column on wide screens, beside the inbox; a
          full-screen sheet below lg (focus trap, Esc, scroll lock). */}
      <AnimatePresence>
        {wide && panel && (
          <motion.aside
            key={panel.kind}
            aria-label={panelTitle(panel)}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={enter}
            className="flex min-h-0 flex-col border-l border-border/70 bg-background"
          >
            <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border/70 px-4">
              <span className="text-[15px]">{panelTitle(panel)}</span>
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
            {panelBody(panel)}
          </motion.aside>
        )}
      </AnimatePresence>
      <Sheet
        open={!wide && !!panel}
        onOpenChange={(o) => {
          if (!o) setPanel(null)
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="z-[60] bg-background text-base text-foreground shadow-none duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] data-[side=right]:w-full data-[side=right]:border-l-0 data-[side=right]:sm:max-w-none data-[side=right]:data-ending-style:translate-x-3 data-[side=right]:data-starting-style:translate-x-3"
        >
          {/* Keeps its content through the exit, after `panel` is null. */}
          {shown && (
            <>
              <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border/70 px-4">
                <SheetTitle className="font-sans text-[15px] font-normal">
                  {panelTitle(shown)}
                </SheetTitle>
                <SheetClose
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Close"
                      className="ml-auto text-muted-foreground"
                    />
                  }
                >
                  <XIcon />
                </SheetClose>
              </div>
              {panelBody(shown)}
            </>
          )}
        </SheetContent>
      </Sheet>
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

// The inbox's card is the DS DecisionCard: kinds map to their actions.
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
  const answer = (label: string, pick: boolean) => () => onAnswer(q, label, pick)
  const actions: DecisionAction[] =
    q.kind === "incident"
      ? [
          { label: "Revert 3f2a1c", icon: <RotateCcwIcon />, onClick: answer("Reverted 3f2a1c", true) },
          { label: "Keep and investigate", kind: "secondary", onClick: answer("Kept v12", false) },
        ]
      : q.kind === "diff"
        ? [
            { label: "Approve", onClick: answer("Approve", true) },
            { label: "Return with note", kind: "secondary", onClick: answer("Return", false) },
            { label: "See the diff", kind: "aside", onClick: () => onPanel({ kind: "diff" }) },
          ]
        : q.kind === "preview"
          ? [
              { label: "Promote", onClick: answer("Promoted BLOG-5", true) },
              { label: "Adjust", kind: "secondary", onClick: answer("Adjust BLOG-5", false) },
              { label: "Before / after", kind: "aside", onClick: () => onPanel({ kind: "preview" }) },
            ]
          : []
  return (
    <DecisionCard
      agent="davinci"
      urgent={q.urgency === "now"}
      eyebrow={`${q.project} · ${q.category}`}
      title={q.title}
      context={q.context}
      options={q.kind === "choice" ? q.options : undefined}
      pick={q.pick}
      onChoose={(o, isPick) => onAnswer(q, o.label, isPick)}
      consequence={q.consequence}
      actions={actions}
      irreversible={!q.reversible}
      agreement={q.agreement && { ...q.agreement, category: q.category }}
      onMakeRule={() => onRule(q)}
    />
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

// Many tasks in flight: what needs you first, then what's moving, then the
// queue; past a handful the rest folds away, and the stage names carry how
// many tasks sit at each stage, so the pile-up shows without reading rows.
const FOLD_AFTER = 8
const SHOWN = 6

type Task = ProjectState["tasks"][number]
const rank = (t: Task) => taskRank(t.stages)
const atStage = (t: Task) => taskStage(t.stages)

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
                  <TaskListHeader stages={labels} />
                  {shown.map((t) => (
                    <TaskRow
                      key={t.key}
                      id={t.key}
                      title={t.title}
                      icon={<ModelIcon family={t.family} />}
                      stages={t.stages.map((status, i) => ({ label: STAGES[i], status }))}
                      now={t.now}
                      onClick={() => onTask(t.key)}
                    />
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
      <Stepper
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
