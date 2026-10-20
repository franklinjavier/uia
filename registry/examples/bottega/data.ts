import type { StageStatus } from "@/components/ds/stage-track"

// The Bottega example's world: a few projects at different points of the
// flow, the decisions that wait on the person, production and the work the
// agent did on its own. Everything here is fiction.

export const STAGES = ["Conversa", "Plano", "Execução", "Prova", "Publicação", "Observação"] as const

export type Health = "ok" | "degraded" | "recovering"

export type Project = {
  id: string
  name: string
  goal: string
  stages: StageStatus[]
  /** What is happening now, in one short line. */
  now: string
  live?: {
    version: string
    health: Health
    uptime: number
    /** Error rate per minute, last 30 minutes. */
    errors: number[]
    deployed: string
  }
}

export type DecisionKind = "preview" | "plan" | "recovery"

export type Decision = {
  id: string
  project: string
  kind: DecisionKind
  /** One line for the chip. */
  ask: string
  state: "open" | "accepted" | "declined"
  note?: string
}

export type Activity = { id: string; project: string; when: string; text: string }

const calm = (base: number) => Array.from({ length: 30 }, (_, i) => base + Math.abs(Math.sin(i * 1.7)) * base * 0.6)
const spike = Array.from({ length: 30 }, (_, i) => (i > 21 ? 4 + (i - 21) * 2.2 : 0.4 + Math.abs(Math.sin(i)) * 0.3))

export const INITIAL_PROJECTS: Project[] = [
  {
    id: "loja",
    name: "Loja",
    goal: "Nova vitrine com busca por categoria",
    stages: ["done", "done", "done", "done", "waiting", "todo"],
    now: "Provada · 6 de 6 cenários",
    live: { version: "v1.7", health: "ok", uptime: 0.9998, errors: calm(0.3), deployed: "há 3 dias" },
  },
  {
    id: "crm",
    name: "CRM interno",
    goal: "Funil de vendas com importação de planilhas",
    stages: ["done", "waiting", "todo", "todo", "todo", "todo"],
    now: "Plano pronto para o seu ok",
  },
  {
    id: "app",
    name: "App de agendamento",
    goal: "Login com Google e lembretes por WhatsApp",
    stages: ["done", "done", "active", "todo", "todo", "todo"],
    now: "Executando · 12 de 18 tarefas",
  },
  {
    id: "site",
    name: "Site institucional",
    goal: "Páginas de serviço e formulário de contato",
    stages: ["done", "done", "done", "done", "done", "failed"],
    now: "Erros 502 desde a migração do banco",
    live: { version: "v42", health: "degraded", uptime: 0.9931, errors: spike, deployed: "há 40 min" },
  },
  {
    id: "blog",
    name: "Blog",
    goal: "Newsletter e busca nos artigos",
    stages: ["done", "done", "done", "done", "done", "active"],
    now: "No ar · observando",
    live: { version: "v12", health: "ok", uptime: 0.9999, errors: calm(0.2), deployed: "há 2 dias" },
  },
]

export const INITIAL_DECISIONS: Decision[] = [
  { id: "d-site", project: "site", kind: "recovery", ask: "Reverter a migração do banco", state: "open" },
  { id: "d-loja", project: "loja", kind: "preview", ask: "Aceitar a nova vitrine", state: "open" },
  { id: "d-crm", project: "crm", kind: "plan", ask: "Aprovar o plano do funil", state: "open" },
]

export const KIND_LABEL: Record<DecisionKind, string> = {
  preview: "Preview",
  plan: "Plano",
  recovery: "Recuperação",
}

export const INITIAL_ACTIVITY: Activity[] = [
  { id: "a1", project: "site", when: "09:42", text: "Detectou erros 502 após a migração e pausou novas publicações" },
  { id: "a2", project: "blog", when: "09:15", text: "Recuperou um pico de latência reiniciando uma instância" },
  { id: "a3", project: "loja", when: "08:58", text: "Provou a vitrine no preview: 6 de 6 cenários passaram" },
  { id: "a4", project: "app", when: "08:31", text: "Concluiu o login com Google e começou os lembretes" },
  { id: "a5", project: "crm", when: "08:05", text: "Escreveu o plano do funil a partir da conversa de ontem" },
]

export const PLAN = {
  scope: "Funil em 5 etapas, importação de .xlsx e .csv, relatório semanal",
  outOfScope: "Integração com e-mail (fica para a próxima fase)",
  estimate: "2 dias de execução · 1 rodada de preview",
  risks: "Planilhas antigas sem cabeçalho padrão",
}
