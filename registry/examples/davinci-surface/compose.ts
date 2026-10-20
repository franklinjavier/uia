import type { ComponentNode, SurfaceMessage } from "@/components/surface/types"
import { UIA_CATALOG_ID } from "@/components/catalog"
import type { QueueItem, Urgency } from "@/examples/davinci2/davinci2-data"

// What davinci's agent sends to show the inbox: A2UI messages against the
// uia catalog, written only from patterns (DecisionCard, ActivityItem,
// Policy) so the screen holds the hand-made level. Every fact
// is a binding into the factory's data (`/items/<id>/…`, `/summary/…`); the
// actions are the factory's own event names.
//
// This function stands in for the model: same input, same output, so the
// screen can be compared with the hand-made davinci2.

const v = "v0.9" as const
const URGENCY: Record<Urgency, string> = {
  now: "Now",
  today: "Today",
  later: "Can wait",
}

const ev = (name: string, context?: Record<string, unknown>) => ({
  event: { name, ...(context ? { context } : {}) },
})
const bind = (id: string, key: string) => ({ path: `/items/${id}/${key}` })

function card(q: QueueItem): ComponentNode {
  const common = {
    id: q.id,
    eyebrow: bind(q.id, "eyebrow"),
    title: bind(q.id, "title"),
  }
  const actions =
    q.kind === "incident"
      ? [
          { label: "Revert 3f2a1c", action: ev("revert", { id: q.id }) },
          {
            label: "Keep and investigate",
            kind: "secondary",
            action: ev("keep", { id: q.id }),
          },
        ]
      : q.kind === "diff"
        ? [
            { label: "Approve", action: ev("integrate", { id: q.id }) },
            {
              label: "Return with note",
              kind: "secondary",
              action: ev("return", { id: q.id }),
            },
            {
              label: "See the diff",
              kind: "aside",
              action: ev("open_diff", { id: q.id }),
            },
          ]
        : q.kind === "preview"
          ? [
              { label: "Promote", action: ev("promote", { id: q.id }) },
              {
                label: "Adjust",
                kind: "secondary",
                action: ev("adjust", { id: q.id }),
              },
              {
                label: "Before / after",
                kind: "aside",
                action: ev("open_preview", { id: q.id }),
              },
            ]
          : undefined
  return {
    ...common,
    component: "DecisionCard",
    agent: "davinci",
    context: bind(q.id, "context"),
    consequence: bind(q.id, "consequence"),
    urgent: q.urgency === "now",
    ...(q.kind === "choice"
      ? {
          options: bind(q.id, "options"),
          pick: bind(q.id, "pick"),
          chooseAction: ev("choose", { id: q.id }),
        }
      : {}),
    ...(actions ? { actions } : {}),
    ...(q.agreement ? { agreement: bind(q.id, "agreement") } : {}),
  }
}

export function composeInbox(
  open: QueueItem[],
  answeredCount: number
): SurfaceMessage[] {
  const nodes: ComponentNode[] = [
    {
      id: "header",
      component: "Column",
      gap: "sm",
      children: ["title", "since"],
    },
    {
      id: "title",
      component: "Text",
      variant: "title",
      text: { path: "/summary/title" },
    },
    {
      id: "since",
      component: "Text",
      variant: "muted",
      text: { path: "/summary/since" },
    },
  ]
  const sections: string[] = ["header"]
  for (const u of ["now", "today", "later"] as Urgency[]) {
    const items = open.filter((q) => q.urgency === u)
    if (!items.length) continue
    nodes.push(
      {
        id: `group-${u}`,
        component: "Column",
        gap: "sm",
        children: [`label-${u}`, ...items.map((q) => q.id)],
      },
      {
        id: `label-${u}`,
        component: "Text",
        variant: "eyebrow",
        text: URGENCY[u],
      },
      ...items.map(card)
    )
    sections.push(`group-${u}`)
  }
  if (answeredCount) {
    nodes.push(
      {
        id: "answered",
        component: "List",
        title: "Answered today",
        children: { path: "/answered", componentId: "answeredRow", key: "id" },
      },
      {
        id: "answeredRow",
        component: "KeyValue",
        label: { path: "what" },
        value: { path: "project" },
      }
    )
    sections.push("answered")
  }
  nodes.unshift({
    id: "root",
    component: "Column",
    gap: "lg",
    children: sections,
  })
  return [
    {
      version: v,
      createSurface: { surfaceId: "inbox", catalogId: UIA_CATALOG_ID },
    },
    { version: v, updateComponents: { surfaceId: "inbox", components: nodes } },
  ]
}

/** "Decided for you": the agent's own decisions, each undoable by the host's rules. */
export function composeDecided(): SurfaceMessage[] {
  return [
    {
      version: v,
      createSurface: { surfaceId: "decided", catalogId: UIA_CATALOG_ID },
    },
    {
      version: v,
      updateComponents: {
        surfaceId: "decided",
        components: [
          {
            id: "root",
            component: "Column",
            gap: "sm",
            children: ["title", "log"],
          },
          {
            id: "title",
            component: "Text",
            variant: "title",
            text: "Decided for you",
          },
          {
            id: "log",
            component: "ActivityList",
            children: { path: "/decided", componentId: "entry", key: "id" },
          },
          {
            id: "entry",
            component: "ActivityItem",
            time: { path: "time" },
            subject: { path: "subject" },
            what: { path: "what" },
            why: { path: "why" },
            rule: { path: "rule" },
            undone: { path: "undone" },
            undoAction: ev("undo", { id: { path: "id" } }),
          },
        ],
      },
    },
  ]
}

/** Rules: standing policies the person can switch off. */
export function composeRules(): SurfaceMessage[] {
  return [
    {
      version: v,
      createSurface: { surfaceId: "rules", catalogId: UIA_CATALOG_ID },
    },
    {
      version: v,
      updateComponents: {
        surfaceId: "rules",
        components: [
          {
            id: "root",
            component: "Column",
            gap: "sm",
            children: ["title", "list"],
          },
          { id: "title", component: "Text", variant: "title", text: "Rules" },
          {
            id: "list",
            component: "PolicyList",
            children: { path: "/rules", componentId: "rule", key: "id" },
          },
          {
            id: "rule",
            component: "Policy",
            text: { path: "text" },
            category: { path: "category" },
            applied: { path: "applied" },
            on: { path: "on" },
            toggleAction: ev("toggle_rule", { id: { path: "id" } }),
          },
        ],
      },
    },
  ]
}
