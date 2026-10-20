import * as React from "react"

import { Surface } from "@/components/surface/surface"
import {
  createSurfaceStore,
  getAt,
  useSurface,
  type SurfaceStore,
} from "@/components/surface/store"
import { defineActions } from "@/components/surface/catalog"
import type {
  SurfaceAction,
  SurfaceIssue,
  SurfaceMessage,
} from "@/components/surface/types"
import { uiaCatalog, UIA_CATALOG_ID } from "@/components/catalog"
import { DiffCard, IncidentCard } from "@/examples/davinci/cards"
import { INCIDENT, RISKY_DIFF } from "@/examples/davinci/data"

// Playground only: every pattern entry rendered through <Surface>, with a
// host action registry (some reversible, one final, destructive ones) and
// a host that answers events by updating the data model, so each pattern
// walks its states. The hand-made davinci cards sit beside their entries.

const ACTIONS = defineActions({
  revert: {
    destructive: true,
    reversible: false,
    describe: "Reverts the blog to v11",
  },
  keep: {},
  check_again: {},
  undo: { reversible: true },
  undo_merge: { reversible: false },
  toggle_rule: { reversible: true },
  approve_diff: {},
  return_diff: {},
  publish_preview: { destructive: true, describe: "Publishes the storefront" },
  request_changes: {},
  open_decision: {},
})

const v = "v0.9" as const
const surface = (
  id: string,
  data: unknown,
  components: Record<string, unknown>[]
): SurfaceMessage[] => [
  {
    version: v,
    createSurface: { surfaceId: id, catalogId: UIA_CATALOG_ID },
  },
  { version: v, updateDataModel: { surfaceId: id, path: "/", value: data } },
  {
    version: v,
    updateComponents: {
      surfaceId: id,
      components: components as never,
    },
  },
]

const FIELDS = [
  { label: "Check", value: "GET /rss.xml → 500 since 08:52" },
  { label: "Users", value: "Feed readers only; pages are fine" },
  { label: "Fix", value: "Revert, then BLOG-4 goes back to build" },
]

const svg = (body: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#fafafa"/>${body}</svg>`
  )}`
const BEFORE = svg(
  `<rect x="24" y="24" width="120" height="14" rx="4" fill="#d4d4d8"/><rect x="24" y="70" width="352" height="10" rx="3" fill="#e4e4e7"/><rect x="24" y="90" width="300" height="10" rx="3" fill="#e4e4e7"/><rect x="24" y="130" width="168" height="140" rx="10" fill="#e4e4e7"/><rect x="208" y="130" width="168" height="140" rx="10" fill="#e4e4e7"/>`
)
const AFTER = svg(
  `<rect x="24" y="24" width="120" height="14" rx="4" fill="#d4d4d8"/><rect x="24" y="58" width="352" height="96" rx="12" fill="#18181b"/><rect x="44" y="84" width="160" height="14" rx="4" fill="#fafafa"/><rect x="44" y="108" width="110" height="10" rx="3" fill="#a1a1aa"/><rect x="24" y="170" width="108" height="100" rx="10" fill="#e4e4e7"/><rect x="146" y="170" width="108" height="100" rx="10" fill="#e4e4e7"/><rect x="268" y="170" width="108" height="100" rx="10" fill="#e4e4e7"/>`
)

const INITIAL: SurfaceMessage[] = [
  ...surface("confirmation", { incident: { fields: FIELDS } }, [
    {
      id: "root",
      component: "Confirmation",
      title: INCIDENT.title,
      description: INCIDENT.bisect,
      status: "Incident",
      fields: { path: "/incident/fields" },
      note: "Revert goes through the full gates; nothing else on next moves.",
      allowLabel: `Revert ${INCIDENT.culprit}`,
      denyLabel: "Keep and investigate",
      action: { event: { name: "revert", context: { commit: "3f2a1c" } } },
      denyAction: { event: { name: "keep" } },
      resolved: { path: "/incident/resolved" },
    },
  ]),
  ...surface(
    "status",
    {
      tone: "warning",
      status: "Reverting",
      steps: [
        { label: "Detected", status: "done" },
        { label: "Reverted", status: "active" },
        { label: "Healthy", status: "todo" },
      ],
    },
    [
      {
        id: "root",
        component: "StatusCard",
        eyebrow: "blog · Incident",
        title: "RSS returns 500 since v12",
        tone: { path: "/tone" },
        status: { path: "/status" },
        steps: { path: "/steps" },
        fields: [
          { label: "Since", value: "08:52" },
          { label: "Culprit", value: "3f2a1c (BLOG-4, feed dates)" },
        ],
        note: "BLOG-4 goes back to build once the check is green.",
        actions: [
          { label: "Check again", action: { event: { name: "check_again" } } },
        ],
        resolved: { path: "/resolved" },
      },
    ]
  ),
  ...surface(
    "status-failed",
    {
      steps: [
        { label: "Backup", status: "done" },
        { label: "Migrate", status: "failed" },
        { label: "Verify", status: "todo" },
      ],
    },
    [
      {
        id: "root",
        component: "StatusCard",
        eyebrow: "bottega · Migration",
        title: "0042_sessions failed on the replica",
        tone: "destructive",
        status: "Failed",
        steps: { path: "/steps" },
        note: "Primary untouched; the replica is back on 0041.",
      },
    ]
  ),
  ...surface(
    "activity",
    {
      items: [
        {
          id: "a1",
          time: "08:52",
          subject: "blog",
          what: "Reverted 3f2a1c",
          why: "The production check failed twice",
          rule: "Revert failed deploys",
        },
        {
          id: "a2",
          time: "08:40",
          subject: "bottega",
          what: "Merged T-580 into main",
          why: "All gates green, low risk",
        },
        {
          id: "a3",
          time: "08:12",
          subject: "site",
          what: "Approved a dependency bump",
          why: "Patch release, checks green",
          rule: "Auto-approve patch bumps",
        },
      ],
    },
    [
      {
        id: "root",
        component: "ActivityList",
        title: "Decided for you",
        children: ["a1", "a2", "a3"],
      },
      // Undo is per entry: the host decides each event is reversible.
      ...["a1", "a2", "a3"].map((id, i) => ({
        id,
        component: "ActivityItem",
        time: { path: `/items/${i}/time` },
        subject: { path: `/items/${i}/subject` },
        what: { path: `/items/${i}/what` },
        why: { path: `/items/${i}/why` },
        rule: { path: `/items/${i}/rule` },
        undone: { path: `/items/${i}/undone` },
        undoAction: {
          event: { name: i === 1 ? "undo_merge" : "undo", context: { id } },
        },
      })),
    ]
  ),
  ...surface(
    "policy",
    {
      rules: [
        {
          id: "r1",
          text: "Auto-approve patch bumps with green checks",
          category: "Reviews",
          applied: 14,
          on: true,
        },
        {
          id: "r2",
          text: "Revert a deploy when its production check fails twice",
          category: "Incidents",
          applied: 3,
          on: true,
        },
        {
          id: "r3",
          text: "Merge low-risk tasks without asking",
          category: "Integration",
          applied: 41,
          on: false,
        },
      ],
    },
    [
      {
        id: "root",
        component: "PolicyList",
        title: "Rules",
        children: { path: "/rules", componentId: "rule" },
      },
      {
        id: "rule",
        component: "Policy",
        text: { path: "text" },
        category: { path: "category" },
        applied: { path: "applied" },
        on: { path: "on" },
        toggleAction: {
          event: { name: "toggle_rule", context: { id: { path: "id" } } },
        },
      },
    ]
  ),
  ...surface(
    "diff",
    { files: RISKY_DIFF.risky.map((f) => ({ path: f.file, lines: f.lines })) },
    [
      {
        id: "root",
        component: "Diff",
        title: `${RISKY_DIFF.key} · ${RISKY_DIFF.title}`,
        status: "High risk",
        summary: RISKY_DIFF.summary,
        files: { path: "/files" },
        actions: [
          { label: "Approve", action: { event: { name: "approve_diff" } } },
          {
            label: "Return with note",
            kind: "secondary",
            action: { event: { name: "return_diff" } },
          },
        ],
        resolved: { path: "/resolved" },
      },
    ]
  ),
  ...surface("citation", {}, [
    { id: "root", component: "Column", gap: "sm", children: ["c1", "c2"] },
    {
      id: "c1",
      component: "Citation",
      source: "RFC 9110 · HTTP Semantics",
      url: "https://www.rfc-editor.org/rfc/rfc9110",
      quote:
        "The 500 (Internal Server Error) status code indicates that the server encountered an unexpected condition that prevented it from fulfilling the request.",
      ref: "§ 15.6.1",
    },
    {
      id: "c2",
      component: "Citation",
      source: "Q3 board deck",
      quote: "Two enterprise renewals slipped to Q4 pending security review.",
      ref: "P. 12",
    },
  ]),
  ...surface("before-after", {}, [
    {
      id: "root",
      component: "BeforeAfter",
      title: "Bottega wants to publish the new storefront",
      description:
        "A hero for the featured collection; the grid goes to three columns.",
      before: { src: BEFORE, alt: "Current storefront" },
      after: { src: AFTER, alt: "New storefront" },
      url: "https://preview.example.com/store",
      acceptAction: { event: { name: "publish_preview" } },
      changesAction: { event: { name: "request_changes" } },
      resolved: { path: "/resolved" },
    },
  ]),
  ...surface(
    "chips",
    {
      chips: [
        {
          id: "d1",
          kind: "Preview",
          subject: "Store",
          text: "Accept the new storefront",
        },
        {
          id: "d2",
          kind: "Review",
          subject: "T-583",
          text: "Session tokens touch auth",
        },
      ],
    },
    [
      {
        id: "root",
        component: "Grid",
        columns: 2,
        gap: "sm",
        children: { path: "/chips", componentId: "chip" },
      },
      {
        id: "chip",
        component: "DecisionChip",
        kind: { path: "kind" },
        subject: { path: "subject" },
        text: { path: "text" },
        openAction: {
          event: { name: "open_decision", context: { id: { path: "id" } } },
        },
      },
    ]
  ),
]

/** The host: answers each event by updating the surface's data. */
function respond(store: SurfaceStore, a: SurfaceAction) {
  const set = (path: string, value: unknown) =>
    store.process({
      version: v,
      updateDataModel: { surfaceId: a.surfaceId, path, value },
    })
  const data = store.get(a.surfaceId)?.data
  const id = a.context.id
  switch (a.name) {
    case "revert":
      return set("/incident/resolved", {
        label: "Blog",
        summary: `Reverted ${INCIDENT.culprit} · check green again`,
      })
    case "keep":
      return set("/incident/resolved", {
        label: "Blog",
        summary: "Kept v12 · investigating",
        declined: true,
      })
    case "check_again":
      if (getAt(data, "/tone") === "success")
        return set("/resolved", {
          label: "Blog",
          summary: "Healthy again · BLOG-4 back in build",
        })
      set("/tone", "success")
      set("/status", "Healthy")
      return set(
        "/steps",
        (getAt(data, "/steps") as { label: string }[]).map((s) => ({
          ...s,
          status: "done",
        }))
      )
    case "undo":
      return set(
        "/items",
        (getAt(data, "/items") as { id: string }[]).map((x) =>
          x.id === id ? { ...x, undone: true } : x
        )
      )
    case "toggle_rule":
      return set(
        "/rules",
        (getAt(data, "/rules") as { id: string }[]).map((x) =>
          x.id === id ? { ...x, on: a.context.on } : x
        )
      )
    case "approve_diff":
      return set("/resolved", {
        label: RISKY_DIFF.key,
        summary: "Approved · queued for integration",
      })
    case "return_diff":
      return set("/resolved", {
        label: RISKY_DIFF.key,
        summary: "Returned to build with your note",
        declined: true,
      })
    case "publish_preview":
      return set("/resolved", { label: "Store", summary: "Published" })
    case "request_changes":
      return set("/resolved", {
        label: "Store",
        summary: `Changes asked: “${String(a.context.note)}”`,
        declined: true,
      })
  }
}

function Case({
  store,
  id,
  label,
  note,
  onAction,
}: {
  store: SurfaceStore
  id: string
  label: string
  note: string
  onAction: (a: SurfaceAction) => void
}) {
  const s = useSurface(store, id)
  const [issues, setIssues] = React.useState<SurfaceIssue[]>([])
  const onIssue = React.useCallback(
    (i: SurfaceIssue) => setIssues((all) => [...all, i]),
    []
  )
  return (
    <Column label={label} note={note}>
      <Surface
        surface={s}
        catalog={uiaCatalog}
        actions={ACTIONS}
        size="sm"
        showIssues
        onAction={onAction}
        onIssue={onIssue}
      />
      {issues.map((i) => (
        <span
          key={i.componentId + i.code + i.message}
          className="eyebrow text-faint-foreground"
        >
          {i.code} · {i.message}
        </span>
      ))}
    </Column>
  )
}

function Column({
  label,
  note,
  children,
}: {
  label: string
  note: string
  children: React.ReactNode
}) {
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

export function Patterns() {
  const [store] = React.useState(() => createSurfaceStore(INITIAL))
  const [incident, setIncident] = React.useState<"open" | "reverted" | "kept">(
    "open"
  )
  const [diff, setDiff] = React.useState<"open" | "approved" | "returned">(
    "open"
  )
  const [last, setLast] = React.useState<SurfaceAction>()
  const onAction = (a: SurfaceAction) => {
    setLast(a)
    respond(store, a)
  }
  const cases: [string, string, string][] = [
    ["status", "StatusCard", "steps move on Check again, then it resolves"],
    ["status-failed", "StatusCard · destructive", "no actions"],
    [
      "activity",
      "ActivityList + ActivityItem",
      "undo reversible; merge is Final",
    ],
    ["policy", "PolicyList + Policy", "toggle_rule, context.on"],
    ["citation", "Citation", "with url, and without"],
    ["before-after", "BeforeAfter", "publish is destructive"],
    ["chips", "DecisionChip", "Grid of 2, openAction"],
  ]
  return (
    <div className="flex min-h-svh flex-col gap-10 px-4 py-12 sm:px-6">
      <span className="mx-auto eyebrow text-faint-foreground">
        {last ? `${last.name} ${JSON.stringify(last.context)}` : "no event yet"}
      </span>
      <div className="flex flex-wrap items-start justify-center gap-10">
        <Column label="A · hand-made" note="davinci IncidentCard">
          <IncidentCard
            incident={INCIDENT}
            state={incident}
            onDecide={(r) => setIncident(r ? "reverted" : "kept")}
          />
        </Column>
        <Case
          store={store}
          id="confirmation"
          label="Confirmation"
          note="the same incident, filled"
          onAction={onAction}
        />
      </div>
      <div className="flex flex-wrap items-start justify-center gap-10">
        <Column label="A · hand-made" note="davinci DiffCard">
          <DiffCard
            diff={RISKY_DIFF}
            state={diff}
            onDecide={(ok) => setDiff(ok ? "approved" : "returned")}
          />
        </Column>
        <Case
          store={store}
          id="diff"
          label="Diff"
          note="the same diff, filled"
          onAction={onAction}
        />
      </div>
      <div className="flex flex-wrap items-start justify-center gap-10">
        {cases.map(([id, label, note]) => (
          <Case
            key={id}
            store={store}
            id={id}
            label={label}
            note={note}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  )
}
