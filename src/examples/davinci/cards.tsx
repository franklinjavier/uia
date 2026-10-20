import { motion } from "motion/react"
import {
  BanIcon,
  CheckIcon,
  ChevronRightIcon,
  FileCode2Icon,
  RotateCcwIcon,
  ShieldAlertIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { enter } from "@/lib/motion"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { MeterBar } from "@/components/ds/meter-bar"
import { ModelIcon } from "@/components/ds/model-icons"
import { Sparkline } from "@/components/ds/sparkline"
import { StageTrack } from "@/components/ds/stage-track"
import { StatusBadge } from "@/components/ds/status"
import {
  ActionCard,
  ActionCardActions,
  ActionCardDescription,
  ActionCardFields,
  ActionCardHeader,
  ActionCardPanel,
  ActionCardStatus,
  ActionCardTitle,
  ResolvedRow,
} from "@/components/parts/action-card"
import { Confirmation } from "@/components/parts/confirmation"
import {
  FLOW,
  NIGHT,
  QUOTA,
  ROUTINE,
  type Decision,
  type Diff,
  type Incident,
  type Task,
} from "@/examples/davinci/data"

// The cards davinci puts in the conversation. Each one answers one kind of
// "what's going on" or "what do you want", says it in one line first, and
// keeps the detail one tap away.

/* ------------------------------ digest ------------------------------ */

export function DigestCard({ needsYou }: { needsYou: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={enter}
      className="not-typeset flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-xs"
    >
      <div className="grid grid-cols-3 gap-3">
        <Figure label="Shipped" value="7" meta="to main" />
        <Figure label="Stuck" value="1" meta="blog check" />
        <Figure label="Needs you" value={String(needsYou)} meta={needsYou ? "pinned above" : "all clear"} attention={needsYou > 0} />
      </div>
      <ResolvedRow
        icon={<CheckIcon />}
        label={`${ROUTINE.length} routine`}
        summary="auto-approvals and promotions"
        className="shadow-none"
      >
        <ul className="flex flex-col gap-1.5">
          {ROUTINE.map((r) => (
            <li key={r} className="truncate text-muted-foreground">
              <span className="eyebrow mr-2 text-foreground">{r.split(" ")[0]}</span>
              {r.split(" ").slice(1).join(" ")}
            </li>
          ))}
        </ul>
      </ResolvedRow>
    </motion.div>
  )
}

function Figure({ label, value, meta, attention }: { label: string; value: string; meta: string; attention?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="eyebrow text-muted-foreground">{label}</span>
      <span className={cn("text-2xl tracking-[-0.02em] tabular-nums", attention && "text-attention")}>{value}</span>
      <span className="eyebrow truncate text-faint-foreground">{meta}</span>
    </div>
  )
}

/* ----------------------------- decisions ---------------------------- */

/** A question with numbered options; davinci's pick is marked. One tap decides. */
export function DecisionCard({
  decision: d,
  answer,
  onAnswer,
}: {
  decision: Decision
  answer?: string
  onAnswer: (optionId: string) => void
}) {
  if (answer) {
    const i = d.options.findIndex((o) => o.id === answer)
    const o = d.options[i]
    return (
      <ResolvedRow
        icon={<CheckIcon />}
        label="Decided"
        summary={`${d.question.replace(/\?$/, "")} · ${i + 1} ${o.label}${o.id === d.pick ? " (davinci's pick)" : ""}`}
      />
    )
  }
  return (
    <ActionCard>
      <ActionCardHeader>
        <ActionCardTitle>{d.question}</ActionCardTitle>
        <ActionCardStatus tone="approval">Needs you</ActionCardStatus>
      </ActionCardHeader>
      <ActionCardDescription>{d.context.join(" ")}</ActionCardDescription>
      <div className="flex flex-col gap-1.5">
        {d.options.map((o, i) => {
          const pick = o.id === d.pick
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onAnswer(o.id)}
              className={cn(
                "group/opt flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/30",
                pick ? "border-foreground/40" : "border-border/80"
              )}
            >
              <span className="eyebrow mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2">
                  {o.label}
                  {pick && <span className="eyebrow rounded-full bg-foreground/5 px-1.5 text-muted-foreground">davinci's pick</span>}
                </span>
                <span className="text-xs text-muted-foreground">{o.hint}</span>
              </span>
            </button>
          )
        })}
      </div>
    </ActionCard>
  )
}

/* ------------------------------- task ------------------------------- */

/** A live task: where it is in the flow, what's happening, the path on tap. */
export function TaskCard({ task: t }: { task: Task }) {
  const days = [...new Set(t.path.map((s) => s.day))]
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={enter}
      className="not-typeset flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-xs"
    >
      <div className="flex items-start gap-3">
        <ModelIcon family={t.family} className="mt-0.5 size-4 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="eyebrow text-muted-foreground">
            {t.key} · {t.project}
          </span>
          <span className="text-[15px] leading-6 tracking-[-0.01em]">{t.title}</span>
        </div>
        {t.state === "done" ? (
          <StatusBadge tone="success">On main</StatusBadge>
        ) : t.state === "waiting" ? (
          <StatusBadge tone="attention">Needs you</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">{FLOW[t.stage]}</StatusBadge>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <StageTrack
          stages={FLOW.map((label, i) => ({
            label,
            status:
              t.state === "done" || i < t.stage ? "done" : i === t.stage ? (t.state === "waiting" ? "waiting" : "active") : "todo",
          }))}
        />
        <div className="grid text-[11px] text-faint-foreground" style={{ gridTemplateColumns: `repeat(${FLOW.length}, minmax(0, 1fr))` }}>
          {FLOW.map((s) => (
            <span key={s} className="truncate">
              {s}
            </span>
          ))}
        </div>
      </div>

      <Collapsible>
        <CollapsibleTrigger className="group/path flex w-full items-center gap-1.5 text-left text-sm outline-none">
          <span className={cn(t.state === "working" && "shimmer")}>{t.now}</span>
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            Path
            <ChevronRightIcon className="size-3.5 transition-transform group-aria-expanded/path:rotate-90" />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
          <div className="mt-3 flex flex-col gap-3 border-t border-border/70 pt-3">
            {days.map((day) => (
              <div key={day} className="flex flex-col gap-1.5">
                <span className="eyebrow text-faint-foreground">{day}</span>
                {t.path
                  .filter((s) => s.day === day)
                  .map((s) => (
                    <div key={s.time + s.text} className="grid grid-cols-[3rem_1fr_auto] items-baseline gap-2 text-sm">
                      <span className="eyebrow text-muted-foreground tabular-nums">{s.time}</span>
                      <span className="min-w-0">{s.text}</span>
                      <span className="eyebrow text-faint-foreground tabular-nums">{s.took}</span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  )
}

/* ----------------------------- incident ----------------------------- */

export function IncidentCard({
  incident: i,
  state,
  onDecide,
}: {
  incident: Incident
  state: "open" | "reverted" | "kept"
  onDecide: (revert: boolean) => void
}) {
  if (state !== "open")
    return (
      <ResolvedRow
        icon={state === "reverted" ? <RotateCcwIcon /> : <BanIcon />}
        label="Blog"
        summary={state === "reverted" ? `Reverted ${i.culprit} · check green again` : "Kept v12 · investigating"}
        muted={state === "kept"}
      />
    )
  return (
    <Confirmation
      title={i.title}
      description={i.bisect}
      status="Incident"
      allowLabel={`Revert ${i.culprit}`}
      denyLabel="Keep and investigate"
      note="Revert goes through the full gates; nothing else on next moves."
      onAllow={() => onDecide(true)}
      onDeny={() => onDecide(false)}
    >
      <ActionCardPanel>
        <ActionCardFields
          size="sm"
          fields={[
            { label: "Check", value: "GET /rss.xml → 500 since 08:52" },
            { label: "Users", value: "Feed readers only; pages are fine" },
            { label: "Fix", value: "Revert, then BLOG-4 goes back to build" },
          ]}
        />
      </ActionCardPanel>
    </Confirmation>
  )
}

/* ---------------------------- risky diff ---------------------------- */

export function DiffCard({
  diff: d,
  state,
  onDecide,
}: {
  diff: Diff
  state: "open" | "approved" | "returned"
  onDecide: (approve: boolean) => void
}) {
  if (state !== "open")
    return (
      <ResolvedRow
        icon={<ShieldAlertIcon />}
        label={d.key}
        summary={state === "approved" ? "Approved · queued for integration" : "Returned to build with your note"}
        muted={state === "returned"}
      />
    )
  return (
    <ActionCard>
      <ActionCardHeader>
        <ActionCardTitle>
          {d.key} · {d.title}
        </ActionCardTitle>
        <ActionCardStatus tone="approval">High risk</ActionCardStatus>
      </ActionCardHeader>
      <ul className="-mt-1 flex flex-col gap-1 text-muted-foreground">
        {d.summary.map((s) => (
          <li key={s} className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-current" />
            {s}
          </li>
        ))}
      </ul>
      <ActionCardPanel className="divide-y divide-border/70">
        {d.risky.map((f) => (
          <div key={f.file} className="flex flex-col">
            <span className="flex items-center gap-1.5 px-3 pt-2.5 pb-1.5 font-mono text-xs text-muted-foreground">
              <FileCode2Icon className="size-3.5" />
              {f.file}
            </span>
            <pre className="overflow-x-auto px-3 pb-2.5 font-mono text-xs leading-5">
              {f.lines.map((l) => (
                <span
                  key={l}
                  className={cn(
                    "block",
                    l.startsWith("+") && "bg-success/5 text-foreground",
                    l.startsWith("-") && "bg-destructive/5 text-muted-foreground line-through decoration-muted-foreground/40"
                  )}
                >
                  {l}
                </span>
              ))}
            </pre>
          </div>
        ))}
      </ActionCardPanel>
      <ActionCardActions>
        <Button size="sm" onClick={() => onDecide(true)}>
          Approve
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onDecide(false)}>
          Return with note
        </Button>
      </ActionCardActions>
    </ActionCard>
  )
}

/* ------------------------------ quota ------------------------------- */

export function QuotaCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={enter}
      className="not-typeset flex flex-col gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-xs"
    >
      {QUOTA.map((q) => (
        <div key={q.name} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <ModelIcon family={q.family} className="size-4 text-muted-foreground" />
            <span>{q.name}</span>
            <span className="eyebrow text-faint-foreground">{q.window}</span>
            <StatusBadge tone={q.verdict === "On track" ? "success" : "warning"} className="ml-auto">
              {q.verdict}
            </StatusBadge>
          </div>
          <MeterBar
            max={100}
            segments={[
              { id: "used", value: q.used, color: "var(--chart-1)" },
              { id: "projected", value: q.projected - q.used, color: "color-mix(in oklch, var(--chart-1) 30%, transparent)" },
            ]}
            markers={[{ value: 100, label: "Limit" }]}
          />
          <span className="-mt-3 text-xs text-muted-foreground">
            <span className="tabular-nums">{q.used}%</span> used, <span className="tabular-nums">{q.projected}%</span> at reset ({q.resets})
          </span>
        </div>
      ))}
    </motion.div>
  )
}

/* ----------------------------- evidence ----------------------------- */

/** The why behind an answer: a small chart and the timeline, on tap. */
export function EvidenceCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={enter}
      className="not-typeset flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-xs"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="eyebrow text-muted-foreground">Tasks running · 19:00 → 09:00</span>
          <span className="text-sm">
            Idle <span className="tabular-nums">5 h 10 min</span>, from 22:30 to 03:40
          </span>
        </div>
        <Sparkline values={NIGHT} className="h-10 w-32" />
      </div>
      <Collapsible>
        <CollapsibleTrigger className="group/ev flex items-center gap-1 text-xs text-muted-foreground outline-none hover:text-foreground">
          <ChevronRightIcon className="size-3.5 transition-transform group-aria-expanded/ev:rotate-90" />
          Timeline
        </CollapsibleTrigger>
        <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
          <div className="mt-2 flex flex-col gap-1.5 text-sm">
            {[
              ["22:30", "Chat watcher lost its session; nobody picked up T-361's question"],
              ["22:31", "Queue kept 4 tasks waiting on that answer (file claims)"],
              ["03:40", "Melzi's 5-min redelivery woke the operator; answered from the spec"],
              ["03:42", "Dispatch resumed; 3 lanes busy again"],
            ].map(([t, s]) => (
              <div key={t} className="grid grid-cols-[3rem_1fr] items-baseline gap-2">
                <span className="eyebrow text-muted-foreground tabular-nums">{t}</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  )
}

/* ----------------------------- similar ------------------------------ */

export function SimilarTasks() {
  return (
    <div className="not-typeset flex flex-col gap-1 rounded-2xl border border-border/80 bg-card px-4 py-3 text-sm shadow-xs">
      <span className="eyebrow mb-1 text-muted-foreground">Similar, already done</span>
      {[
        ["BLOG-3", "Tag pages", "reuses the card list"],
        ["T-201", "GitHub stars fetch (bottega site)", "cached daily"],
      ].map(([k, t, m]) => (
        <div key={k} className="flex items-baseline gap-2">
          <span className="eyebrow w-14 shrink-0 text-muted-foreground">{k}</span>
          <span className="truncate">{t}</span>
          <span className="ml-auto shrink-0 text-xs text-faint-foreground">{m}</span>
        </div>
      ))}
    </div>
  )
}
