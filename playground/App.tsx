import * as React from "react"
import { ChevronsUpDownIcon, MoonIcon, SunIcon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { PlaygroundDock } from "./playground-dock"
import { navigate, usePath } from "./router"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Assistant } from "@/examples/assistant/assistant"
import { AgentRuntimeExample as AgentRuntime } from "@/examples/agent-runtime"
import { AiSpendExample as AiSpend } from "@/examples/ai-spend"
import { FleetHealthExample as FleetHealth } from "@/examples/fleet-health"
import { ModelEvalsExample as ModelEvals } from "@/examples/model-evals"
import { Bottega } from "@/examples/bottega/bottega"
import { Davinci } from "@/examples/davinci/davinci"
import { DavinciInbox, type View as DavinciView } from "@/examples/davinci2/davinci2"
import { ModelRouterExample as ModelRouter } from "@/examples/model-router"
import { SurfaceExample } from "@/examples/surface/surface-demo"

const scenario =
  new URLSearchParams(window.location.search).get("scenario") ?? undefined

function FullChat() {
  return <Assistant layout="full" initialScenario={scenario as never} />
}

// davinci's views are routes: /davinci2, /davinci2/threads/blog,
// /davinci2/projects, /davinci2/decided, /davinci2/rules.
function DavinciInboxPage() {
  const [, section, id] = usePath()
  const view = (section === "threads" && id ? `thread:${id}` : section ?? "inbox") as DavinciView
  return (
    <DavinciInbox
      view={view}
      onViewChange={(v) =>
        navigate(v === "inbox" ? "/davinci2" : v.startsWith("thread:") ? `/davinci2/threads/${v.slice(7)}` : `/davinci2/${v}`)
      }
    />
  )
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
  davinci: { label: "davinci (one chat)", component: Davinci, full: true },
  davinci2: { label: "davinci (inbox)", component: DavinciInboxPage, full: true },
  surface: { label: "Agent-built screen", component: SurfaceExample, full: true },
} as const

type WidgetKey = keyof typeof WIDGETS

// `?bare` hides the playground chrome (used to take the example
// screenshots); `?scenario=draft` starts the assistant on a script.
const params = new URLSearchParams(window.location.search)
const bare = params.has("bare")

// Links from before the router used the hash (`/#fleet`): move them to paths.
const legacy = window.location.hash.slice(1)
if (legacy in WIDGETS) {
  window.history.replaceState(null, "", `/${legacy === "chat" ? "" : legacy}${window.location.search}`)
}

export function App() {
  const { theme, setTheme } = useTheme()
  const [first] = usePath()
  const active: WidgetKey = first && first in WIDGETS ? (first as WidgetKey) : "chat"
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  const [pickerOpen, setPickerOpen] = React.useState(false)
  const go = (key: WidgetKey) => navigate(key === "chat" ? "/" : `/${key}`)

  const Active = WIDGETS[active].component
  const full = WIDGETS[active].full

  return (
    <div className="relative min-h-svh bg-background">
      {!bare && (
        // The playground's own chrome: a draggable pill, out of every example's way.
        <PlaygroundDock onDragStart={() => setPickerOpen(false)}>
          <Select
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            value={active}
            onValueChange={(v) => v && go(v as WidgetKey)}
          >
            <SelectTrigger
              aria-label="Example"
              icon={<ChevronsUpDownIcon />}
              // The dock drags from anywhere: open on a real click, not on press.
              onPointerDown={(e) => e.preventBaseUIHandler()}
              onMouseDown={(e) => e.preventBaseUIHandler()}
              onClick={() => setPickerOpen((o) => !o)}
            >
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
