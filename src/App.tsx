import * as React from "react"
import { MoonIcon, SunIcon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Segmented, SegmentedItem } from "@/components/ds/segmented"
import { Assistant } from "@/playground/assistant/assistant"
import { ModelRouter } from "@/playground/model-router"

function FullChat() {
  return <Assistant layout="full" />
}

const WIDGETS = {
  chat: { label: "Full chat", component: FullChat, full: true },
  assistant: { label: "Assistant", component: Assistant, full: false },
  router: { label: "Model router", component: ModelRouter, full: false },
} as const

type WidgetKey = keyof typeof WIDGETS

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
