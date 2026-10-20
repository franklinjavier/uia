import * as React from "react"
import type { UIMessage } from "ai"
import { AnimatePresence } from "motion/react"
import { FolderIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AgentOrb } from "@/components/ds/agent-orb"
import { DecisionChip } from "@/components/parts/decision-chip"
import { PartTransition } from "@/components/parts/part-transition"
import { PreviewApproval, PreviewApprovalResolved } from "@/components/parts/preview-approval"
import { ChatThread, ChatThreadItem } from "@/components/chat/chat-thread"
import { ChatTurn } from "@/components/chat/chat-turn"
import { Composer, ComposerInput, ComposerMic, ComposerSubmit, ComposerToolbar } from "@/components/chat/composer"
import type { ToolRegistry } from "@/components/chat/tool-registry"
import {
  DecisionCard,
  DiffCard,
  DigestCard,
  EvidenceCard,
  IncidentCard,
  QuotaCard,
  SimilarTasks,
  TaskCard,
} from "@/examples/davinci/cards"
import {
  INCIDENT,
  MORNING_DECISIONS,
  NEW_TASK,
  NEW_TASK_SCRIPT,
  RISKY_DIFF,
  type Project,
  type Task,
} from "@/examples/davinci/davinci-data"

// davinci: the whole Bottega factory as one conversation. The owner only
// decides what needs judgment; everything else is routine, collapsed into a
// line. Decisions are pinned until answered, each answer is one tap (with
// davinci's pick marked), and evidence is one tap away. Mobile first.

let seq = 0
const mid = () => `m-${++seq}`
const say = (role: "user" | "assistant", text: string): UIMessage => ({ id: mid(), role, parts: [{ type: "text", text }] })
const withText = (text: string, ...cards: [string, string][]): UIMessage => ({
  id: mid(),
  role: "assistant",
  parts: [
    { type: "text", text },
    ...cards.map(([name, id]) => ({ type: `tool-${name}`, toolCallId: id, state: "input-available", input: {} }) as UIMessage["parts"][number]),
  ],
})

const SUGGESTIONS = [
  "Add an Open Source section to the blog, sorted by stars",
  "Why was the factory idle last night?",
  "Will the quota last?",
] as const

type Pending = { id: string; project: Project; kind: string; subject: string; ask: string }

export function Davinci() {
  const [messages, setMessages] = React.useState<UIMessage[]>(() => [
    say("user", "Good morning"),
    withText(
      "Morning. **7 tasks reached main overnight**; the blog check is the only thing stuck. Three things need you:",
      ["digest", "digest"],
      ...MORNING_DECISIONS.map((d) => ["decision", d.id] as [string, string]),
      ["diff", RISKY_DIFF.id]
    ),
  ])
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  const [diff, setDiff] = React.useState<"open" | "approved" | "returned">("open")
  const [incident, setIncident] = React.useState<"none" | "open" | "reverted" | "kept">("none")
  const [task, setTask] = React.useState<Task | null>(null)
  const [preview, setPreview] = React.useState<{ state: "none" | "open" | "accepted" | "declined"; note?: string }>({ state: "none" })
  const [typing, setTyping] = React.useState(false)
  const [input, setInput] = React.useState("")
  const [project, setProject] = React.useState<"all" | Project>("all")
  const [flash, setFlash] = React.useState<string | null>(null)
  const [used, setUsed] = React.useState<string[]>([])

  const later = (ms: number, fn: () => void) => window.setTimeout(fn, ms)
  const reply = (msgs: UIMessage[], delay = 800) => {
    setTyping(true)
    later(delay, () => {
      setTyping(false)
      setMessages((list) => [...list, ...msgs])
    })
  }

  // A production check fails a few seconds in: the live part of the demo.
  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setIncident("open")
      setMessages((list) => [
        ...list,
        withText("Production check failed on the **blog**. My pick: revert the culprit, it's isolated.", ["incident", INCIDENT.id]),
      ])
    }, 6000)
    return () => window.clearTimeout(t)
  }, [])

  function ask(text: string) {
    setMessages((list) => [...list, say("user", text)])
    setUsed((u) => [...u, text])

    if (text === SUGGESTIONS[0]) {
      reply([
        withText(
          "Got it: a page listing your public repos, most stars first, refreshed daily. Two similar things are done already, so it reuses them:",
          ["similar", "similar"]
        ),
        withText("Created **BLOG-5**. I'll follow it here; you only hear from it if it needs you.", ["task", NEW_TASK.key]),
      ])
      later(900, () => setTask(NEW_TASK))
      NEW_TASK_SCRIPT.forEach((s, i) =>
        later(3200 * (i + 1), () => {
          setTask((t) => t && { ...t, stage: s.stage, now: s.now, state: s.state ?? "working", path: [...t.path, s.step] })
          if (i === NEW_TASK_SCRIPT.length - 1) {
            setPreview({ state: "open" })
            setMessages((list) => [
              ...list,
              withText("**BLOG-5** changed a screen, so it waits for your eye. Before and after, 400 and 1440 px:", ["preview", "BLOG-5"]),
            ])
          }
        })
      )
      return
    }
    if (text === SUGGESTIONS[1]) {
      reply([
        withText(
          "The chat watcher lost its session at 22:30, so T-361's question sat unanswered and four tasks waited on it. Melzi's redelivery picked it up at 03:40. **The event door (T-413) closes this.**",
          ["evidence", "evidence"]
        ),
      ])
      return
    }
    if (text === SUGGESTIONS[2]) {
      reply([
        withText(
          "Codex is fine. **Claude is tight**: at this pace it reaches 94% by Monday 09:00. Decidi: reviews go to Codex until the reset.",
          ["quota", "quota"]
        ),
      ])
      return
    }
    reply([say("assistant", "Noted. I'll turn it into a task and only bring it back if it needs a decision.")])
  }

  function decideIncident(revert: boolean) {
    setIncident(revert ? "reverted" : "kept")
    if (revert)
      reply([say("assistant", "Reverted **3f2a1c**; the RSS check is green again. BLOG-4 is back in build with the failing case as a test.")], 2400)
  }

  function decideDiff(approve: boolean) {
    setDiff(approve ? "approved" : "returned")
    if (approve) reply([say("assistant", "**T-583** is in the integration queue; full gates run there.")], 900)
  }

  function decidePreview(accepted: boolean, note?: string) {
    setPreview({ state: accepted ? "accepted" : "declined", note })
    if (accepted) {
      later(2200, () => setTask((t) => t && { ...t, stage: 5, state: "done", now: "On main · deploys with the next wave", path: [...t.path, { day: "Today", time: "09:31", text: "Your visual ok; promoted to main", took: "4 min" }] }))
      reply([say("assistant", "Promoting **BLOG-5**. It ships with the next wave.")], 900)
    } else {
      setTask((t) => t && { ...t, stage: 1, state: "working", now: "Adjusting: " + (note ?? "") })
      reply([say("assistant", "Back to build with your note. You'll see a new preview here.")], 900)
    }
  }

  // Everything waiting on the owner, pinned until answered.
  const pending: Pending[] = [
    ...(incident === "open" ? [{ id: INCIDENT.id, project: INCIDENT.project, kind: "Incident", subject: "blog", ask: "Revert 3f2a1c?" }] : []),
    ...(preview.state === "open" ? [{ id: "BLOG-5", project: "blog" as Project, kind: "Preview", subject: "BLOG-5", ask: "Visual ok for the Open Source page" }] : []),
    ...MORNING_DECISIONS.filter((d) => !answers[d.id]).map((d) => ({ id: d.id, project: d.project, kind: "Decision", subject: d.project, ask: d.question })),
    ...(diff === "open" ? [{ id: RISKY_DIFF.id, project: RISKY_DIFF.project, kind: "High risk", subject: RISKY_DIFF.key, ask: RISKY_DIFF.title }] : []),
  ].filter((p) => project === "all" || p.project === project)

  const visible = (p: Project) => project === "all" || project === p

  // New items enter at the front: bring the strip back to its start.
  const strip = React.useRef<HTMLDivElement>(null)
  const pendingIds = pending.map((p) => p.id).join()
  React.useEffect(() => {
    strip.current?.scrollTo({ left: 0, behavior: "smooth" })
  }, [pendingIds])

  function open(id: string) {
    document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    setFlash(id)
    later(1400, () => setFlash(null))
  }

  const wrap = (id: string, state: string, node: React.ReactNode) => (
    <div
      id={`card-${id}`}
      className={cn("scroll-my-28 rounded-2xl border border-transparent transition-colors duration-700", flash === id && "border-attention/50")}
    >
      <PartTransition state={state}>{node}</PartTransition>
    </div>
  )

  const tools: ToolRegistry = {
    digest: { render: () => <DigestCard needsYou={pending.length} /> },
    decision: {
      render: (part: { toolCallId: string }) => {
        const d = MORNING_DECISIONS.find((x) => x.id === part.toolCallId)!
        if (!visible(d.project)) return null
        return wrap(d.id, answers[d.id] ?? "open", <DecisionCard decision={d} answer={answers[d.id]} onAnswer={(o) => setAnswers((a) => ({ ...a, [d.id]: o }))} />)
      },
    },
    diff: { render: () => (visible(RISKY_DIFF.project) ? wrap(RISKY_DIFF.id, diff, <DiffCard diff={RISKY_DIFF} state={diff} onDecide={decideDiff} />) : null) },
    incident: {
      render: () =>
        visible(INCIDENT.project) && incident !== "none"
          ? wrap(INCIDENT.id, incident, <IncidentCard incident={INCIDENT} state={incident} onDecide={decideIncident} />)
          : null,
    },
    similar: { render: () => (visible("blog") ? <SimilarTasks /> : null) },
    task: { render: () => (task && visible(task.project) ? <TaskCard task={task} /> : null) },
    preview: {
      render: () => {
        if (!visible("blog") || preview.state === "none") return null
        return wrap(
          "BLOG-5",
          preview.state,
          preview.state === "open" ? (
            <PreviewApproval
              title="BLOG-5 · Open Source page"
              description="Repos as cards, most stars first; same card list as the tag pages."
              before={<BlogPreview after={false} />}
              after={<BlogPreview after />}
              href="#"
              note="Nothing reaches main without your ok."
              labels={{ status: "Your eye", accept: "Promote", requestChanges: "Adjust", send: "Send note", placeholder: "What should change?" }}
              onAccept={() => decidePreview(true)}
              onRequestChanges={(note) => decidePreview(false, note)}
            />
          ) : (
            <PreviewApprovalResolved
              label="BLOG-5"
              accepted={preview.state === "accepted"}
              summary={preview.state === "accepted" ? "Visual ok · promoted" : "Adjust requested"}
              note={preview.note}
            />
          )
        )
      },
    },
    quota: { render: () => <QuotaCard /> },
    evidence: { render: () => <EvidenceCard /> },
  }

  const suggestions = SUGGESTIONS.filter((s) => !used.includes(s))

  return (
    <div data-slot="davinci" className="flex h-svh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border/70 px-4 sm:px-6">
        <AgentOrb phase={typing ? "composing" : pending.length ? "waiting" : "idle"} active={typing || pending.length > 0} />
        <span className="text-[15px]">davinci</span>
        <span className="eyebrow truncate text-muted-foreground max-sm:hidden">
          {typing ? "Writing…" : pending.length ? `${pending.length} waiting on you` : "Factory running on its own"}
        </span>
        <Select value={project} onValueChange={(v) => v && setProject(v as typeof project)}>
          <SelectTrigger aria-label="Project" className="ml-auto">
            <FolderIcon className="text-muted-foreground" />
            <SelectValue>{(v: string) => (v === "all" ? "All projects" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end" alignItemWithTrigger={false}>
            <SelectItem value="all">All projects</SelectItem>
            <SelectItem value="bottega">bottega</SelectItem>
            <SelectItem value="blog">blog</SelectItem>
          </SelectContent>
        </Select>
      </header>

      {/* Needs you: pinned until answered; the only orange on screen. */}
      <div className="shrink-0 border-b border-border/70 bg-background">
        <div className="mx-auto flex w-full max-w-[46rem] items-center gap-3 px-4 py-2.5 sm:px-6">
          <span className="eyebrow shrink-0 whitespace-nowrap text-muted-foreground">
            Needs you <span className="text-foreground tabular-nums">{pending.length}</span>
          </span>
          {pending.length === 0 ? (
            <span className="text-sm text-muted-foreground">Nothing waiting. The factory runs on its own.</span>
          ) : (
            <div
              ref={strip}
              className="-my-1 flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 [mask-image:linear-gradient(to_right,black_88%,transparent)] [scrollbar-width:none]"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {pending.map((p) => (
                  <DecisionChip key={p.id} kind={p.kind} subject={p.subject} onClick={() => open(p.id)} className="w-56 shrink-0 p-2.5">
                    {p.ask}
                  </DecisionChip>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <ChatThread busy={typing} className="mx-auto w-full max-w-[46rem] gap-6 px-4 py-6 sm:px-6">
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

      <div className="mx-auto w-full max-w-[46rem] shrink-0 px-4 pb-4 sm:px-6">
        {suggestions.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto [scrollbar-width:none]">
            {suggestions.map((s) => (
              <Button key={s} variant="outline" size="sm" className="shrink-0 rounded-full font-normal" onClick={() => ask(s)}>
                {s}
              </Button>
            ))}
          </div>
        )}
        <div className="rounded-2xl border border-border bg-card shadow-xs">
          <Composer
            onSubmit={() => {
              if (!input.trim()) return
              ask(input.trim())
              setInput("")
            }}
          >
            <ComposerInput
              aria-label="Message davinci"
              placeholder="Ask, request or decide…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-12"
            />
            <ComposerToolbar>
              <ComposerMic className="ml-auto" />
              <ComposerSubmit busy={false} disabled={!input.trim()} />
            </ComposerToolbar>
          </Composer>
        </div>
      </div>
    </div>
  )
}

/* A miniature of the blog page: phone and desktop side by side. */
export function BlogPreview({ after }: { after: boolean }) {
  const cards = after ? [5, 4, 3, 2] : []
  return (
    <div className="flex h-full gap-1.5 p-1.5">
      <div className="flex w-[30%] flex-col gap-1 rounded-sm border border-border/70 bg-card p-1">
        <div className="h-1 w-2/3 rounded-full bg-foreground/25" />
        {after ? (
          cards.slice(0, 3).map((s) => (
            <div key={s} className="flex items-center gap-0.5 rounded-[2px] bg-muted p-0.5">
              <div className="h-1 flex-1 rounded-full bg-foreground/15" />
              <div className="h-1 w-1.5 rounded-full bg-[var(--chart-1)]" />
            </div>
          ))
        ) : (
          [0, 1, 2].map((i) => <div key={i} className="h-3 rounded-[2px] bg-muted" />)
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 rounded-sm border border-border/70 bg-card p-1">
        <div className="flex gap-1">
          <div className="h-1 w-1/4 rounded-full bg-foreground/25" />
          {after && <div className="ml-auto h-1 w-1/6 rounded-full bg-foreground/50" />}
        </div>
        <div className="grid flex-1 grid-cols-2 gap-1">
          {(after ? cards : [0, 1, 2, 3]).map((s, i) => (
            <div key={i} className="flex flex-col justify-between rounded-[2px] bg-muted p-0.5">
              <div className="h-1 w-3/4 rounded-full bg-foreground/15" />
              {after && <div className="h-1 rounded-full bg-[var(--chart-1)]" style={{ width: `${s * 15}%` }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
