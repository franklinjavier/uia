import { z } from "zod"

import { AiSpend as AiSpendBlock } from "@/components/blocks/ai-spend"
import { defineComponent } from "@/components/surface/catalog"

// Product blocks as an optional catalog layer: whole data views a product
// may show (spend, fleet, evals…). Not in the core catalog — a product
// registers the ones it has, so the agent's prompt stays small:
//
//   const catalog = extendCatalog(uiaCatalog, [AiSpend])

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
    <AiSpendBlock
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

export const blocks = [AiSpend]
