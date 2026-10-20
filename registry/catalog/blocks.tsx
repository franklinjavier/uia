import { z } from "zod"

import { AiSpend as AiSpendWidget } from "@/components/widgets/ai-spend"
import { DecisionCard as DecisionCardView } from "@/components/parts/decision-card"
import { Findings as FindingsView } from "@/components/parts/findings"
import { Plan as PlanView } from "@/components/parts/plan"
import { action, defineComponent } from "@/components/surface/catalog"

// Blocks: whole uia pieces as catalog entries. The agent should prefer one
// when it matches the intent (a decision, a plan, findings, spend) and
// compose from primitives otherwise. Add your own widgets the same way:
// their typed props are the schema.

export const DecisionCard = defineComponent({
  name: "DecisionCard",
  kind: "block",
  description:
    "One decision the agent needs from the person: what, why, options with the agent's pick, the consequence, and the answers. Use for anything waiting on a judgment.",
  props: z.object({
    agent: z.string().optional(),
    eyebrow: z.string().optional(),
    title: z.string(),
    context: z.string().optional(),
    options: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          hint: z.string().optional(),
        })
      )
      .optional(),
    pick: z.string().optional(),
    chooseAction: action
      .optional()
      .describe(
        "Fired when an option is chosen; context.option is the option id."
      ),
    consequence: z.string().optional(),
    actions: z
      .array(
        z.object({
          label: z.string(),
          kind: z.enum(["primary", "secondary", "aside"]).optional(),
          action,
        })
      )
      .optional(),
    irreversible: z.boolean().optional(),
    urgent: z.boolean().optional(),
  }),
  render: (p, ctx) => (
    <DecisionCardView
      agent={p.agent}
      eyebrow={p.eyebrow}
      title={p.title}
      context={p.context}
      options={p.options}
      pick={p.pick}
      onChoose={(o) => {
        if (!p.chooseAction) return
        ctx.action({
          event: {
            ...p.chooseAction.event,
            context: { ...p.chooseAction.event.context, option: o.id },
          },
        })?.()
      }}
      consequence={p.consequence}
      irreversible={p.irreversible}
      urgent={p.urgent}
      actions={(p.actions ?? []).map((a) => ({
        label: a.label,
        kind: a.kind,
        onClick: ctx.action(a.action) ?? (() => {}),
      }))}
    />
  ),
})

export const Plan = defineComponent({
  name: "Plan",
  kind: "block",
  description:
    "A multi-step job and where it is: steps todo → running → done (waiting = needs the person, failed). Update its data to tick steps off.",
  props: z.object({
    title: z.string(),
    steps: z.array(
      z.object({
        label: z.string(),
        status: z.enum(["todo", "running", "waiting", "done", "failed"]),
        detail: z.string().optional(),
      })
    ),
  }),
  render: (p) => <PlanView title={p.title} steps={p.steps} />,
})

export const Findings = defineComponent({
  name: "Findings",
  kind: "block",
  description:
    "What was pulled from a source, ranked by severity, each with its reference (page, line, timestamp) so it can be checked.",
  props: z.object({
    title: z.string(),
    items: z.array(
      z.object({
        text: z.string(),
        severity: z.enum(["high", "medium", "low"]),
        ref: z.string().optional(),
      })
    ),
  }),
  render: (p) => <FindingsView title={p.title} items={p.items} />,
})

export const AiSpend = defineComponent({
  name: "AiSpend",
  kind: "block",
  description:
    "AI cost by model against a budget for a period: spent, left, projection, alert, models as the meter's legend.",
  props: z.object({
    models: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        provider: z.string().optional(),
        family: z.enum(["claude", "openai", "gemini", "meta", "grok"]),
      })
    ),
    periods: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          short: z.string(),
          days: z.number(),
          day: z.number(),
          resets: z.string(),
          usage: z.record(
            z.string(),
            z.object({ cost: z.number(), tokens: z.number() })
          ),
        })
      )
      .min(1),
    budget: z.number(),
    alertAt: z.number().optional(),
  }),
  render: (p, ctx) => (
    <AiSpendWidget
      size={ctx.size}
      models={p.models}
      periods={p.periods}
      budget={p.budget}
      alertAt={p.alertAt}
      currency={ctx.formatOptions.currency}
      locale={ctx.formatOptions.locale}
      className="max-w-none"
    />
  ),
})

export const blocks = [DecisionCard, Plan, Findings, AiSpend]
