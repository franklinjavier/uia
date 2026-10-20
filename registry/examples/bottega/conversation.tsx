import * as React from "react"
import { ListChecksIcon, RotateCcwIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AgentOrb } from "@/components/ds/agent-orb"
import { ActionCardFields, ActionCardPanel, ResolvedRow } from "@/components/parts/action-card"
import { Confirmation } from "@/components/parts/confirmation"
import { PartTransition } from "@/components/parts/part-transition"
import { PreviewApproval, PreviewApprovalResolved } from "@/components/parts/preview-approval"
import { ChatThread, ChatThreadItem } from "@/components/chat/chat-thread"
import { ChatTurn } from "@/components/chat/chat-turn"
import { Composer, ComposerInput, ComposerSubmit, ComposerToolbar } from "@/components/chat/composer"
import type { ToolRegistry } from "@/components/chat/tool-registry"
import { PLAN, type Decision, type Project } from "@/examples/bottega/bottega-data"
import type { Outcome, useBottega } from "@/examples/bottega/use-bottega"

// The one conversation with the agent. Decisions arrive here as cards; the
// dashboard strip only points at them. Each card closes into a record once
// answered (PartTransition), and the agent answers in the thread.

export function Conversation({
  state,
  flash,
  onClose,
}: {
  state: ReturnType<typeof useBottega>
  /** Decision id to briefly highlight (opened from the dashboard strip). */
  flash: string | null
  /** Shown as a close button when the conversation is a sheet. */
  onClose?: () => void
}) {
  const { messages, decisions, projects, typing, decide, send } = state
  const [input, setInput] = React.useState("")
  const waiting = decisions.some((d) => d.state === "open")

  const tools = React.useMemo<ToolRegistry>(
    () => ({
      decision: {
        render: (part: { toolCallId: string }) => {
          const d = decisions.find((x) => x.id === part.toolCallId)
          if (!d) return null
          return (
            <div
              id={`decision-${d.id}`}
              className={cn(
                "scroll-my-24 rounded-2xl border border-transparent transition-colors duration-700",
                flash === d.id && "border-attention/50"
              )}
            >
              <PartTransition state={d.state}>
                <DecisionCard decision={d} projects={projects} onDecide={(o) => decide(d.id, o)} />
              </PartTransition>
            </div>
          )
        },
      },
    }),
    [decisions, projects, flash, decide]
  )

  return (
    <aside data-slot="bottega-conversation" className="flex min-h-0 flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border/70 px-5">
        <AgentOrb phase={typing ? "composing" : waiting ? "waiting" : "idle"} active={typing || waiting} />
        <span className="text-[15px]">Bottega</span>
        <span className="eyebrow ml-auto truncate text-muted-foreground">
          {typing ? "Escrevendo…" : waiting ? "Esperando você" : "Trabalhando em segundo plano"}
        </span>
        {onClose && (
          <Button variant="ghost" size="icon-sm" aria-label="Fechar conversa" className="-mr-2 text-muted-foreground" onClick={onClose}>
            <XIcon />
          </Button>
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        <ChatThread busy={typing} className="gap-6 px-5 py-6">
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

      <div className="shrink-0 p-4 pt-0">
        <div className="rounded-2xl border border-border bg-card shadow-xs">
          <Composer
            onSubmit={() => {
              if (!input.trim()) return
              send(input.trim())
              setInput("")
            }}
          >
            <ComposerInput
              aria-label="Mensagem para a Bottega"
              placeholder="Converse sobre qualquer projeto…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-12"
            />
            <ComposerToolbar>
              <ComposerSubmit className="ml-auto" busy={false} disabled={!input.trim()} />
            </ComposerToolbar>
          </Composer>
        </div>
      </div>
    </aside>
  )
}

function DecisionCard({
  decision: d,
  projects,
  onDecide,
}: {
  decision: Decision
  projects: Project[]
  onDecide: (o: Outcome) => void
}) {
  const project = projects.find((p) => p.id === d.project)!

  if (d.kind === "recovery") {
    if (d.state !== "open")
      return (
        <ResolvedRow
          icon={<RotateCcwIcon />}
          label={project.name}
          summary={d.state === "accepted" ? "Reverter para v41 · aprovado" : "Mantida a v42"}
          muted={d.state === "declined"}
        />
      )
    return (
      <Confirmation
        title="Bottega quer reverter a migração do banco do Site"
        description="Desde a v42, 6% das requisições retornam 502. A migração mudou o índice de contatos; voltar para a v41 desfaz isso."
        status="Precisa de você"
        note="Os contatos recebidos nesse meio-tempo não se perdem."
        allowLabel="Reverter para v41"
        denyLabel="Manter v42"
        onAllow={() => onDecide({ accepted: true })}
        onDeny={() => onDecide({ accepted: false })}
      >
        <ActionCardPanel>
          <ActionCardFields
            fields={[
              { label: "Agora", value: "v42 · 6% de erro" },
              { label: "Volta para", value: "v41 · estável há 3 dias" },
              { label: "Tempo", value: "cerca de 2 minutos" },
            ]}
          />
        </ActionCardPanel>
      </Confirmation>
    )
  }

  if (d.kind === "plan") {
    if (d.state !== "open")
      return (
        <ResolvedRow
          icon={<ListChecksIcon />}
          label={project.name}
          summary={d.state === "accepted" ? "Plano aprovado · execução começou" : "Plano em ajuste"}
          muted={d.state === "declined"}
        />
      )
    return (
      <Confirmation
        title="Bottega quer começar o CRM interno com este plano"
        status="Precisa de você"
        allowLabel="Aprovar plano"
        denyLabel="Ajustar"
        onAllow={() => onDecide({ accepted: true })}
        onDeny={() => onDecide({ accepted: false })}
      >
        <ActionCardPanel>
          <ActionCardFields
            fields={[
              { label: "Escopo", value: PLAN.scope },
              { label: "Fora", value: PLAN.outOfScope },
              { label: "Prazo", value: PLAN.estimate },
              { label: "Risco", value: PLAN.risks },
            ]}
          />
        </ActionCardPanel>
      </Confirmation>
    )
  }

  if (d.state !== "open")
    return (
      <PreviewApprovalResolved
        label={project.name}
        accepted={d.state === "accepted"}
        summary={d.state === "accepted" ? "Vitrine aceita · publicando v1.8" : "Ajuste pedido"}
        note={d.note}
      />
    )
  return (
    <PreviewApproval
      title="Bottega quer publicar a nova vitrine da Loja"
      description="Busca por categoria no topo e cards maiores. Provada no preview: 6 de 6 cenários."
      before={<StorefrontBefore />}
      after={<StorefrontAfter />}
      href="#"
      note="Nada vai para produção sem o seu aceite."
      labels={{
        status: "Precisa do seu olho",
        before: "Antes",
        after: "Depois",
        open: "Abrir preview",
        accept: "Aceitar e publicar",
        requestChanges: "Pedir ajuste",
        send: "Enviar ajuste",
        cancel: "Cancelar",
        placeholder: "O que deve mudar?",
      }}
      onAccept={() => onDecide({ accepted: true })}
      onRequestChanges={(note) => onDecide({ accepted: false, note })}
    />
  )
}

/* Miniature storefronts for the preview card: drawn with tokens only. */

function StorefrontBefore() {
  return (
    <div className="flex h-full flex-col gap-1.5 p-2">
      <div className="h-1.5 w-1/3 rounded-full bg-foreground/20" />
      <div className="grid flex-1 grid-cols-3 gap-1.5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-sm bg-muted" />
        ))}
      </div>
    </div>
  )
}

function StorefrontAfter() {
  return (
    <div className="flex h-full flex-col gap-1.5 p-2">
      <div className="flex items-center gap-1">
        <div className="h-1.5 w-1/4 rounded-full bg-foreground/20" />
        <div className="ml-auto h-2.5 w-2/5 rounded-full border border-border bg-card" />
      </div>
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn("h-1.5 w-6 rounded-full", i === 0 ? "bg-foreground/60" : "bg-muted")} />
        ))}
      </div>
      <div className="grid flex-1 grid-cols-2 gap-1.5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-sm bg-[color-mix(in_oklch,var(--chart-1)_14%,var(--muted))]" />
        ))}
      </div>
    </div>
  )
}
