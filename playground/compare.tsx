import { z } from "zod"

import { Confirmation } from "@/components/parts/confirmation"
import { ActionCardFields, ActionCardPanel } from "@/components/parts/action-card"
import { Surface } from "@/components/surface/surface"
import { surfaceFromMessages } from "@/components/surface/store"
import { action, defineComponent, extendCatalog } from "@/components/surface/catalog"
import type { SurfaceMessage } from "@/components/surface/types"
import { uiaCatalog, UIA_CATALOG_ID } from "@/components/catalog"
import { IncidentCard } from "@/examples/davinci/cards"
import { INCIDENT } from "@/examples/davinci/davinci-data"

// Experiment (playground only): can an agent reach the hand-made level?
// A: davinci's IncidentCard, written by hand.
// B: the same incident composed from today's catalog primitives.
// C: the same incident through a compound entry (`Confirmation`, the very
//    part A is made of) that the agent only fills.

const FIELDS = [
  { label: "Check", value: "GET /rss.xml → 500 since 08:52" },
  { label: "Users", value: "Feed readers only; pages are fine" },
  { label: "Fix", value: "Revert, then BLOG-4 goes back to build" },
]

const v = "v0.9" as const
const create = (id: string): SurfaceMessage => ({ version: v, createSurface: { surfaceId: id, catalogId: UIA_CATALOG_ID } })

// B — what the agent can do today: Note + List of KeyValue + Confirm.
const primitives: SurfaceMessage[] = [
  create("b"),
  { version: v, updateDataModel: { surfaceId: "b", path: "/", value: { fields: FIELDS } } },
  {
    version: v,
    updateComponents: {
      surfaceId: "b",
      components: [
        { id: "root", component: "Column", gap: "sm", children: ["note", "card", "confirm"] },
        { id: "note", component: "Note", tone: "destructive", badge: "Incident", text: INCIDENT.title },
        { id: "card", component: "Card", child: "list" },
        { id: "list", component: "List", children: { path: "/fields", componentId: "field" } },
        { id: "field", component: "KeyValue", label: { path: "label" }, value: { path: "value" } },
        {
          id: "confirm",
          component: "Confirm",
          title: `Revert ${INCIDENT.culprit}?`,
          description: INCIDENT.bisect,
          confirmLabel: `Revert ${INCIDENT.culprit}`,
          cancelLabel: "Keep and investigate",
          action: { event: { name: "revert" } },
          cancelAction: { event: { name: "keep" } },
        },
      ],
    },
  },
]

// C — a compound entry: the agent fills fields, the layout is ours.
const ConfirmationEntry = defineComponent({
  name: "Confirmation",
  kind: "block",
  description: "An approval gate with its status, the facts as fields, a trust note and the two answers.",
  props: z.object({
    title: z.string(),
    description: z.string().optional(),
    status: z.string().optional(),
    fields: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    note: z.string().optional(),
    allowLabel: z.string(),
    denyLabel: z.string(),
    action,
    denyAction: action,
  }),
  render: (p, ctx) => (
    <Confirmation
      title={p.title}
      description={p.description}
      status={p.status}
      note={p.note}
      allowLabel={p.allowLabel}
      denyLabel={p.denyLabel}
      onAllow={ctx.action(p.action) ?? (() => {})}
      onDeny={ctx.action(p.denyAction) ?? (() => {})}
    >
      {p.fields && (
        <ActionCardPanel>
          <ActionCardFields size="sm" fields={p.fields} />
        </ActionCardPanel>
      )}
    </Confirmation>
  ),
})
const catalogC = extendCatalog(uiaCatalog, [ConfirmationEntry])

const compound: SurfaceMessage[] = [
  create("c"),
  { version: v, updateDataModel: { surfaceId: "c", path: "/", value: { fields: FIELDS } } },
  {
    version: v,
    updateComponents: {
      surfaceId: "c",
      components: [
        {
          id: "root",
          component: "Confirmation",
          title: INCIDENT.title,
          description: INCIDENT.bisect,
          status: "Incident",
          fields: { path: "/fields" },
          note: "Revert goes through the full gates; nothing else on next moves.",
          allowLabel: `Revert ${INCIDENT.culprit}`,
          denyLabel: "Keep and investigate",
          action: { event: { name: "revert" } },
          denyAction: { event: { name: "keep" } },
        },
      ],
    },
  },
]

function Column({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full max-w-[26rem] min-w-0 flex-col gap-3">
      <div className="flex flex-col">
        <span className="eyebrow text-muted-foreground">{label}</span>
        <span className="text-xs text-faint-foreground">{note}</span>
      </div>
      {children}
    </div>
  )
}

export function Compare() {
  return (
    <div className="flex min-h-svh flex-wrap items-start justify-center gap-10 px-6 py-12">
      <Column label="A · hand-made" note="davinci IncidentCard">
        <IncidentCard incident={INCIDENT} state="open" onDecide={() => {}} />
      </Column>
      <Column label="B · agent, primitives" note="Note + Card(List·KeyValue) + Confirm">
        <Surface surface={surfaceFromMessages(primitives)} catalog={uiaCatalog} size="sm" showIssues />
      </Column>
      <Column label="C · agent, compound" note="one Confirmation entry, filled">
        <Surface surface={surfaceFromMessages(compound)} catalog={catalogC} size="sm" showIssues />
      </Column>
    </div>
  )
}
