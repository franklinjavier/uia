import type { UIMessage } from "ai"

import { createChat } from "@/lib/ai"
import type { Question } from "@/components/parts/ask-user"
import type { Draft } from "@/components/parts/draft-card"
import type { Finding } from "@/components/parts/findings"
import type { PlanStep } from "@/components/parts/plan"
import type { BarDatum } from "@/components/ds/bar-series"
import type { AiSpendModel, AiSpendPeriod } from "@/components/blocks/ai-spend"
import { BUDGET, MODELS as SPEND_MODELS, PERIODS } from "@/examples/ai-spend"
import type { MergeConflictsProps } from "@/components/blocks/merge-conflicts"
import { PULL_REQUEST } from "@/examples/merge-conflicts"
import type { SurfaceMessage } from "@/components/surface/types"
import { UIA_CATALOG_ID } from "@/components/catalog"

// Typed parts shared by the scripts and the renderer.
type Tools = {
  webSearch: {
    input: { query: string }
    output: { results: { title: string; url: string }[] }
  }
  askQuestions: {
    input: { questions: Question[] }
    output: { answers: Record<string, string> }
  }
  composeDraft: {
    input: Draft
    output: { status: "sent" | "discarded"; body?: string }
  }
  createIssues: {
    input: { tracker: string; issues: { title: string; owner: string }[] }
    output: { ids: string[] }
  }
  queryAnalytics: {
    input: { metric: string; range: string }
    output: { title: string; series: BarDatum[]; total: number; change: number; median: number; peak: number }
  }
  connectApp: {
    input: { app: "Slack"; reason: string; done: string }
    output: { connected: boolean }
  }
  renderUI: {
    input: { messages: SurfaceMessage[] }
    output: { name: string; context: Record<string, unknown> }
  }
  reportSpend: {
    input: { period: string }
    output: { models: AiSpendModel[]; periods: AiSpendPeriod[]; budget: number }
  }
  mergePullRequest: {
    input: Omit<MergeConflictsProps, "state" | "resolved" | "onResolve" | "onMerge" | "size" | "className">
    output: { merged: boolean }
  }
  readFile: {
    input: { name: string; pages: number }
    output: { title: string; findings: Finding[] }
  }
}
type Data = {
  plan: { title: string; steps: PlanStep[] }
}
export type ChatMessage = UIMessage<unknown, Data, Tools>

/* ---------------- Research: search → answer → sources ---------------- */

const research = createChat<ChatMessage>()
  .user("What shipped in the last Halden release?")
  .sleep(400)
  .assistant(({ writer }) => {
    writer.reasoning(
      "They want a summary of the latest release. I should read the changelog and the launch post, then group changes by impact."
    )
    writer.sleep(300)
    writer
      .tool("webSearch", { input: { query: "Halden 4.2 release notes" } })
      .sleep(1400)
      .output({
        results: [
          { title: "Halden 4.2 changelog", url: "https://halden.example/changelog/4-2" },
          { title: "Per-seat policies, explained", url: "https://blog.halden.example/per-seat-policies" },
          { title: "Audit log API reference", url: "https://docs.halden.example/api/audit-log" },
          { title: "API key rotation notice", url: "https://status.halden.example/notices/key-rotation" },
          { title: "Halden 4.1 changelog", url: "https://halden.example/changelog/4-1" },
          { title: "Roadmap: what's next after 4.2", url: "https://blog.halden.example/roadmap" },
        ],
      })
    writer.text(
      "Halden **4.2** is mostly about speed and control:\n\n- **Streaming exports.** Large CSV exports now stream instead of timing out, up to 2M rows.\n- **Per-seat policies.** Admins can set model and spend limits for each seat, not just per workspace.\n- **Audit log API.** Every policy change is now queryable, with a 400-day retention window.\n\nNothing is breaking. The only migration step is re-issuing API keys created before March, which now expire on rotation."
    )
    writer.sourceUrl({ sourceId: "s1", title: "Halden 4.2 changelog", url: "https://halden.example/changelog/4-2" })
    writer.sourceUrl({ sourceId: "s2", title: "Per-seat policies, explained", url: "https://blog.halden.example/per-seat-policies" })
    writer.sourceUrl({ sourceId: "s3", title: "Audit log API reference", url: "https://docs.halden.example/api/audit-log" })
    writer.sourceUrl({ sourceId: "s4", title: "API key rotation notice", url: "https://status.halden.example/notices/key-rotation" })
  })
  .user("Turn that into a checklist for the team")
  .sleep(400)
  .assistant(
    "| Owner | Task | When |\n| --- | --- | --- |\n| Platform | Re-issue pre-March API keys | Before rotation |\n| Admins | Set per-seat model limits | This sprint |\n| Data | Switch nightly export to streaming | Next deploy |\n| Security | Point SIEM at the audit log API | This month |\n\nWant me to turn these into tickets?"
  )
  .user("Yes, create the tickets")
  .sleep(400)
  .assistant(({ writer }) => {
    writer.text("Here are the four issues. I need your OK before I create them.")
    writer.tool("createIssues", {
      input: {
        tracker: "Linear",
        issues: [
          { title: "Re-issue pre-March API keys", owner: "Platform" },
          { title: "Set per-seat model limits", owner: "Admins" },
          { title: "Switch nightly export to streaming", owner: "Data" },
          { title: "Point SIEM at the audit log API", owner: "Security" },
        ],
      },
      needsApproval: true,
      output: { ids: ["HAL-201", "HAL-202", "HAL-203", "HAL-204"] },
    })
  })
  .assistant(({ writer, toolCall }) => {
    writer.sleep(300)
    writer.text(
      toolCall?.approved
        ? "Done. Each issue is assigned to its owner and linked back to this thread."
        : "Okay, I didn't create anything. The checklist is still above."
    )
  })

/* ------------- Draft: clarify → editable draft → send ------------- */

// The helper resolves a continuation by the id of the last scripted message
// it can find in the transcript, but continuations stream into the paused
// message (same id). A continuation that pauses again therefore needs its
// own id in the transcript; the playground renames the merged message to
// this id once it finishes (see useChainedContinuation). Real backends
// don't need this.
export const CHAINED_CONTINUATION_ID = "draft-reply"

const QUESTIONS: Question[] = [
  { id: "channel", question: "Which channel is this for?", choices: ["Email", "Blog post", "Social thread"] },
  { id: "tone", question: "What tone should it have?", choices: ["Friendly", "Formal", "Punchy"] },
]

type Channel = "Email" | "Blog post" | "Social thread"

const OPENERS: Record<string, string> = {
  Friendly: "Good news:",
  Formal: "We are pleased to announce that",
  Punchy: "It's here.",
}

// One draft per channel: its own fields, verbs and closing line. Tone only
// changes the opener, which is enough for a scripted demo.
function draftFor(channel: Channel, tone: string): Draft & { intro: string; done: string } {
  const open = OPENERS[tone] ?? OPENERS.Friendly
  if (channel === "Social thread") {
    return {
      kind: "New thread",
      app: "X",
      icon: "thread",
      title: "Launch thread",
      fields: [
        { label: "Account", value: "@halden-demo" },
        { label: "Network", value: "X" },
        { label: "Posts", value: "3" },
      ],
      summary: "@halden-demo · 3 posts",
      body: `1/ ${open} the new Halden dashboard is live.\n\n2/ Monitors, usage and spend on one screen. Loads twice as fast. Finally works on mobile.\n\n3/ Nothing changes about your data or alerts. Open it from the sidebar today.`,
      sendLabel: "Post thread",
      sentVerb: "Posted thread",
      intro: `Here is a ${tone.toLowerCase()} three-post thread for @halden-demo. Edit anything in place, then post it when it reads right.`,
      done: "Posted the thread from @halden-demo.",
    }
  }
  if (channel === "Blog post") {
    return {
      kind: "New blog post",
      app: "Blog",
      icon: "blog",
      title: "Meet the new dashboard",
      fields: [
        { label: "Blog", value: "blog.halden.example" },
        { label: "Title", value: "Meet the new dashboard" },
        { label: "Visibility", value: "Public" },
      ],
      summary: "blog.halden.example/new-dashboard",
      body: `${open} the new dashboard is live for every workspace.\n\nMonitors, usage and spend now share one screen, it loads twice as fast, and it finally works on mobile. Nothing changes about your data or alerts.\n\nOpen it from the sidebar and tell us what you think.`,
      sendLabel: "Publish post",
      sentVerb: "Published post",
      intro: `Here is a ${tone.toLowerCase()} blog post. Edit anything in place, then publish it when it reads right.`,
      done: "Published at blog.halden.example/new-dashboard.",
    }
  }
  return {
    kind: "New email",
    app: "Mail",
    icon: "mail",
    title: "Your new dashboard is live",
    fields: [
      { label: "From", value: "product@halden.example" },
      { label: "To", value: "Beta list · 1,284 people" },
      { label: "Subject", value: "Your new dashboard is live" },
    ],
    summary: "Beta list · 1,284 people",
    body: `Hi there,\n\n${open} the new dashboard is live. It brings your monitors, usage and spend onto one screen, loads twice as fast, and finally works on mobile.\n\nNothing changes about your data or alerts. Reply to this email if anything looks off. We read every message.\n\nThe Halden team`,
    sendLabel: "Send email",
    sentVerb: "Sent email",
    intro: `Here is a ${tone.toLowerCase()} email for the beta list. Edit anything in place, then send it when it reads right.`,
    done: "Sent to 1,284 people. Replies land in the product inbox.",
  }
}

const draft = createChat<ChatMessage>()
  .user("Draft a launch announcement for the new dashboard")
  .sleep(400)
  .assistant(({ writer }) => {
    writer.reasoning(
      "An announcement depends on the channel and the tone. Two questions now are cheaper than a rewrite later."
    )
    writer.sleep(300)
    writer.text("Two quick questions so I match the tone and length.")
    writer.tool("askQuestions", { input: { questions: QUESTIONS } })
  })
  .assistant(
    ({ writer, toolCall }) => {
      const answers =
        toolCall?.name === "askQuestions" ? toolCall.output?.answers : undefined
      // Respect the answer: an unknown or skipped channel falls back to email.
      const channel = (["Email", "Blog post", "Social thread"] as const).find(
        (c) => c === answers?.channel
      ) ?? "Email"
      const { intro, ...draft } = draftFor(channel, answers?.tone || "Friendly")
      writer.sleep(400)
      writer.text(intro)
      // `done` rides along in the input; the card ignores unknown keys.
      writer.tool("composeDraft", { input: draft })
    },
    { id: CHAINED_CONTINUATION_ID }
  )
  .assistant(({ writer, toolCall }) => {
    const draft = toolCall?.name === "composeDraft" ? toolCall.input : undefined
    const sent = toolCall?.name === "composeDraft" && toolCall.output?.status === "sent"
    const done = (draft as { done?: string } | undefined)?.done
    writer.sleep(300)
    writer.text(sent && done ? done : "Discarded. Nothing went out.")
  })

/* ------------------------------ Code ------------------------------ */

const DEBOUNCE_QUESTION: Question[] = [
  {
    id: "edge",
    question: "Which version do you want?",
    choices: ["Trailing (classic)", "Leading and trailing", "With a cancel() handle"],
  },
]

const code = createChat<ChatMessage>()
  .user("Write a React hook that debounces a value")
  .sleep(400)
  .assistant(({ writer }) => {
    writer.reasoning("There are a few common shapes for this hook. One question settles which one.")
    writer.sleep(200)
    writer.tool("askQuestions", { input: { questions: DEBOUNCE_QUESTION } })
  })
  .assistant(({ writer, toolCall }) => {
    const pick =
      (toolCall?.name === "askQuestions" && toolCall.output?.answers.edge) || "Trailing (classic)"
    writer.sleep(300)
    writer.text(
      `Here is the “${pick}” version, small and dependency-free. It re-arms on every change and cancels the pending timer on unmount.\n\n\`\`\`ts\nimport { useEffect, useState } from "react"\n\nexport function useDebounce<T>(value: T, delay = 300): T {\n  const [debounced, setDebounced] = useState(value)\n\n  useEffect(() => {\n    // re-arm on every change; cancel on unmount\n    const id = window.setTimeout(() => setDebounced(value), delay)\n    return () => window.clearTimeout(id)\n  }, [value, delay])\n\n  return debounced\n}\n\`\`\`\n\nPair it with a controlled input and pass the debounced value to your fetch.`
    )
  })

/* ------- Metrics: chart → plan → connect an app → error and retry ------- */

const WEEKS: BarDatum[] = [812, 845, 790, 868, 902, 880, 931, 958, 1001, 1012, 1048, 1110, 1244].map((value, i) => ({
  label: `W${27 + i}`,
  value,
}))

const DIGEST_STEPS = [
  "Create saved query for the three metrics",
  "Schedule for Mondays at 09:00",
  "Render the chart as an image",
  "Post to #product via Slack",
]

const steps = (done: number, last: PlanStep["status"] = "running"): PlanStep[] =>
  DIGEST_STEPS.map((label, i) => ({ label, status: i < done ? "done" : i === done ? last : "todo" }))

const metrics = createChat<ChatMessage>()
  .user("How did weekly signups trend this quarter?")
  .sleep(400)
  .assistant(({ writer }) => {
    writer.reasoning("Weekly signups for Q3, from the product analytics warehouse. A bar per week shows the trend and the outlier.")
    writer.sleep(200)
    writer
      .tool("queryAnalytics", { input: { metric: "signups", range: "Q3 by week" } })
      .sleep(1100)
      .output({ title: "Weekly signups", series: WEEKS, total: 13009, change: 0.532, median: 931, peak: 1244 })
    writer.text(
      "Signups grew steadily through the quarter, finishing **53% above** the first week. The only dips were W29 and W32, both summer weeks."
    )
  })
  .user("Set up a weekly digest of these metrics for the team")
  .sleep(400)
  .assistant(({ writer }) => {
    writer.reasoning("Four steps: a saved query, a schedule, a rendered chart, and a post. Posting needs Slack, which isn't connected.")
    writer.sleep(200)
    writer.text("I'll schedule a Monday 09:00 digest with signups, activation and open incidents.")
    const plan = (s: PlanStep[]) => writer.data({ type: "data-plan", id: "digest", data: { title: "Weekly metrics digest", steps: s } })
    plan(steps(0)).sleep(900)
    plan(steps(1)).sleep(800)
    plan(steps(2)).sleep(900)
    plan(steps(3, "waiting"))
    writer.tool("connectApp", {
      input: {
        app: "Slack",
        reason: "Connect Slack to post the digest",
        done: "Slack connected · first digest Monday 09:00",
      },
    })
  })
  .assistant(({ writer, toolCall }) => {
    const connected = toolCall?.name === "connectApp" && toolCall.output?.connected
    const plan = (s: PlanStep[]) => writer.data({ type: "data-plan", id: "digest", data: { title: "Weekly metrics digest", steps: s } })
    if (!connected) {
      plan(steps(3, "failed"))
      writer.text("Okay, I left Slack out. The digest is scheduled; it just won't post until Slack is connected.")
      return
    }
    plan(steps(3, "running")).sleep(900)
    plan(steps(4))
    writer.text("Done. The first digest goes out **Monday at 09:00** in #product.")
  })
  .user("Translate the digest into German and Japanese")
  .sleep(500)
  .assistant(({ writer }) => {
    writer.sleep(300)
    writer.text(
      "Done: both translations are attached to the digest as alternate versions. German keeps the numbers in the original format; Japanese uses full-width digits to match the team's convention."
    )
  })

/* --------------- Deck: attachment → read → findings --------------- */

export const FILES = {
  "q3-board-deck.pdf": {
    meta: "PDF · 4.2 MB · 24 pages",
    summary:
      "Q3 board review: revenue up 14% QoQ on enterprise expansion, gross margin steady at 71%. Hiring paused in support; two enterprise renewals slipped to Q4.",
  },
} as const

const deck = createChat<ChatMessage>()
  .user("Summarize the risks flagged in this deck", {
    files: [{ mediaType: "application/pdf", filename: "q3-board-deck.pdf", url: "https://files.halden.example/q3-board-deck.pdf" }],
  })
  .sleep(400)
  .assistant(({ writer }) => {
    writer.reasoning("Read the deck, pull every risk with its page, rank by revenue impact.")
    writer.sleep(200)
    writer
      .tool("readFile", { input: { name: "q3-board-deck.pdf", pages: 24 } })
      .sleep(1500)
      .output({
        title: "Risks in q3-board-deck.pdf",
        findings: [
          { text: "Two enterprise renewals slipped to Q4 (≈ $410k ARR)", severity: "high", ref: "P. 12" },
          { text: "Support hiring paused while ticket volume is up 22%", severity: "high", ref: "P. 15" },
          { text: "EU data residency asked for by three prospects", severity: "medium", ref: "P. 18" },
          { text: "Infra cost per seat up 6% after region expansion", severity: "medium", ref: "P. 20" },
          { text: "SOC 2 renewal audit lands in the same month as launch", severity: "low", ref: "P. 23" },
        ],
      })
    writer.text("The deck flags five risks. Two are rated high and both relate to Q4 renewals, so I'd start there.")
  })

/* ---- Spend: the agent answers with the dashboard's own widget ---- */

const spend = createChat<ChatMessage>()
  .user("How's our AI spend this month?")
  .sleep(400)
  .assistant(({ writer }) => {
    writer.reasoning("Pull October's usage by model against the $1,500 budget; the spend widget shows it the way the dashboard does.")
    writer.sleep(200)
    writer
      .tool("reportSpend", { input: { period: "October 2026" } })
      .sleep(1000)
      .output({ models: SPEND_MODELS, periods: PERIODS.slice(0, 1), budget: BUDGET })
    writer.text(
      "You're at **86%** of the budget with 12 days left. Claude Opus is almost half of it; moving routine reviews to Sonnet would keep the month under $1,500."
    )
  })

/* ---- Merge: the base moved on; resolve in the reply, then merge ---- */

const merge = createChat<ChatMessage>()
  .user("Merge my session refresh PR")
  .sleep(400)
  .assistant(({ writer }) => {
    writer.reasoning(
      "PR #128 is behind main. Lena's key rotation landed 6 minutes ago and changed the same lines this branch changes in auth.ts and middleware.ts, so it can't merge as is."
    )
    writer.sleep(200)
    writer.text(
      "PR **#128** is open, but main moved on while we worked: Lena's session key rotation changed the same lines in `auth.ts` and `middleware.ts`. I can merge main in and resolve them."
    )
    writer.tool("mergePullRequest", { input: PULL_REQUEST })
  })
  .assistant(({ writer, toolCall }) => {
    const merged = toolCall?.name === "mergePullRequest" && toolCall.output?.merged
    writer.sleep(300)
    writer.text(
      merged
        ? "Merged **#128** into main. Both changes made it: sessions are verified with Lena's rotated keys and still refresh near expiry."
        : "Okay, I left #128 as it is. Nothing was pushed."
    )
  })

/* ---- Compose: the agent builds a screen for this question (A2UI) ---- */

const REVIEW_UI: SurfaceMessage[] = [
  { version: "v0.9", createSurface: { surfaceId: "reviews", catalogId: UIA_CATALOG_ID } },
  {
    version: "v0.9",
    updateDataModel: {
      surfaceId: "reviews",
      path: "/",
      value: {
        models: [
          { model: "Claude Opus", pass: 0.851, p95: 9.4, cost: 0.42 },
          { model: "Claude Sonnet", pass: 0.847, p95: 4.1, cost: 0.09 },
          { model: "GPT", pass: 0.812, p95: 5.2, cost: 0.11 },
        ],
      },
    },
  },
  {
    version: "v0.9",
    updateComponents: {
      surfaceId: "reviews",
      components: [
        { id: "root", component: "Section", title: "Code reviews, last 30 days", description: "1,284 reviews · Code suite", children: ["table", "note", "actions"] },
        {
          id: "table",
          component: "Table",
          columns: [
            { key: "model", label: "Model" },
            { key: "pass", label: "Pass", align: "end", format: "percent" },
            { key: "p95", label: "p95", align: "end", format: "duration" },
            { key: "cost", label: "$ / review", align: "end", format: "currency" },
          ],
          rows: { path: "/models" },
        },
        { id: "note", component: "Note", tone: "success", badge: "−79% cost", text: "Sonnet is 0.4 points behind Opus on the Code suite at a fifth of the price." },
        { id: "actions", component: "Row", children: ["route", "keep"] },
        { id: "route", component: "Button", label: "Route reviews to Sonnet", action: { event: { name: "route_reviews", context: { to: "sonnet" } } } },
        { id: "keep", component: "Button", label: "Keep Opus", variant: "secondary", action: { event: { name: "route_reviews", context: { to: "opus" } } } },
      ],
    },
  },
]

const compose = createChat<ChatMessage>()
  .user("Which model should handle code reviews?")
  .sleep(400)
  .assistant(({ writer }) => {
    writer.reasoning("Compare the three models on the Code suite: pass rate, latency and cost per review. A small table and the two real options.")
    writer.sleep(200)
    writer.text("Here's how they compare on our reviews.")
    writer.tool("renderUI", { input: { messages: REVIEW_UI } })
  })
  .assistant(({ writer, toolCall }) => {
    const to = toolCall?.name === "renderUI" ? toolCall.output?.context?.to : undefined
    writer.sleep(300)
    writer.text(
      to === "sonnet"
        ? "Done. Reviews go to **Sonnet** from the next run; I'll watch the Code suite and tell you if the pass rate drops below 84%."
        : "Okay, reviews stay on **Opus**."
    )
  })

export const SCENARIOS = {
  metrics: { label: "How did weekly signups trend?", icon: "chart", turns: 3, chat: metrics },
  draft: { label: "Draft a launch announcement", icon: "pen", turns: 1, chat: draft },
  code: { label: "Write a debounce hook", icon: "code", turns: 1, chat: code },
  research: { label: "What shipped in the last release?", icon: "globe", turns: 3, chat: research },
  deck: { label: "Summarize the risks in a deck", icon: "file", turns: 1, chat: deck },
  spend: { label: "How's our AI spend this month?", icon: "chart", turns: 1, chat: spend },
  compose: { label: "Which model should handle code reviews?", icon: "code", turns: 1, chat: compose },
  merge: { label: "Merge my session refresh PR", icon: "merge", turns: 1, chat: merge },
} as const

export type ScenarioKey = keyof typeof SCENARIOS

export const transports = Object.fromEntries(
  Object.entries(SCENARIOS).map(([key, s]) => [key, s.chat.transport({ delayMs: 22 })])
) as Record<ScenarioKey, ReturnType<typeof research.transport>>

/**
 * The first request for a message containing `match` fails like an
 * overloaded provider would; the retry goes through. Lives in the transport
 * (not the script) so `regenerate()` behaves as it does against a real API.
 */
export function failOnce<T extends { sendMessages: (o: never) => Promise<unknown> }>(
  transport: T,
  match: string,
  message: string
): T {
  let failed = false
  return {
    ...transport,
    sendMessages: async (options: { messages: ChatMessage[] }) => {
      const last = options.messages.findLast((m) => m.role === "user")
      const text = last?.parts.map((p) => (p.type === "text" ? p.text : "")).join("") ?? ""
      if (!failed && text.includes(match)) {
        failed = true
        await new Promise((r) => setTimeout(r, 700))
        throw new Error(message)
      }
      return transport.sendMessages(options as never)
    },
  }
}

