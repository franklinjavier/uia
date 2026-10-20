import { defineActions } from "@/components/surface/catalog"
import {
  DECIDED,
  QUEUE,
  RULES,
  SINCE,
  type QueueItem,
} from "@/examples/davinci2/davinci2-data"

// The host side of davinci on surfaces: what the factory offers and what
// the agent may read. Two contracts the agent can't bend:
//
// - Actions: the events the factory accepts, and what each one is. The
//   renderer derives "Irreversible", Undo and the mandatory confirmation
//   from here; whatever the agent marks is ignored. In the real factory each
//   name maps to the chat action contract (receipts, idempotency).
// - Facts: counts, rates and times come from the factory's data, bound by
//   path. The agent writes the why, never the how much.

export const factoryActions = defineActions({
  approve: {
    reversible: true,
    describe: "Approves the plan; build starts now",
  },
  choose: { reversible: true, describe: "Answers with the chosen option" },
  promote: {
    reversible: true,
    describe: "Promotes to main; ships with the next wave",
  },
  adjust: { reversible: true, describe: "Sends it back with a note" },
  // A migration in the diff can't be taken back once integrated.
  integrate: {
    reversible: false,
    describe: "Queues the change for integration",
  },
  return: { reversible: true, describe: "Returns the change with a note" },
  revert: {
    reversible: true,
    describe: "Reverts the culprit through full gates",
  },
  keep: { reversible: true, describe: "Keeps the release and investigates" },
  make_rule: {
    reversible: true,
    describe: "Turns repeated agreement into a rule",
  },
  toggle_rule: { reversible: true },
  // Some of davinci's decisions can be taken back, some can't (a re-woken
  // operator, a retried run): the factory knows which, per decision.
  undo: {
    reversible: (context) =>
      DECIDED.find((d) => d.id === context.id)?.reversible ?? false,
    describe: "Undoes a decision davinci made for you",
  },
  open_diff: {},
  open_preview: {},
})

export type FactoryAction = keyof typeof factoryActions

/** The data model the agent binds to: the factory's own numbers. */
export function factoryData(answered: Record<string, string>) {
  const open = QUEUE.filter((q) => !answered[q.id])
  const undone = (id: string) => Boolean(answered[`undo:${id}`])
  const decided = DECIDED.filter((d) => !undone(d.id))
  return {
    summary: {
      title: open.length
        ? `${open.length} decisions need you`
        : "Nothing needs you",
      since: `Since 21:00: ${SINCE.calm.shipped} shipped, ${SINCE.calm.stuck} stuck, ${decided.length} decided for you.`,
    },
    items: Object.fromEntries(QUEUE.map((q) => [q.id, item(q)])),
    answered: QUEUE.filter((q) => answered[q.id]).map((q) => ({
      id: q.id,
      what: `${answered[q.id]} · ${q.title}`,
      project: q.project,
    })),
    decided: DECIDED.map((d) => ({
      id: d.id,
      time: d.time,
      subject: d.project,
      what: d.what,
      why: d.why,
      rule: RULES.find((r) => r.id === d.rule)?.text,
      undone: undone(d.id),
    })),
    rules: RULES.map((r) => ({
      id: r.id,
      text: r.text,
      category: r.category,
      applied: r.applied,
      on: true,
    })),
  }
}

function item(q: QueueItem) {
  return {
    eyebrow: `${q.project} · ${q.category}`,
    title: q.title,
    context: q.context,
    consequence: q.consequence,
    options: q.options,
    pick: q.pick,
    agreement: q.agreement && { ...q.agreement, category: q.category },
  }
}

export { QUEUE }
