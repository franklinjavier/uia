import type { ModelFamily } from "@/components/ds/model-icons"

// The davinci example's world: the Bottega factory seen from one chat.
// Projects, the owner's pending decisions, a live task, an incident, a
// high-risk diff and the quota. All fiction, shaped after the Bottega API.

export const PROJECTS = { bottega: "bottega", blog: "blog" } as const
export type Project = keyof typeof PROJECTS

/** The factory flow a task card shows, in the project's own words. */
export const FLOW = ["Plan", "Build", "Gates", "Review", "Next", "Main"] as const

export type Option = { id: string; label: string; hint: string }

export type Decision = {
  id: string
  project: Project
  kind: "decision"
  question: string
  context: string[]
  options: Option[]
  /** davinci's pick. */
  pick: string
}

export const MORNING_DECISIONS: Decision[] = [
  {
    id: "d-alerts",
    project: "bottega",
    kind: "decision",
    question: "Phone channel for urgent alerts",
    context: ["Today nothing reaches your phone outside the dashboard.", "It should ring only when something needs you."],
    options: [
      { id: "ntfy", label: "ntfy on the tailnet", hint: "nothing leaves the devbox" },
      { id: "telegram", label: "Telegram bot", hint: "messages go through Telegram" },
      { id: "email", label: "Email", hint: "slower, easy to miss" },
    ],
    pick: "ntfy",
  },
  {
    id: "d-batch",
    project: "bottega",
    kind: "decision",
    question: "Raise T-289 (batched integration) to high?",
    context: ["Integration is serial: 6 tasks waited 41 min on average yesterday.", "Batching would cut that to about 12 min."],
    options: [
      { id: "yes", label: "Yes, high", hint: "jumps the queue tonight" },
      { id: "no", label: "Keep normal", hint: "after the blog pilot" },
    ],
    pick: "yes",
  },
]

export type Diff = {
  id: string
  project: Project
  key: string
  title: string
  summary: string[]
  risky: { file: string; lines: string[] }[]
}

export const RISKY_DIFF: Diff = {
  id: "x-583",
  project: "bottega",
  key: "T-583",
  title: "Chat client backend: session tokens",
  summary: [
    "Adds a session table and a login route for the chat client.",
    "Tokens expire after 30 days; logout revokes them.",
    "Touches auth and a migration, so it needs you.",
  ],
  risky: [
    {
      file: "db/migrations/0042_sessions.sql",
      lines: ["+ create table sessions (", "+   token_hash text primary key,", "+   expires_at integer not null", "+ );"],
    },
    {
      file: "src/auth/session.ts",
      lines: ["- const ttl = Infinity", "+ const ttl = 30 * DAY", "+ if (row.expires_at < now()) return null"],
    },
  ],
}

export type Incident = {
  id: string
  project: Project
  title: string
  bisect: string
  culprit: string
}

export const INCIDENT: Incident = {
  id: "i-blog",
  project: "blog",
  title: "Blog: production check failed after v12",
  bisect: "Bisect points at 3f2a1c (BLOG-4, feed dates): the RSS page returns 500.",
  culprit: "3f2a1c",
}

export type Step = { day: string; time: string; text: string; took?: string }

export type Task = {
  key: string
  project: Project
  title: string
  family: ModelFamily
  /** Index in FLOW of the current stage. */
  stage: number
  state: "working" | "waiting" | "done"
  now: string
  path: Step[]
}

export const NEW_TASK: Task = {
  key: "BLOG-5",
  project: "blog",
  title: "Open Source section sorted by stars",
  family: "openai",
  stage: 0,
  state: "working",
  now: "Planning",
  path: [{ day: "Today", time: "09:14", text: "Created from the conversation" }],
}

/** How BLOG-5 moves, one step every few seconds. */
export const NEW_TASK_SCRIPT: { stage: number; now: string; step: Step; state?: Task["state"] }[] = [
  { stage: 1, now: "Building · 3 files", step: { day: "Today", time: "09:15", text: "Plan written: 1 page, 1 query, reuse the card list", took: "48 s" } },
  { stage: 2, now: "Running gates", step: { day: "Today", time: "09:23", text: "Built and committed", took: "7 min" } },
  { stage: 3, now: "In review · codex", step: { day: "Today", time: "09:24", text: "Gates passed: typecheck, 214 tests, perf caps", took: "52 s" } },
  { stage: 4, now: "On next · needs your visual ok", state: "waiting", step: { day: "Today", time: "09:27", text: "Review clean; screen changed, so it waits for your eye", took: "3 min" } },
]

export const ROUTINE = [
  "T-343 tighten perf caps · auto-approved",
  "T-356 clean review after a bounce · auto-approved",
  "T-359 escaped-defect ledger · auto-approved",
  "T-361 capacity worker fix · auto-approved",
  "BLOG-3 tag pages · promoted",
  "BLOG-4 feed dates · promoted",
  "T-354 three cost readings · promoted",
  "T-357 subscription costs in config · promoted",
  "T-355 digest task titles · promoted",
  "T-350 recalibrated risk classes · promoted",
  "T-353 token and list-price costs · promoted",
  "T-342 status under 300 ms · promoted",
]

export const QUOTA = [
  { family: "claude" as ModelFamily, name: "Claude", window: "week", used: 77, projected: 94, resets: "Mon 09:00", verdict: "Tight" as const },
  { family: "openai" as ModelFamily, name: "Codex", window: "week", used: 41, projected: 63, resets: "Sun 22:00", verdict: "On track" as const },
]

/** Tasks running per half hour last night (19:00 → 09:00). */
export const NIGHT = [3, 3, 2, 3, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 2, 3, 2, 3]
