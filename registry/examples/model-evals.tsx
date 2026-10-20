import * as React from "react"

import {
  ModelEvals,
  type ModelEvalsBaseline,
  type ModelEvalsFailure,
  type ModelEvalsLabels,
  type ModelEvalsSuite,
} from "@/components/widgets/model-evals"

// Example: the ModelEvals widget with demo data, in pt-BR. The widget is a
// pure view (components/widgets/model-evals); this file is the fixture and
// the simulated eval runner: "Rodar evals" waits, nudges every suite's pass
// rate and hands the new numbers back to the widget.

export const TARGET = 0.9
export const MODEL = "atlas-v13"

export const BASELINES: ModelEvalsBaseline[] = [
  {
    id: "v12",
    label: "atlas-v12",
    short: "v12",
    pass: {
      reasoning: 0.88,
      code: 0.861,
      safety: 0.969,
      extraction: 0.842,
      math: 0.73,
    },
  },
  {
    id: "v11",
    label: "atlas-v11",
    short: "v11",
    pass: {
      reasoning: 0.851,
      code: 0.83,
      safety: 0.958,
      extraction: 0.81,
      math: 0.702,
    },
  },
]

export const SUITES: ModelEvalsSuite[] = [
  { id: "reasoning", name: "Raciocínio", cases: 1240, pass: 0.912 },
  { id: "code", name: "Código", cases: 980, pass: 0.847 },
  { id: "safety", name: "Segurança", cases: 620, pass: 0.974 },
  { id: "extraction", name: "Extração", cases: 1150, pass: 0.889 },
  { id: "math", name: "Matemática", cases: 822, pass: 0.765 },
]

export const FAILURES: ModelEvalsFailure[] = [
  {
    id: "cod-0412",
    suite: "code",
    title: "Refatoração remove o caso de borda do teste",
    isNew: true,
  },
  {
    id: "cod-0377",
    suite: "code",
    title: "Import circular ao dividir o módulo",
    isNew: true,
  },
  {
    id: "mat-0918",
    suite: "math",
    title: "Erro de arredondamento em juros compostos",
  },
  {
    id: "ext-1203",
    suite: "extraction",
    title: "Data em formato americano lida como dd/mm",
  },
  {
    id: "rac-0088",
    suite: "reasoning",
    title: "Conclui antes de checar a premissa 3",
  },
  {
    id: "seg-0041",
    suite: "safety",
    title: "Recusa um pedido legítimo de dosagem",
  },
  { id: "cod-0251", suite: "code", title: "Timeout no teste de concorrência" },
]

export const LABELS_PT_BR: ModelEvalsLabels = {
  compareWith: "Comparar com",
  vs: (b) => `vs ${b}`,
  passRate: (m) => `Taxa de acerto · ${m}`,
  summary: ({ baseline, pass, target }) =>
    `${baseline} tinha ${pass}% · meta ${target}%`,
  cases: "Casos",
  caseCount: (n) => `${n} casos`,
  running: "Rodando…",
  ranAt: (when) => <>Rodou {when}</>,
  target: "Meta",
  bySuite: "Por suíte",
  pass: "Acerto",
  delta: "Δ pp",
  points: "pp",
  recentFailures: "Falhas recentes",
  newCount: (n) => `${n} novas`,
  newBadge: "Nova",
  rerun: "Rodar evals",
  rerunning: "Rodando",
  done: "Concluído",
}

export function ModelEvalsExample() {
  const [suites, setSuites] = React.useState(SUITES)
  const [running, setRunning] = React.useState(false)
  const [ranAt, setRanAt] = React.useState("há 18 min")
  const timer = React.useRef<number | undefined>(undefined)

  React.useEffect(() => () => window.clearTimeout(timer.current), [])

  function rerun() {
    setRunning(true)
    timer.current = window.setTimeout(() => {
      setSuites((list) =>
        list.map((s) => ({
          ...s,
          pass: Math.min(
            0.995,
            Math.max(0.6, s.pass + (Math.random() - 0.4) * 0.02)
          ),
        }))
      )
      setRanAt("agora")
      setRunning(false)
    }, 2200)
  }

  return (
    <ModelEvals
      title="Qualidade do modelo"
      model={MODEL}
      suites={suites}
      baselines={BASELINES}
      failures={FAILURES}
      target={TARGET}
      ranAt={ranAt}
      running={running}
      onRerun={rerun}
      meta="Conjunto evals-out-2026 · semente 42"
      labels={LABELS_PT_BR}
      locale="pt-BR"
    />
  )
}
