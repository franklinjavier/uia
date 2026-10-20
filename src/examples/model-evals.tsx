import * as React from "react"
import { motion } from "motion/react"
import { CheckIcon, GitCompareIcon, Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { springSoft } from "@/lib/motion"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MeterBar } from "@/components/ds/meter-bar"
import { NumberTicker } from "@/components/ds/number-ticker"
import { Stat, StatLabel, StatMeta, StatUnit, StatValue } from "@/components/ds/stat"
import { StatusBadge } from "@/components/ds/status"
import {
  Widget,
  WidgetActions,
  WidgetFooter,
  WidgetHeader,
  WidgetList,
  WidgetListHeader,
  WidgetListRow,
  WidgetMeta,
  WidgetPanel,
  WidgetSectionTitle,
  WidgetTitle,
} from "@/components/ds/widget"

// Qualidade do modelo: taxa de acerto da versão atual contra uma versão de
// referência, por suíte, e as falhas mais recentes. Clicar numa suíte filtra
// as falhas; "Rodar evals" roda de novo e atualiza tudo. Dados simulados.

const TARGET = 0.9
const CURRENT = "atlas-v13"

type Suite = { id: string; name: string; cases: number; pass: number }
type Failure = { id: string; suite: string; title: string; isNew: boolean }

const BASELINES: Record<string, { label: string; pass: Record<string, number> }> = {
  v12: { label: "atlas-v12", pass: { reasoning: 0.88, code: 0.861, safety: 0.969, extraction: 0.842, math: 0.73 } },
  v11: { label: "atlas-v11", pass: { reasoning: 0.851, code: 0.83, safety: 0.958, extraction: 0.81, math: 0.702 } },
}

const INITIAL: Suite[] = [
  { id: "reasoning", name: "Raciocínio", cases: 1240, pass: 0.912 },
  { id: "code", name: "Código", cases: 980, pass: 0.847 },
  { id: "safety", name: "Segurança", cases: 620, pass: 0.974 },
  { id: "extraction", name: "Extração", cases: 1150, pass: 0.889 },
  { id: "math", name: "Matemática", cases: 822, pass: 0.765 },
]

const FAILURES: Failure[] = [
  { id: "cod-0412", suite: "code", title: "Refatoração remove o caso de borda do teste", isNew: true },
  { id: "cod-0377", suite: "code", title: "Import circular ao dividir o módulo", isNew: true },
  { id: "mat-0918", suite: "math", title: "Erro de arredondamento em juros compostos", isNew: false },
  { id: "ext-1203", suite: "extraction", title: "Data em formato americano lida como dd/mm", isNew: false },
  { id: "rac-0088", suite: "reasoning", title: "Conclui antes de checar a premissa 3", isNew: false },
  { id: "seg-0041", suite: "safety", title: "Recusa um pedido legítimo de dosagem", isNew: false },
  { id: "cod-0251", suite: "code", title: "Timeout no teste de concorrência", isNew: false },
]

const pct = (v: number, digits = 1) =>
  (v * 100).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })
const int = (v: number) => v.toLocaleString("pt-BR")

const COLS = "grid-cols-[1fr_96px_56px_64px]"

export function ModelEvals() {
  const [baselineKey, setBaselineKey] = React.useState("v12")
  const [suites, setSuites] = React.useState(INITIAL)
  const [hovered, setHovered] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<string | null>(null)
  const [running, setRunning] = React.useState(false)
  const [justRan, setJustRan] = React.useState(false)
  const [ranAt, setRanAt] = React.useState("há 18 min")

  const baseline = BASELINES[baselineKey]
  const total = suites.reduce((s, x) => s + x.cases, 0)
  const pass = suites.reduce((s, x) => s + x.pass * x.cases, 0) / total
  const basePass = suites.reduce((s, x) => s + baseline.pass[x.id] * x.cases, 0) / total
  const delta = pass - basePass
  const focus = hovered ?? selected
  const failures = FAILURES.filter((f) => !selected || f.suite === selected)

  function run() {
    setRunning(true)
    setSelected(null)
    window.setTimeout(() => {
      setSuites((list) =>
        list.map((s) => ({ ...s, pass: Math.min(0.995, Math.max(0.6, s.pass + (Math.random() - 0.4) * 0.02)) }))
      )
      setRanAt("agora")
      setRunning(false)
      setJustRan(true)
      window.setTimeout(() => setJustRan(false), 1800)
    }, 2200)
  }

  return (
    <Widget className="max-w-[560px]">
      <WidgetHeader>
        <WidgetTitle>Qualidade do modelo</WidgetTitle>
        <WidgetActions>
          <Select value={baselineKey} onValueChange={(v) => v && setBaselineKey(v)}>
            <SelectTrigger aria-label="Comparar com">
              <GitCompareIcon className="text-muted-foreground" />
              <SelectValue>{(v: string) => `vs ${BASELINES[v].label}`}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false}>
              {Object.entries(BASELINES).map(([key, b]) => (
                <SelectItem key={key} value={key}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </WidgetActions>
      </WidgetHeader>

      <WidgetPanel className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <Stat>
            <StatLabel>Taxa de acerto · {CURRENT}</StatLabel>
            <StatValue>
              <NumberTicker value={pass * 100} format={(v) => pct(v / 100)} />
              <StatUnit>%</StatUnit>
              <StatusBadge tone={delta >= 0 ? "success" : "destructive"} dot={false} className="self-center">
                {delta >= 0 ? "▲" : "▼"} {pct(Math.abs(delta))} pp
              </StatusBadge>
            </StatValue>
            <StatMeta>
              {baseline.label} tinha {pct(basePass)}%
            </StatMeta>
          </Stat>
          <Stat className="items-end text-right">
            <StatLabel>Casos</StatLabel>
            <StatValue size="sm">{int(total)}</StatValue>
            <StatMeta>{running ? "Rodando…" : `Rodou ${ranAt}`}</StatMeta>
          </Stat>
        </div>

        <MeterBar
          min={0.6}
          max={1}
          segments={[{ id: "pass", value: pass, color: "var(--chart-1)" }]}
          markers={[
            { value: basePass, label: baseline.label.replace("atlas-", "") },
            { value: TARGET, label: `Meta ${pct(TARGET, 0)}%` },
          ]}
        />
      </WidgetPanel>

      <WidgetPanel className="flex flex-col pt-3">
        <WidgetList onMouseLeave={() => setHovered(null)}>
          <WidgetListHeader className={COLS}>
            <WidgetSectionTitle>Por suíte</WidgetSectionTitle>
            <span className="eyebrow text-muted-foreground">vs {baseline.label.replace("atlas-", "")}</span>
            <span className="eyebrow text-right text-muted-foreground">Acerto</span>
            <span className="eyebrow text-right text-muted-foreground">Δ pp</span>
          </WidgetListHeader>
          {suites.map((s) => {
            const base = baseline.pass[s.id]
            const d = s.pass - base
            return (
              <WidgetListRow
                key={s.id}
                className={COLS}
                selected={selected === s.id}
                dimmed={focus !== null && focus !== s.id}
                onMouseEnter={() => setHovered(s.id)}
                onClick={() => setSelected((v) => (v === s.id ? null : s.id))}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span>{s.name}</span>
                  <span className="eyebrow text-muted-foreground">{int(s.cases)} casos</span>
                </span>
                <Comparison value={s.pass} baseline={base} />
                <span className="text-right tabular-nums">{pct(s.pass)}%</span>
                <span className={cn("text-right tabular-nums", d < 0 ? "text-destructive" : "text-muted-foreground")}>
                  {d >= 0 ? "+" : "−"}
                  {pct(Math.abs(d))}
                </span>
              </WidgetListRow>
            )
          })}
        </WidgetList>
      </WidgetPanel>

      <WidgetPanel className="flex flex-col pt-3">
        <WidgetList>
          <WidgetListHeader className="grid-cols-[1fr_auto]">
            <WidgetSectionTitle>
              Falhas recentes
              {selected && (
                <span className="text-muted-foreground"> · {suites.find((s) => s.id === selected)?.name}</span>
              )}
            </WidgetSectionTitle>
            <span className="eyebrow text-muted-foreground">
              {failures.some((f) => f.isNew) && `${failures.filter((f) => f.isNew).length} novas`}
            </span>
          </WidgetListHeader>
          {failures.slice(0, 4).map((f) => (
            <WidgetListRow key={f.id} className="grid-cols-[72px_1fr_auto]">
              <span className="eyebrow text-muted-foreground">{f.id}</span>
              <span className="truncate">{f.title}</span>
              {f.isNew ? <StatusBadge tone="warning">Nova</StatusBadge> : <span />}
            </WidgetListRow>
          ))}
        </WidgetList>
      </WidgetPanel>

      <WidgetFooter>
        <WidgetMeta>Conjunto evals-out-2026 · semente 42</WidgetMeta>
        <Button variant="brand" className="ml-auto min-w-32" disabled={running} onClick={run}>
          {running ? <Loader2Icon className="animate-spin" /> : justRan ? <CheckIcon /> : null}
          {running ? "Rodando" : justRan ? "Concluído" : "Rodar evals"}
        </Button>
      </WidgetFooter>
    </Widget>
  )
}

/** The current pass rate as a bar, the baseline as a hairline tick. */
function Comparison({ value, baseline }: { value: number; baseline: number }) {
  const lo = 0.6
  const at = (v: number) => `${((v - lo) / (1 - lo)) * 100}%`
  return (
    <span className="relative h-1.5 w-full rounded-full bg-muted">
      <motion.span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: value < baseline ? "var(--destructive)" : "var(--chart-1)" }}
        initial={false}
        animate={{ width: at(value) }}
        transition={springSoft}
      />
      <span className="absolute -inset-y-1 w-px bg-foreground/50" style={{ left: at(baseline) }} />
    </span>
  )
}
