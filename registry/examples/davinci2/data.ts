import type { ModelFamily } from "@/components/ds/model-icons"
import type { StepStatus } from "@/components/ds/stepper"
import type { Option, Project } from "@/examples/davinci/data"

// davinci v2: the same factory, organised around what the owner actually
// needs: a queue of decisions (state, not messages), conversations per
// project, a place to look at state, a record of what was decided for him,
// and rules that turn repeated decisions into policy.

export type Urgency = "now" | "today" | "later"

export type QueueItem = {
  id: string
  project: Project
  /** The decision category, the unit a rule applies to. */
  category: string
  kind: "choice" | "incident" | "diff" | "preview"
  title: string
  context: string
  options?: Option[]
  pick?: string
  /** What happens with davinci's pick, in one line. */
  consequence: string
  reversible: boolean
  urgency: Urgency
  /** How often the owner went with davinci's pick in this category. */
  agreement?: { accepted: number; total: number }
}

export const QUEUE: QueueItem[] = [
  {
    id: "q-incident",
    project: "blog",
    category: "Production incident",
    kind: "incident",
    title: "Blog: RSS returns 500 since v12",
    context: "Bisect points at 3f2a1c (BLOG-4, feed dates). Pages are fine; feed readers fail.",
    consequence: "Revert 3f2a1c through full gates; BLOG-4 goes back to build with the failing case as a test.",
    reversible: true,
    urgency: "now",
  },
  {
    id: "q-preview",
    project: "blog",
    category: "Visual ok",
    kind: "preview",
    title: "BLOG-5 · Open Source page",
    context: "Repos as cards, most stars first; same card list as the tag pages. Gates and review passed.",
    consequence: "Promote to main; ships with the next wave.",
    reversible: true,
    urgency: "today",
  },
  {
    id: "q-diff",
    project: "bottega",
    category: "High-risk diff",
    kind: "diff",
    title: "T-583 · Chat client backend: session tokens",
    context: "Adds a session table and a login route; tokens expire after 30 days. Touches auth and a migration.",
    consequence: "Queue for integration; full gates run there.",
    reversible: false,
    urgency: "today",
  },
  {
    id: "q-plan",
    project: "blog",
    category: "Tweak plan",
    kind: "choice",
    title: "BLOG-6 · Reading time on posts",
    context: "Plan: one helper, one line in the post header. 18 lines expected, no new dependency.",
    options: [
      { id: "approve", label: "Approve the plan", hint: "build starts now" },
      { id: "hold", label: "Hold", hint: "after BLOG-5 ships" },
    ],
    pick: "approve",
    consequence: "Build starts now; you'll see it again only if a screen changes.",
    reversible: true,
    urgency: "today",
    agreement: { accepted: 14, total: 14 },
  },
  {
    id: "q-alerts",
    project: "bottega",
    category: "Setup",
    kind: "choice",
    title: "Phone channel for urgent alerts",
    context: "Today nothing reaches your phone outside the dashboard; it should ring only when something needs you.",
    options: [
      { id: "ntfy", label: "ntfy on the tailnet", hint: "nothing leaves the devbox" },
      { id: "telegram", label: "Telegram bot", hint: "messages go through Telegram" },
      { id: "email", label: "Email", hint: "slower, easy to miss" },
    ],
    pick: "ntfy",
    consequence: "Urgent items ring your phone through ntfy; everything else waits for the digest.",
    reversible: true,
    urgency: "later",
  },
  {
    id: "q-batch",
    project: "bottega",
    category: "Priority",
    kind: "choice",
    title: "Raise T-289 (batched integration) to high?",
    context: "Integration is serial: 6 tasks waited 41 min on average yesterday; batching would cut that to about 12.",
    options: [
      { id: "yes", label: "Yes, high", hint: "jumps the queue tonight" },
      { id: "no", label: "Keep normal", hint: "after the blog pilot" },
    ],
    pick: "yes",
    consequence: "T-289 starts tonight; two normal tasks wait one more slot.",
    reversible: true,
    urgency: "later",
    agreement: { accepted: 5, total: 7 },
  },
]

export type Rule = { id: string; category: string; text: string; applied: number }

export const RULES: Rule[] = [
  { id: "r-routine", category: "Low-risk diff", text: "Approve low-risk diffs that pass full gates", applied: 212 },
  { id: "r-promote", category: "Promotion", text: "Promote next → main after 20 quiet minutes", applied: 38 },
  { id: "r-quota", category: "Quota", text: "Route reviews to the family with more headroom", applied: 9 },
]

export type Decided = {
  id: string
  time: string
  project: Project
  what: string
  why: string
  rule?: string
  reversible: boolean
}

export const DECIDED: Decided[] = [
  { id: "a1", time: "08:58", project: "blog", what: "Promoted BLOG-4 (feed dates)", why: "20 quiet minutes on next", rule: "r-promote", reversible: true },
  { id: "a2", time: "08:40", project: "bottega", what: "Approved T-361 (capacity worker fix)", why: "Low risk, full gates green", rule: "r-routine", reversible: true },
  { id: "a3", time: "07:12", project: "bottega", what: "Answered T-361's question from the spec", why: "The spec says lanes reset at midnight UTC", reversible: true },
  { id: "a4", time: "03:40", project: "bottega", what: "Re-woke the operator after a lost session", why: "Item unanswered for 5 min", reversible: false },
  { id: "a5", time: "01:15", project: "bottega", what: "Moved reviews from Claude to Codex", why: "Claude week quota at 77%, runs tight by Monday", rule: "r-quota", reversible: true },
  { id: "a6", time: "23:20", project: "blog", what: "Retried BLOG-4 after a flaky e2e", why: "Same tree passed on the second runner", reversible: false },
  { id: "a7", time: "22:05", project: "bottega", what: "Split T-570 into 3 subtasks", why: "Plan exceeded 2× the size estimate", reversible: true },
]

export type ProjectState = {
  id: Project
  health: "ok" | "degraded"
  live: string
  tasks: { key: string; title: string; family: ModelFamily; stages: StepStatus[]; now: string }[]
}

export const STATE: ProjectState[] = [
  {
    id: "blog",
    health: "degraded",
    live: "v12 · RSS failing",
    tasks: [
      { key: "BLOG-5", title: "Open Source section", family: "openai", stages: ["done", "done", "done", "done", "waiting", "todo"], now: "Your eye" },
      { key: "BLOG-6", title: "Reading time on posts", family: "openai", stages: ["waiting", "todo", "todo", "todo", "todo", "todo"], now: "Plan waits" },
      { key: "BLOG-4", title: "Feed dates", family: "claude", stages: ["done", "done", "done", "done", "done", "failed"], now: "Culprit of the 500" },
    ],
  },
  {
    id: "bottega",
    health: "ok",
    live: "main 41 deliveries today",
    tasks: [
      { key: "T-583", title: "Chat client backend: sessions", family: "claude", stages: ["done", "done", "done", "waiting", "todo", "todo"], now: "High risk, waits" },
      { key: "T-289", title: "Batched integration", family: "openai", stages: ["todo", "todo", "todo", "todo", "todo", "todo"], now: "Queued (normal)" },
      { key: "T-413", title: "Event door", family: "claude", stages: ["done", "active", "todo", "todo", "todo", "todo"], now: "Building · 7 of 11" },
      { key: "T-343", title: "Tighten perf caps", family: "openai", stages: ["done", "done", "done", "done", "active", "todo"], now: "Integrating" },
    ],
  },
]

export const STAGES = ["Plan", "Build", "Gates", "Review", "Next", "Main"] as const

/* --------------------------- busy factory ---------------------------- */

// The same factory under load: dozens of tasks in flight at once. A
// simulation behind the side-nav switch (or `?busy`), to see the screens
// hold up. The inbox doesn't grow with it: davinci's job is to keep what
// reaches you to a handful, however much is running.

type Extra = [key: string, title: string, family: ModelFamily, at: number, status: StepStatus, now: string]

function extra([key, title, family, at, status, now]: Extra): ProjectState["tasks"][number] {
  return {
    key,
    title,
    family,
    now,
    stages: STAGES.map((_, i) => (i < at ? "done" : i === at ? status : "todo")),
  }
}

const BLOG_EXTRA: Extra[] = [
  ["BLOG-7", "Dark mode for code blocks", "claude", 1, "active", "Building · 2 of 4"],
  ["BLOG-8", "Sitemap with lastmod", "openai", 2, "active", "Running gates"],
  ["BLOG-9", "Draft posts behind a flag", "claude", 0, "active", "Planning"],
  ["BLOG-10", "Image sizes in the build", "openai", 3, "active", "In review · claude"],
  ["BLOG-11", "Search over post titles", "claude", 0, "todo", "Queued"],
  ["BLOG-12", "Footer links from config", "openai", 4, "active", "On next · 20 quiet min"],
]

const BOTTEGA_EXTRA: Extra[] = [
  ["T-414", "Event door: retries", "claude", 1, "active", "Building · 3 of 6"],
  ["T-415", "Event door: replay endpoint", "openai", 0, "active", "Planning"],
  ["T-420", "Lane caps per family", "claude", 2, "failed", "Gates failed · retrying"],
  ["T-421", "Digest: group by project", "openai", 3, "active", "In review · claude"],
  ["T-422", "Quota forecast to Monday", "claude", 1, "active", "Building · 1 of 3"],
  ["T-423", "Melzi: lost-session alarm", "openai", 2, "active", "Running gates"],
  ["T-424", "Spec diff in the plan step", "claude", 0, "active", "Planning"],
  ["T-425", "Review bounce reasons", "openai", 4, "active", "On next · 12 quiet min"],
  ["T-426", "Cost per delivered task", "claude", 3, "active", "In review · codex"],
  ["T-427", "Flaky e2e quarantine", "openai", 1, "active", "Building · 5 of 8"],
  ["T-428", "Merge queue metrics", "claude", 2, "active", "Running gates"],
  ["T-429", "Night run summary", "openai", 0, "todo", "Queued"],
  ["T-430", "Risk class from the diff", "claude", 1, "active", "Building · 2 of 5"],
  ["T-431", "Operator handoff notes", "openai", 4, "active", "On next · 4 quiet min"],
  ["T-432", "Per-project gates", "claude", 0, "todo", "Queued"],
  ["T-433", "Webhook signatures", "openai", 2, "active", "Running gates"],
  ["T-434", "Task search in the CLI", "claude", 3, "active", "In review · codex"],
  ["T-435", "Rebase before integrate", "openai", 1, "active", "Building · 4 of 4"],
  ["T-436", "Stale branch sweeper", "claude", 0, "todo", "Queued"],
  ["T-437", "Plan size estimates", "openai", 5, "active", "Promoting to main"],
  ["T-438", "Spend alerts by family", "claude", 1, "active", "Building · 1 of 2"],
  ["T-439", "Gate timings in the log", "openai", 2, "active", "Running gates"],
]

export const BUSY_STATE: ProjectState[] = STATE.map((p) => ({
  ...p,
  live: p.id === "blog" ? p.live : "main 112 deliveries today",
  tasks: [...p.tasks, ...(p.id === "blog" ? BLOG_EXTRA : BOTTEGA_EXTRA).map(extra)],
}))

/** "Since 21:00" for each load. */
export const SINCE = {
  calm: { shipped: 7, stuck: 1 },
  busy: { shipped: 64, stuck: 2 },
}
