import {
  AiSpend,
  type AiSpendModel,
  type AiSpendPeriod,
} from "@/components/blocks/ai-spend"

// Example: the AiSpend widget with demo data. The widget is a pure view
// (components/widgets/ai-spend); this file is only the fixture. Pick a past
// month to see the other states (under budget, over budget).

export const BUDGET = 1500

export const MODELS: AiSpendModel[] = [
  {
    id: "opus",
    name: "Claude Opus",
    provider: "Anthropic",
    family: "claude",
    color: "var(--chart-1)",
  },
  {
    id: "sonnet",
    name: "Claude Sonnet",
    provider: "Anthropic",
    family: "claude",
    color: "var(--chart-2)",
  },
  {
    id: "gpt",
    name: "GPT",
    provider: "OpenAI",
    family: "openai",
    color: "var(--chart-3)",
  },
  {
    id: "gemini",
    name: "Gemini",
    provider: "Google",
    family: "gemini",
    color: "var(--chart-4)",
  },
  {
    id: "llama",
    name: "Llama",
    provider: "Self-hosted",
    family: "meta",
    color: "var(--muted-foreground)",
  },
]

const MONTHS: Record<string, Omit<AiSpendPeriod, "id">> = {
  oct: {
    label: "October 2026",
    short: "Oct",
    days: 31,
    day: 19,
    resets: "Nov 1",
    usage: {
      opus: { cost: 584.2, tokens: 37.7 },
      sonnet: { cost: 398.7, tokens: 78.2 },
      gpt: { cost: 182.6, tokens: 41 },
      gemini: { cost: 91.15, tokens: 23.8 },
      llama: { cost: 30.4, tokens: 15.6 },
    },
  },
  sep: {
    label: "September 2026",
    short: "Sep",
    days: 30,
    day: 30,
    resets: "Oct 1",
    usage: {
      opus: { cost: 702.4, tokens: 45.3 },
      sonnet: { cost: 455.1, tokens: 89.2 },
      gpt: { cost: 259.8, tokens: 58.4 },
      gemini: { cost: 140.2, tokens: 36.6 },
      llama: { cost: 54.9, tokens: 28.1 },
    },
  },
  aug: {
    label: "August 2026",
    short: "Aug",
    days: 31,
    day: 31,
    resets: "Sep 1",
    usage: {
      opus: { cost: 280.4, tokens: 18.1 },
      sonnet: { cost: 210.3, tokens: 41.2 },
      gpt: { cost: 99.6, tokens: 22.4 },
      gemini: { cost: 49.7, tokens: 13 },
      llama: { cost: 16.6, tokens: 8.5 },
    },
  },
}

export const PERIODS: AiSpendPeriod[] = Object.entries(MONTHS).map(
  ([id, m]) => ({ id, ...m })
)

export function AiSpendExample() {
  return <AiSpend models={MODELS} periods={PERIODS} budget={BUDGET} />
}
