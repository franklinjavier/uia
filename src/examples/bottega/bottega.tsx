import * as React from "react"
import { AnimatePresence } from "motion/react"
import { FolderIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sparkline } from "@/components/ds/sparkline"
import { StageTrack, stageTrackGrid } from "@/components/ds/stage-track"
import { StatusBadge } from "@/components/ds/status"
import {
  Widget,
  WidgetHeader,
  WidgetList,
  WidgetListHeader,
  WidgetListRow,
  WidgetPanel,
  WidgetTitle,
} from "@/components/ds/widget"
import { DecisionChip } from "@/components/parts/decision-chip"
import { KIND_LABEL, STAGES, type Health } from "@/examples/bottega/data"
import { Conversation } from "@/examples/bottega/conversation"
import { useBottega } from "@/examples/bottega/use-bottega"

// Bottega: an autonomous software workshop, as a page. What needs the person
// comes first; projects show where they are in the flow (conversation →
// plan → execution → proof → publish → observe), not their tasks;
// production is shown as outcomes; the agent's own work is a quiet log. The
// one conversation sits on the right, and decisions are answered there.

const ALL = "all"
const PROJECT_COLS = "grid-cols-[minmax(8rem,1fr)_minmax(15rem,26rem)_minmax(6rem,11rem)]"

const HEALTH: Record<Health, { tone: "success" | "warning" | "info"; label: string }> = {
  ok: { tone: "success", label: "Saudável" },
  degraded: { tone: "warning", label: "Instável" },
  recovering: { tone: "info", label: "Recuperando" },
}

export function Bottega() {
  const state = useBottega()
  const { projects, decisions, activity } = state
  const [filter, setFilter] = React.useState(ALL)
  const [hovered, setHovered] = React.useState<string | null>(null)
  const [flash, setFlash] = React.useState<string | null>(null)

  const inScope = (pid: string) => filter === ALL || filter === pid
  const open = decisions.filter((d) => d.state === "open" && inScope(d.project))
  const live = projects.filter((p) => p.live && inScope(p.id))
  const name = (pid: string) => projects.find((p) => p.id === pid)?.name ?? pid

  function openDecision(id: string) {
    document.getElementById(`decision-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    setFlash(id)
    window.setTimeout(() => setFlash(null), 1400)
  }

  return (
    <div data-slot="bottega" className="grid h-svh grid-cols-1 bg-background lg:grid-cols-[minmax(0,1fr)_26rem]">
      <main className="flex min-h-0 flex-col overflow-y-auto">
        {/* pr-16 leaves room for the playground's theme toggle */}
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background/90 px-6 backdrop-blur lg:pr-6">
          <span className="text-[15px]">Oficina</span>
          <span className="eyebrow text-muted-foreground">
            {projects.length} projetos · {projects.filter((p) => p.live).length} no ar
          </span>
          <Select value={filter} onValueChange={(v) => v && setFilter(v)}>
            <SelectTrigger aria-label="Projeto" className="ml-auto">
              <FolderIcon className="text-muted-foreground" />
              <SelectValue>{(v: string) => (v === ALL ? "Todos os projetos" : name(v))}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false}>
              <SelectItem value={ALL}>Todos os projetos</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>

        <div className="mx-auto flex w-full max-w-[60rem] flex-col gap-8 px-6 py-8">
          {/* What needs the person: the only orange on the page. */}
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2 px-1">
              <h2 className="text-base">Precisa de você</h2>
              <span className="eyebrow text-muted-foreground">{open.length || "nada"}</span>
            </div>
            {open.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {open.map((d) => (
                    <DecisionChip key={d.id} kind={KIND_LABEL[d.kind]} subject={name(d.project)} onClick={() => openDecision(d.id)}>
                      {d.ask}
                    </DecisionChip>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <p className="px-1 text-sm text-muted-foreground">Nada esperando você. A Bottega segue sozinha.</p>
            )}
          </section>

          <Widget>
            <WidgetHeader>
              <WidgetTitle>Projetos</WidgetTitle>
            </WidgetHeader>
            <WidgetPanel className="flex flex-col pt-3">
              <WidgetList onMouseLeave={() => setHovered(null)}>
                <WidgetListHeader className={PROJECT_COLS}>
                  <span className="eyebrow text-muted-foreground">Projeto</span>
                  <span className="grid" style={stageTrackGrid(STAGES.length)}>
                    {STAGES.map((s) => (
                      <span key={s} className="truncate text-xs text-muted-foreground">
                        {s}
                      </span>
                    ))}
                  </span>
                  <span className="eyebrow text-right text-muted-foreground">Agora</span>
                </WidgetListHeader>
                {projects.map((p) => (
                  <WidgetListRow
                    key={p.id}
                    className={PROJECT_COLS}
                    selected={filter === p.id}
                    dimmed={(hovered !== null && hovered !== p.id) || !inScope(p.id)}
                    onMouseEnter={() => setHovered(p.id)}
                    onClick={() => setFilter((f) => (f === p.id ? ALL : p.id))}
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate">{p.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{p.goal}</span>
                    </span>
                    <StageTrack
                      stages={p.stages.map((status, i) => ({ label: STAGES[i], status }))}
                      statusLabels={{ done: "concluída", active: "em andamento", waiting: "esperando você", failed: "falhou", todo: "a fazer" }}
                    />
                    <span
                      className={cn(
                        "truncate text-right text-xs",
                        p.stages.includes("waiting") || p.stages.includes("failed") ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {p.now}
                    </span>
                  </WidgetListRow>
                ))}
              </WidgetList>
            </WidgetPanel>
          </Widget>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <Widget>
              <WidgetHeader>
                <WidgetTitle>Produção</WidgetTitle>
              </WidgetHeader>
              <WidgetPanel className="flex flex-col pt-3">
                <WidgetList>
                  <WidgetListHeader className="grid-cols-[minmax(7rem,1fr)_5rem_4rem_6.5rem]">
                    <span className="eyebrow text-muted-foreground">No ar</span>
                    <span className="eyebrow whitespace-nowrap text-muted-foreground">Erros</span>
                    <span className="eyebrow text-right text-muted-foreground">30 dias</span>
                    <span />
                  </WidgetListHeader>
                  {live.map((p) => (
                    <WidgetListRow key={p.id} className="grid-cols-[minmax(7rem,1fr)_5rem_4rem_6.5rem]">
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate">{p.name}</span>
                        <span className="eyebrow truncate text-muted-foreground">
                          {p.live!.version} · {p.live!.deployed}
                        </span>
                      </span>
                      <Sparkline
                        values={p.live!.errors}
                        color={p.live!.health === "ok" ? "var(--chart-1)" : "var(--warning)"}
                        className="h-6 w-20"
                      />
                      <span className="text-right text-muted-foreground tabular-nums">
                        {(p.live!.uptime * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                      </span>
                      <span className="flex justify-end">
                        <StatusBadge tone={HEALTH[p.live!.health].tone}>{HEALTH[p.live!.health].label}</StatusBadge>
                      </span>
                    </WidgetListRow>
                  ))}
                </WidgetList>
              </WidgetPanel>
            </Widget>

            <Widget>
              <WidgetHeader>
                <WidgetTitle>O que a Bottega fez</WidgetTitle>
              </WidgetHeader>
              <WidgetPanel className="flex flex-col pt-3">
                <WidgetList>
                  <AnimatePresence initial={false}>
                    {activity
                      .filter((a) => inScope(a.project))
                      .slice(0, 6)
                      .map((a) => (
                        <WidgetListRow key={a.id} className="grid-cols-[3rem_minmax(0,1fr)] items-baseline">
                          <span className="eyebrow text-muted-foreground tabular-nums">{a.when}</span>
                          <span className="min-w-0 text-pretty">
                            <span className="text-muted-foreground">{name(a.project)} · </span>
                            {a.text}
                          </span>
                        </WidgetListRow>
                      ))}
                  </AnimatePresence>
                </WidgetList>
              </WidgetPanel>
            </Widget>
          </div>
        </div>
      </main>

      <div className="hidden min-h-0 border-l border-border/70 lg:flex lg:flex-col">
        <Conversation state={state} flash={flash} />
      </div>
    </div>
  )
}
