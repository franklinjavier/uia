import * as React from "react"
import { MoonIcon, SunIcon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Segmented, SegmentedItem } from "@/components/ds/segmented"
import { Assistant } from "@/examples/assistant/assistant"
import { AgentRuntime } from "@/examples/agent-runtime"
import { AiSpend } from "@/examples/ai-spend"
import { FleetHealth } from "@/examples/fleet-health"
import { ModelEvals } from "@/examples/model-evals"
import { ModelRouter } from "@/examples/model-router"

const scenario =
  new URLSearchParams(window.location.search).get("scenario") ?? undefined

function FullChat() {
  return <Assistant layout="full" initialScenario={scenario as never} />
}

function AssistantWidget() {
  return <Assistant initialScenario={scenario as never} />
}

const WIDGETS = {
  chat: { label: "Full chat", component: FullChat, full: true },
  assistant: { label: "Assistant", component: AssistantWidget, full: false },
  router: { label: "Model router", component: ModelRouter, full: false },
  runtime: { label: "Agent runtime", component: AgentRuntime, full: false },
  spend: { label: "AI spend", component: AiSpend, full: false },
  fleet: { label: "Fleet health", component: FleetHealth, full: false },
  evals: { label: "Evals", component: ModelEvals, full: false },
} as const

type WidgetKey = keyof typeof WIDGETS

// `?bare` hides the playground chrome (used to take the example
// screenshots); `?scenario=draft` starts the assistant on a script.
const params = new URLSearchParams(window.location.search)
const bare = params.has("bare")

export function App() {
  const { theme, setTheme } = useTheme()
  const [active, setActive] = React.useState<WidgetKey>(() => {
    const hash = window.location.hash.slice(1)
    return hash in WIDGETS ? (hash as WidgetKey) : "chat"
  })
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  const Active = WIDGETS[active].component
  const full = WIDGETS[active].full

  return (
    <div className="relative min-h-svh bg-background">
      {!bare && (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-16 items-center justify-center gap-2 px-4 *:pointer-events-auto">
          <Segmented
            variant="sans"
            value={active}
            onValueChange={(v) => {
              setActive(v as WidgetKey)
              window.location.hash = v
            }}
          >
            {Object.entries(WIDGETS).map(([key, w]) => (
              <SegmentedItem key={key} value={key}>
                {w.label}
              </SegmentedItem>
            ))}
          </Segmented>
          <Button
            variant="outline"
            size="icon-sm"
            className="absolute right-4"
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </Button>
        </header>
      )}

      {full ? (
        <Active />
      ) : (
        <main className="relative flex min-h-svh items-center justify-center px-4 py-20">
          <Active />
        </main>
      )}
    </div>
  )
}

export default App
