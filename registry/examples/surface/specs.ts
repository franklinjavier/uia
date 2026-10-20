import type { SurfaceMessage } from "@/components/surface/types"
import { UIA_CATALOG_ID } from "@/components/catalog"

// What an agent sends to build a surface: A2UI v0.9 messages against the
// uia catalog. Data first, then the components (they stream in; each one
// renders as soon as it lands). Nothing here is React: it's what a model
// writes as a tool's input.

const v = "v0.9" as const

function surface(
  id: string,
  data: unknown,
  components: Record<string, unknown>[]
): SurfaceMessage[] {
  const chunks: SurfaceMessage[] = []
  for (let i = 0; i < components.length; i += 2) {
    chunks.push({
      version: v,
      updateComponents: {
        surfaceId: id,
        components: components.slice(i, i + 2) as never,
      },
    })
  }
  return [
    { version: v, createSurface: { surfaceId: id, catalogId: UIA_CATALOG_ID } },
    { version: v, updateDataModel: { surfaceId: id, path: "/", value: data } },
    ...chunks,
  ]
}

/* ------------------- "AI cost and quality this week" ------------------- */

export const costAndQuality = surface(
  "cost-quality",
  {
    spend: {
      total: 1287.05,
      budget: 1500,
      left: "$213 left · resets Nov 1",
      byModel: [
        { label: "Claude Opus", value: 584.2 },
        { label: "Claude Sonnet", value: 398.7 },
        { label: "GPT", value: 182.6 },
        { label: "Gemini", value: 91.15 },
        { label: "Llama", value: 30.4 },
      ],
      daily: [38, 41, 44, 39, 52, 61, 58, 47, 49, 66, 71, 64, 69, 73].map(
        (value, i) => ({ label: `Oct ${6 + i}`, value })
      ),
    },
    quality: {
      pass: 0.876,
      delta: 0.023,
      trend: [0.82, 0.83, 0.835, 0.84, 0.851, 0.849, 0.858, 0.862, 0.87, 0.876],
      suites: [
        { name: "Reasoning", meta: "1,240 cases", pass: 0.912 },
        { name: "Code", meta: "980 cases", pass: 0.847 },
        { name: "Safety", meta: "620 cases", pass: 0.974 },
        { name: "Extraction", meta: "1,150 cases", pass: 0.889 },
      ],
    },
  },
  [
    {
      id: "root",
      component: "Grid",
      columns: 2,
      children: ["spend", "quality", "daily", "decision"],
    },
    {
      id: "spend",
      component: "Section",
      title: "Spend",
      description: "October, by model",
      children: ["spent", "meter", "spendNote"],
    },
    {
      id: "spent",
      component: "Stat",
      label: "Spent",
      value: { path: "/spend/total" },
      format: "currency",
      unit: "/ $1,500",
      meta: { path: "/spend/left" },
    },
    {
      id: "meter",
      component: "Meter",
      segments: { path: "/spend/byModel" },
      max: { path: "/spend/budget" },
      format: "currency",
      markers: [
        { value: 1200, label: "80%" },
        { value: 1500, label: "Budget" },
      ],
    },
    {
      id: "spendNote",
      component: "Note",
      tone: "warning",
      badge: "86% used",
      text: "At this pace the budget runs out around Oct 23.",
    },
    {
      id: "quality",
      component: "Section",
      title: "Quality",
      description: "Pass rate across eval suites",
      children: ["pass", "trend", "suites"],
    },
    {
      id: "pass",
      component: "Stat",
      label: "Pass rate",
      value: { path: "/quality/pass" },
      format: "percent",
      delta: { path: "/quality/delta" },
      meta: "vs last week · target 90%",
    },
    {
      id: "trend",
      component: "Sparkline",
      values: { path: "/quality/trend" },
      label: "Last 10 runs",
    },
    {
      id: "suites",
      component: "List",
      children: { path: "/quality/suites", componentId: "suite" },
    },
    {
      id: "suite",
      component: "KeyValue",
      label: { path: "name" },
      meta: { path: "meta" },
      value: { path: "pass" },
      format: "percent",
    },
    {
      id: "daily",
      component: "Section",
      span: 2,
      title: "Daily cost",
      children: ["dailyBars"],
    },
    {
      id: "dailyBars",
      component: "BarSeries",
      data: { path: "/spend/daily" },
      format: "currency",
    },
    {
      id: "decision",
      component: "DecisionCard",
      span: 2,
      agent: "the agent",
      eyebrow: "Spend · Routing",
      title: "Move code reviews from Opus to Sonnet?",
      context:
        "Reviews are 41% of Opus spend. Sonnet passes the Code suite at 84.7% vs 85.1% on Opus.",
      consequence: "About $230 less this month; the budget holds.",
      actions: [
        {
          label: "Move reviews",
          action: {
            event: { name: "route_reviews", context: { to: "sonnet" } },
          },
        },
        {
          label: "Keep Opus",
          kind: "secondary",
          action: { event: { name: "route_reviews", context: { to: "opus" } } },
        },
      ],
    },
  ]
)

/* -------------------------- "What's going on with checkout?" -------------------------- */

export const incident = surface(
  "incident",
  {
    errors: 0.042,
    errorsDelta: 3.2,
    p95: 1840,
    users: 1290,
    timeline: [
      { at: "14:02", event: "Deploy v42 to checkout-api", by: "ci" },
      { at: "14:06", event: "5xx rate crosses 2%", by: "monitor" },
      { at: "14:09", event: "Payments provider timeouts", by: "logs" },
      { at: "14:11", event: "Paged on-call (Ana)", by: "pager" },
    ],
    plan: [
      { label: "Freeze deploys on checkout", status: "done" },
      { label: "Roll back checkout-api to v41", status: "waiting" },
      { label: "Verify 5xx under 0.5%", status: "todo" },
      { label: "Post a status update", status: "todo" },
    ],
  },
  [
    {
      id: "root",
      component: "Column",
      gap: "lg",
      children: ["note", "stats", "grid"],
    },
    {
      id: "note",
      component: "Note",
      tone: "destructive",
      badge: "Incident",
      text: "Checkout errors since the 14:02 deploy; payments are timing out.",
    },
    {
      id: "stats",
      component: "Grid",
      columns: 3,
      gap: "md",
      children: ["errors", "p95", "users"],
    },
    {
      id: "errors",
      component: "Stat",
      size: "sm",
      label: "5xx rate",
      value: { path: "/errors" },
      format: "percent",
      delta: { path: "/errorsDelta" },
      deltaIsGood: "down",
    },
    {
      id: "p95",
      component: "Stat",
      size: "sm",
      label: "p95 latency",
      value: { path: "/p95" },
      unit: "ms",
      format: "integer",
    },
    {
      id: "users",
      component: "Stat",
      size: "sm",
      label: "Checkouts failed",
      value: { path: "/users" },
      format: "integer",
      meta: "since 14:02",
    },
    {
      id: "grid",
      component: "Grid",
      columns: 2,
      children: ["timelineSection", "planSection"],
    },
    {
      id: "timelineSection",
      component: "Section",
      title: "Timeline",
      children: ["timeline"],
    },
    {
      id: "timeline",
      component: "Table",
      columns: [
        { key: "at", label: "Time" },
        { key: "event", label: "Event" },
        { key: "by", label: "Source", align: "end" },
      ],
      rows: { path: "/timeline" },
    },
    { id: "planSection", component: "Column", children: ["plan", "confirm"] },
    {
      id: "plan",
      component: "Plan",
      title: "Mitigation",
      steps: { path: "/plan" },
    },
    {
      id: "confirm",
      component: "Confirm",
      title: "Roll back checkout-api to v41?",
      description:
        "Takes about 2 minutes; v42's payment retry change is reverted with it.",
      confirmLabel: "Roll back to v41",
      cancelLabel: "Investigate first",
      action: {
        event: {
          name: "rollback",
          context: { service: "checkout-api", to: "v41" },
        },
      },
      cancelAction: { event: { name: "investigate" } },
    },
  ]
)

export const INTENTS = {
  cost: { label: "AI cost and quality this week", messages: costAndQuality },
  incident: { label: "What's going on with checkout?", messages: incident },
} as const

export type IntentKey = keyof typeof INTENTS
