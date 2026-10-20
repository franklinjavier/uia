import * as React from "react"
import type { UIMessage } from "ai"

import {
  INITIAL_ACTIVITY,
  INITIAL_DECISIONS,
  INITIAL_PROJECTS,
  type Activity,
  type Decision,
  type Project,
} from "@/examples/bottega/data"

// The Bottega example's state machine. Deciding something updates the
// decision, moves the project along the flow (with the agent's work playing
// out over a couple of seconds), logs what the agent did and answers in the
// conversation. A real app replaces the timers with its backend; the shape
// of the state stays.

let seq = 0
const id = (p: string) => `${p}-${++seq}`
// Fictional morning: new entries are simply "now".
const clock = () => "agora"

function text(role: "user" | "assistant", body: string): UIMessage {
  return { id: id("m"), role, parts: [{ type: "text", text: body }] }
}

const INITIAL_MESSAGES: UIMessage[] = [
  text("user", "Bom dia! Como estão os projetos?"),
  {
    id: "m-hello",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Bom dia! O **Blog** se recuperou sozinho de um pico de latência e o **App** segue executando. Três coisas precisam de você:",
      },
      ...INITIAL_DECISIONS.map(
        (d) =>
          ({
            type: "tool-decision",
            toolCallId: d.id,
            state: "input-available",
            input: { decision: d.id },
          }) as UIMessage["parts"][number]
      ),
    ],
  },
]

export type Outcome = { accepted: boolean; note?: string }

export function useBottega() {
  const [projects, setProjects] = React.useState<Project[]>(INITIAL_PROJECTS)
  const [decisions, setDecisions] = React.useState<Decision[]>(INITIAL_DECISIONS)
  const [activity, setActivity] = React.useState<Activity[]>(INITIAL_ACTIVITY)
  const [messages, setMessages] = React.useState<UIMessage[]>(INITIAL_MESSAGES)
  const [typing, setTyping] = React.useState(false)

  const patch = (pid: string, change: (p: Project) => Partial<Project>) =>
    setProjects((list) => list.map((p) => (p.id === pid ? { ...p, ...change(p) } : p)))
  const log = (project: string, body: string) =>
    setActivity((list) => [{ id: id("a"), project, when: clock(), text: body }, ...list])
  const later = (ms: number, fn: () => void) => window.setTimeout(fn, ms)

  function reply(body: string, delay = 700) {
    setTyping(true)
    later(delay, () => {
      setTyping(false)
      setMessages((list) => [...list, text("assistant", body)])
    })
  }

  function decide(decisionId: string, outcome: Outcome) {
    const d = decisions.find((x) => x.id === decisionId)
    if (!d || d.state !== "open") return
    setDecisions((list) =>
      list.map((x) => (x.id === decisionId ? { ...x, state: outcome.accepted ? "accepted" : "declined", note: outcome.note } : x))
    )

    if (d.kind === "recovery") {
      if (outcome.accepted) {
        patch("site", (p) => ({
          now: "Revertendo a migração…",
          stages: p.stages.map((s, i) => (i === 5 ? "active" : s)),
          live: p.live && { ...p.live, health: "recovering" },
        }))
        reply("Revertendo agora. Te aviso assim que os erros zerarem.")
        later(2600, () => {
          patch("site", (p) => ({
            now: "No ar · v41 restaurada",
            live: p.live && {
              ...p.live,
              version: "v41",
              health: "ok",
              deployed: "agora",
              errors: p.live.errors.map((_, i) => 0.3 + Math.abs(Math.sin(i * 1.3)) * 0.2),
            },
          }))
          log("site", "Reverteu a migração do banco; os erros 502 zeraram")
          reply("Pronto: o **Site** voltou para a v41 e os erros zeraram. Guardei a migração para corrigir antes de tentar de novo.", 300)
        })
      } else {
        patch("site", () => ({ now: "Investigando os 502 na v42" }))
        reply("Combinado, mantenho a v42. Sigo investigando os 502 e te chamo se piorar.")
      }
    }

    if (d.kind === "preview") {
      if (outcome.accepted) {
        patch("loja", (p) => ({ now: "Publicando v1.8…", stages: p.stages.map((s, i) => (i === 4 ? "active" : s)) }))
        reply("Aceito. Publicando a nova vitrine.")
        later(2600, () => {
          patch("loja", (p) => ({
            now: "No ar · v1.8",
            stages: p.stages.map((s, i) => (i === 4 ? "done" : i === 5 ? "active" : s)),
            live: p.live && { ...p.live, version: "v1.8", deployed: "agora" },
          }))
          log("loja", "Publicou a nova vitrine (v1.8) e começou a observar")
          reply("A **Loja v1.8** está no ar. Fico de olho nas primeiras horas.", 300)
        })
      } else {
        patch("loja", () => ({ now: "Ajustando a vitrine", stages: ["done", "done", "active", "todo", "todo", "todo"] }))
        log("loja", `Voltou à execução com o seu ajuste: “${outcome.note}”`)
        reply("Entendido, vou ajustar e te mostro um novo preview.")
      }
    }

    if (d.kind === "plan") {
      if (outcome.accepted) {
        patch("crm", () => ({ now: "Executando · 0 de 9 tarefas", stages: ["done", "done", "active", "todo", "todo", "todo"] }))
        log("crm", "Começou a execução do plano do funil")
        reply("Plano aprovado. Começando pelo modelo de dados do funil.")
      } else {
        patch("crm", () => ({ now: "Refazendo o plano com você", stages: ["done", "active", "todo", "todo", "todo", "todo"] }))
        reply("Claro. O que você quer mudar no plano?")
      }
    }
  }

  function send(body: string) {
    setMessages((list) => [...list, text("user", body)])
    reply("Anotado. Sigo com isso e te chamo quando precisar de uma decisão.", 900)
  }

  return { projects, decisions, activity, messages, typing, decide, send }
}
