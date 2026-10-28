import * as React from "react"
import { motion } from "motion/react"
import { ChevronsUpDownIcon, MoonIcon, SunIcon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { PlaygroundDock } from "./playground-dock"
import { navigate, usePath } from "./router"
import { Button } from "@/components/ui/button"
import type { View as DavinciView } from "@/examples/davinci2/davinci2"
import type { View as WalletView } from "@/examples/wallet/wallet"

// Each example loads on its own when it's opened, so the first page only
// pays for the one on screen.
function lazy<M, P>(load: () => Promise<M>, pick: (m: M) => React.ComponentType<P>) {
  return React.lazy(() => load().then((m) => ({ default: pick(m) })))
}
const Assistant = lazy(() => import("@/examples/assistant/assistant"), (m) => m.Assistant)
const AgentRuntime = lazy(() => import("@/examples/agent-runtime"), (m) => m.AgentRuntimeExample)
const AiSpend = lazy(() => import("@/examples/ai-spend"), (m) => m.AiSpendExample)
const FleetHealth = lazy(() => import("@/examples/fleet-health"), (m) => m.FleetHealthExample)
const GroundStation = lazy(() => import("@/examples/ground-station"), (m) => m.GroundStationExample)
const MergeConflicts = lazy(() => import("@/examples/merge-conflicts"), (m) => m.MergeConflictsExample)
const OceanExample = lazy(() => import("@/examples/ocean"), (m) => m.OceanExample)
const PurchaseOrders = lazy(() => import("@/examples/purchase-orders"), (m) => m.PurchaseOrdersExample)
const ModelEvals = lazy(() => import("@/examples/model-evals"), (m) => m.ModelEvalsExample)
const Bottega = lazy(() => import("@/examples/bottega/bottega"), (m) => m.Bottega)
const Davinci = lazy(() => import("@/examples/davinci/davinci"), (m) => m.Davinci)
const DavinciInbox = lazy(() => import("@/examples/davinci2/davinci2"), (m) => m.DavinciInbox)
const Wallet = lazy(() => import("@/examples/wallet/wallet"), (m) => m.Wallet)
const ModelRouter = lazy(() => import("@/examples/model-router"), (m) => m.ModelRouterExample)
const SurfaceExample = lazy(() => import("@/examples/surface/surface-demo"), (m) => m.SurfaceExample)
const Compare = lazy(() => import("./compare"), (m) => m.Compare)
const Patterns = lazy(() => import("./patterns"), (m) => m.Patterns)
const DavinciSurfaceExample = lazy(() => import("@/examples/davinci-surface/davinci-surface"), (m) => m.DavinciSurfaceExample)

const scenario =
  new URLSearchParams(window.location.search).get("scenario") ?? undefined

function FullChat() {
  return <Assistant initialScenario={scenario as never} />
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

// The wallet's views are routes too: /wallet, /wallet/swap, /wallet/activity.
function WalletPage() {
  const [, section] = usePath()
  return <Wallet view={(section ?? "home") as WalletView} onViewChange={(v) => navigate(v === "home" ? "/wallet" : `/wallet/${v}`)} />
}

// The ASCII backdrops share one example; its switch moves the URL too. One
// component for every path, so switching doesn't remount it (the sound stays on).
const BACKDROP_PATHS = { koi: "/koi", shark: "/sharks", piranha: "/piranhas", starling: "/starlings", firefly: "/fireflies", aurora: "/aurora", slime: "/slime-mold" } as const
type Water = keyof typeof BACKDROP_PATHS
function Backdrop() {
  const [first] = usePath()
  const of = (Object.keys(BACKDROP_PATHS) as Water[]).find((w) => BACKDROP_PATHS[w] === `/${first}`) ?? "koi"
  return <OceanExample predator={of} onPredatorChange={(v) => navigate(BACKDROP_PATHS[v], { replace: true })} />
}

const WIDGETS = {
  chat: { label: "Assistant", component: FullChat, full: true },
  router: { label: "Model router", component: ModelRouter, full: false },
  runtime: { label: "Agent runtime", component: AgentRuntime, full: false },
  spend: { label: "AI spend", component: AiSpend, full: false },
  fleet: { label: "Fleet health", component: FleetHealth, full: false },
  ground: { label: "Ground station", component: GroundStation, full: false },
  merge: { label: "Merge conflicts", component: MergeConflicts, full: false },
  orders: { label: "Purchase orders", component: PurchaseOrders, full: false },
  evals: { label: "Evals", component: ModelEvals, full: false },
  // One entry in the menu; the backdrop's own switch picks the scene.
  koi: { label: "ASCII animations", component: Backdrop, full: true },
  sharks: { label: "ASCII animations", component: Backdrop, full: true, hidden: true },
  piranhas: { label: "ASCII animations", component: Backdrop, full: true, hidden: true },
  starlings: { label: "ASCII animations", component: Backdrop, full: true, hidden: true },
  fireflies: { label: "ASCII animations", component: Backdrop, full: true, hidden: true },
  aurora: { label: "ASCII animations", component: Backdrop, full: true, hidden: true },
  "slime-mold": { label: "ASCII animations", component: Backdrop, full: true, hidden: true },
  bottega: { label: "Bottega", component: Bottega, full: true },
  wallet: { label: "Wallet", component: WalletPage, full: true },
  davinci: { label: "davinci (one chat)", component: Davinci, full: true },
  davinci2: { label: "davinci (inbox)", component: DavinciInboxPage, full: true },
  surface: { label: "Agent-built screen", component: SurfaceExample, full: true },
  "davinci-surface": { label: "davinci (agent-composed)", component: DavinciSurfaceExample, full: true },
  compare: { label: "Experiment: hand-made vs agent", component: Compare, full: true },
  patterns: { label: "Patterns (catalog)", component: Patterns, full: true },
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
        <PlaygroundDock
          onDragStart={() => setPickerOpen(false)}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          menu={
            <nav aria-label="Examples" className="flex max-h-[min(70svh,32rem)] flex-col overflow-y-auto pb-1">
              {Object.entries(WIDGETS).filter(([, w]) => !("hidden" in w)).map(([key, w], i) => (
                <motion.button
                  key={key}
                  type="button"
                  aria-current={w.label === WIDGETS[active].label ? "page" : undefined}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.2, delay: 0.14 + i * 0.018 } }}
                  onClick={() => {
                    setPickerOpen(false)
                    go(key as WidgetKey)
                  }}
                  className="flex h-8 items-center rounded-xl px-3 text-left text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:bg-muted aria-[current=page]:text-foreground aria-[current=page]:bg-muted/60"
                >
                  {w.label}
                </motion.button>
              ))}
            </nav>
          }
        >
          <Button
            variant="ghost"
            size="sm"
            aria-label="Example"
            aria-expanded={pickerOpen}
            className="gap-1.5 rounded-full px-2.5 font-normal"
            onClick={() => setPickerOpen((o) => !o)}
          >
            {WIDGETS[active].label}
            <ChevronsUpDownIcon className="text-muted-foreground" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </Button>
        </PlaygroundDock>
      )}

      <React.Suspense fallback={null}>
        {full ? (
          <Active />
        ) : (
          <main className="relative flex min-h-svh items-center justify-center px-4 pt-16 pb-28">
            <Active />
          </main>
        )}
      </React.Suspense>
    </div>
  )
}

export default App
