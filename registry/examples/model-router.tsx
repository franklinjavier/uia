import * as React from "react"

import {
  ModelRouter,
  type ModelRouterConfig,
  type ModelRouterDeployState,
  type ModelRouterModel,
  type ModelRouterPolicy,
} from "@/components/blocks/model-router"

// Example: the ModelRouter widget with demo data. The widget is a pure view
// (components/widgets/model-router); this file is the fixture and fakes the
// deploy (a short delay, then the draft goes live as the next version).

export const MODELS: ModelRouterModel[] = [
  {
    id: "opus",
    name: "Opus 5.5",
    provider: "Anthropic",
    color: "var(--chart-1)",
    p50: 0.84,
    p95: 2.16,
    price: 0.0126,
    errors: 0.42,
  },
  {
    id: "sol",
    name: "GPT-6.1 Sol",
    provider: "OpenAI",
    color: "var(--chart-2)",
    p50: 0.51,
    p95: 1.34,
    price: 0.0048,
    errors: 0.27,
  },
  {
    id: "haiku",
    name: "Haiku 4.5",
    provider: "Anthropic",
    color: "var(--chart-3)",
    p50: 0.23,
    p95: 0.64,
    price: 0.0007,
    errors: 0.61,
  },
  {
    id: "qwen",
    name: "Qwen3.5 9B",
    provider: "Self-hosted",
    color: "var(--chart-4)",
    p50: 0.38,
    p95: 1.09,
    price: 0.0019,
    errors: 1.08,
  },
]

export const POLICIES: ModelRouterPolicy[] = [
  {
    id: "cost",
    label: "Cost",
    shares: { opus: 9, sol: 24, haiku: 44, qwen: 23 },
  },
  {
    id: "balanced",
    label: "Balanced",
    shares: { opus: 41, sol: 35, haiku: 16, qwen: 8 },
  },
  {
    id: "quality",
    label: "Quality",
    shares: { opus: 63, sol: 27, haiku: 6, qwen: 4 },
  },
]

export const ENVIRONMENTS = ["chat-prod", "chat-staging", "batch-eu"]

export const REQUESTS_PER_SECOND = 334

export function ModelRouterExample() {
  const [livePolicy, setLivePolicy] = React.useState("balanced")
  const [version, setVersion] = React.useState(14)
  const [deployState, setDeployState] =
    React.useState<ModelRouterDeployState>("idle")
  const timers = React.useRef<number[]>([])

  React.useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((t) => window.clearTimeout(t))
  }, [])

  function deploy(config: ModelRouterConfig) {
    setDeployState("deploying")
    timers.current.push(
      window.setTimeout(() => {
        setLivePolicy(config.policy)
        setVersion((v) => v + 1)
        setDeployState("deployed")
        timers.current.push(
          window.setTimeout(() => setDeployState("idle"), 1800)
        )
      }, 900)
    )
  }

  return (
    <ModelRouter
      models={MODELS}
      policies={POLICIES}
      environments={ENVIRONMENTS}
      requestsPerSecond={REQUESTS_PER_SECOND}
      livePolicy={livePolicy}
      version={version}
      deployState={deployState}
      onDeploy={deploy}
    />
  )
}
