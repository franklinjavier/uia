import type { UIMessage } from "ai"

import { createChat } from "@/lib/ai"
import type { Question } from "@/components/parts/ask-user"
import type { Draft } from "@/components/parts/draft-card"

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
}
export type ChatMessage = UIMessage<unknown, Record<string, never>, Tools>

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
          { title: "Halden 4.2 changelog", url: "https://halden.dev/changelog/4-2" },
          { title: "Per-seat policies, explained", url: "https://blog.halden.dev/per-seat-policies" },
          { title: "Audit log API reference", url: "https://docs.halden.dev/api/audit-log" },
          { title: "API key rotation notice", url: "https://status.halden.dev/notices/key-rotation" },
          { title: "Halden 4.1 changelog", url: "https://halden.dev/changelog/4-1" },
          { title: "Roadmap: what's next after 4.2", url: "https://blog.halden.dev/roadmap" },
        ],
      })
    writer.text(
      "Halden **4.2** is mostly about speed and control:\n\n- **Streaming exports.** Large CSV exports now stream instead of timing out, up to 2M rows.\n- **Per-seat policies.** Admins can set model and spend limits for each seat, not just per workspace.\n- **Audit log API.** Every policy change is now queryable, with a 400-day retention window.\n\nNothing is breaking. The only migration step is re-issuing API keys created before March, which now expire on rotation."
    )
    writer.sourceUrl({ sourceId: "s1", title: "Halden 4.2 changelog", url: "https://halden.dev/changelog/4-2" })
    writer.sourceUrl({ sourceId: "s2", title: "Per-seat policies, explained", url: "https://blog.halden.dev/per-seat-policies" })
    writer.sourceUrl({ sourceId: "s3", title: "Audit log API reference", url: "https://docs.halden.dev/api/audit-log" })
    writer.sourceUrl({ sourceId: "s4", title: "API key rotation notice", url: "https://status.halden.dev/notices/key-rotation" })
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
        { label: "Account", value: "@halden" },
        { label: "Network", value: "X" },
        { label: "Posts", value: "3" },
      ],
      summary: "@halden · 3 posts",
      body: `1/ ${open} the new Halden dashboard is live.\n\n2/ Monitors, usage and spend on one screen. Loads twice as fast. Finally works on mobile.\n\n3/ Nothing changes about your data or alerts. Open it from the sidebar today.`,
      sendLabel: "Post thread",
      sentVerb: "Posted thread",
      intro: `Here is a ${tone.toLowerCase()} three-post thread for @halden. Edit anything in place, then post it when it reads right.`,
      done: "Posted the thread from @halden.",
    }
  }
  if (channel === "Blog post") {
    return {
      kind: "New blog post",
      app: "Blog",
      icon: "blog",
      title: "Meet the new dashboard",
      fields: [
        { label: "Blog", value: "blog.halden.dev" },
        { label: "Title", value: "Meet the new dashboard" },
        { label: "Visibility", value: "Public" },
      ],
      summary: "blog.halden.dev/new-dashboard",
      body: `${open} the new dashboard is live for every workspace.\n\nMonitors, usage and spend now share one screen, it loads twice as fast, and it finally works on mobile. Nothing changes about your data or alerts.\n\nOpen it from the sidebar and tell us what you think.`,
      sendLabel: "Publish post",
      sentVerb: "Published post",
      intro: `Here is a ${tone.toLowerCase()} blog post. Edit anything in place, then publish it when it reads right.`,
      done: "Published at blog.halden.dev/new-dashboard.",
    }
  }
  return {
    kind: "New email",
    app: "Mail",
    icon: "mail",
    title: "Your new dashboard is live",
    fields: [
      { label: "From", value: "product@halden.dev" },
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

export const SCENARIOS = {
  research: { label: "What shipped in the last release?", icon: "globe", turns: 3, chat: research },
  draft: { label: "Draft a launch announcement", icon: "pen", turns: 1, chat: draft },
  code: { label: "Write a debounce hook", icon: "code", turns: 1, chat: code },
} as const

export type ScenarioKey = keyof typeof SCENARIOS

export const transports = Object.fromEntries(
  Object.entries(SCENARIOS).map(([key, s]) => [key, s.chat.transport({ delayMs: 22 })])
) as Record<ScenarioKey, ReturnType<typeof research.transport>>
