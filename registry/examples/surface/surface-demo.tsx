import * as React from "react"
import { CodeIcon, RotateCcwIcon, SendIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Segmented, SegmentedItem } from "@/components/ds/segmented"
import { ResolvedRow } from "@/components/parts/action-card"
import { Surface } from "@/components/surface/surface"
import { createSurfaceStore, useSurface } from "@/components/surface/store"
import type { SurfaceAction, SurfaceMessage } from "@/components/surface/types"
import { uiaCatalog } from "@/components/catalog"
import { INTENTS, type IntentKey } from "@/examples/surface/specs"

// Example: a screen the agent assembles for the moment. Pick an intent; the
// agent's A2UI messages stream in (data first, then components two at a
// time) and the surface renders as they land. Actions come back as named
// events — here they're just logged; in an app they go to the agent.

const STEP_MS = 260

function useStreamedSurface(messages: readonly SurfaceMessage[], run: number) {
  const [store] = React.useState(() => createSurfaceStore())
  React.useEffect(() => {
    store.process([{ deleteSurface: { surfaceId: surfaceIdOf(messages) } }])
    let i = 0
    const t = window.setInterval(() => {
      if (i >= messages.length) return window.clearInterval(t)
      store.process(messages[i++])
    }, STEP_MS)
    return () => window.clearInterval(t)
  }, [store, messages, run])
  return useSurface(store, surfaceIdOf(messages))
}

function surfaceIdOf(messages: readonly SurfaceMessage[]) {
  const first = messages[0]
  return first && "createSurface" in first
    ? first.createSurface.surfaceId
    : "surface"
}

export function SurfaceExample() {
  const [intent, setIntent] = React.useState<IntentKey>("cost")
  const [run, setRun] = React.useState(0)
  const [showSpec, setShowSpec] = React.useState(false)
  const [events, setEvents] = React.useState<SurfaceAction[]>([])
  const messages = INTENTS[intent].messages
  const surface = useStreamedSurface(messages, run)

  return (
    <div className="mx-auto flex w-full max-w-[64rem] flex-col gap-6 px-4 pt-8 pb-28 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          variant="sans"
          value={intent}
          onValueChange={(v) => {
            setIntent(v as IntentKey)
            setEvents([])
          }}
        >
          {(Object.keys(INTENTS) as IntentKey[]).map((k) => (
            <SegmentedItem key={k} value={k}>
              {INTENTS[k].label}
            </SegmentedItem>
          ))}
        </Segmented>
        <span className="ml-auto flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => setRun((r) => r + 1)}
          >
            <RotateCcwIcon />
            Replay
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            aria-pressed={showSpec}
            onClick={() => setShowSpec((s) => !s)}
          >
            <CodeIcon />
            {showSpec ? "Hide spec" : "Spec"}
          </Button>
        </span>
      </div>

      <Surface
        surface={surface}
        catalog={uiaCatalog}
        showIssues
        onAction={(a) => setEvents((e) => [a, ...e])}
      />

      {events.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {events.map((a) => (
            <ResolvedRow
              key={a.timestamp}
              icon={<SendIcon />}
              label={`Sent to the agent · ${a.name}`}
              summary={JSON.stringify(a.context)}
            />
          ))}
        </div>
      )}

      {showSpec && (
        <pre className="max-h-[28rem] overflow-auto rounded-2xl bg-muted/50 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
          {JSON.stringify(messages, null, 2)}
        </pre>
      )}
    </div>
  )
}
