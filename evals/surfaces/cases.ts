import { defineActions } from "../../registry/surface/catalog"

// Composition evals: does an agent, given the uia catalog, compose screens
// that follow the system's rules? Each case is a prompt + the host's data
// and actions; an agent's output (A2UI messages) goes to
// outputs/<case>.<run>.json and `bun scripts/eval-surfaces.ts` checks it.
// `.good.json` / `.bad.json` outputs show what passes and what doesn't.

export const factoryActions = defineActions({
  approve: { reversible: true },
  integrate: { reversible: false },
  revert: { reversible: true },
  keep: { reversible: true },
  rollback: { destructive: true, reversible: false },
  undo: { reversible: true },
})

export type Case = {
  id: string
  name: string
  prompt: string
  data: unknown
  /** Only these items may ask the owner (DecisionCard / Confirmation). */
  ownerDecisions?: string[]
  /** Items that are resolved: must not be asked as a question. */
  resolved?: string[]
  /** Destructive events that must be present, inside a confirmation. */
  mustConfirm?: string[]
  layout?: "inline" | "page"
}

export const CASES: Case[] = [
  {
    id: "inbox-routing",
    name: "Only the owner's decisions reach the inbox",
    prompt:
      "Build the owner's inbox from these factory events. The owner decides only judgment calls; everything a rule or davinci handled goes to the activity log. Use each event's id as its component id.",
    data: {
      events: [
        { id: "e1", kind: "high-risk-diff", needsOwner: true, title: "T-583 · session tokens" },
        { id: "e2", kind: "low-risk-diff", needsOwner: false, title: "T-361 approved by rule" },
        { id: "e3", kind: "visual-ok", needsOwner: true, title: "BLOG-5 · Open Source page" },
        { id: "e4", kind: "retry", needsOwner: false, title: "Retried BLOG-4 after a flaky e2e" },
      ],
    },
    ownerDecisions: ["e1", "e3"],
  },
  {
    id: "facts-bound",
    name: "Numbers come from data, never from prose",
    prompt:
      "Ask the owner whether to raise T-289 to high. Integration waited 41 min on average yesterday (data: /stats/waitAvg); they agreed 5 of 7 times (data: /agreement).",
    data: { stats: { waitAvg: 41, batched: 12 }, agreement: { accepted: 5, total: 7 } },
  },
  {
    id: "resolved-incident",
    name: "A recovered incident is a record, not a question",
    prompt: "Show what happened with the blog's RSS incident (component id i1). It was reverted at 09:12 and the check is green again.",
    data: { incident: { id: "i1", state: "healthy", steps: ["detected", "reverted", "healthy"] } },
    resolved: ["i1"],
  },
  {
    id: "destructive-confirm",
    name: "Destructive actions only inside a confirmation",
    prompt: "Checkout is failing after v42. Offer the owner a rollback to v41.",
    data: { service: "checkout-api", from: "v42", to: "v41" },
    mustConfirm: ["rollback"],
  },
]
