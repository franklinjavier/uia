import * as React from "react"
import { ChevronUpIcon, MoonIcon, SunIcon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { PlaygroundDock } from "@/playground-dock"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Assistant } from "@/examples/assistant/assistant"
import { AgentRuntime } from "@/examples/agent-runtime"
import { AiSpend } from "@/examples/ai-spend"
import { FleetHealth } from "@/examples/fleet-health"
import { ModelEvals } from "@/examples/model-evals"
import { Bottega } from "@/examples/bottega/bottega"
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
  bottega: { label: "Bottega", component: Bottega, full: true },
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

  const go = (key: WidgetKey) => {
    setActive(key)
    window.location.hash = key
  }

  const Active = WIDGETS[active].component
  const full = WIDGETS[active].full

  return (
    <div className="relative min-h-svh bg-background">
      {!bare && (
        // The playground's own chrome: a draggable pill, out of every example's way.
        <PlaygroundDock>
          <Select value={active} onValueChange={(v) => v && go(v as WidgetKey)}>
            <SelectTrigger aria-label="Example" icon={<ChevronUpIcon />}>
              <SelectValue>{(v: WidgetKey) => WIDGETS[v].label}</SelectValue>
            </SelectTrigger>
            <SelectContent side="top" alignItemWithTrigger={false}>
              {Object.entries(WIDGETS).map(([key, w]) => (
                <SelectItem key={key} value={key}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </Button>
        </PlaygroundDock>
      )}

      {full ? (
        <Active />
      ) : (
        <main className="relative flex min-h-svh items-center justify-center px-4 pt-16 pb-28">
          <Active />
        </main>
      )}
    </div>
  )
}

export default App
