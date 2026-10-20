import * as React from "react"
import { CodeIcon, RotateCcwIcon, SendIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Segmented, SegmentedItem } from "@/components/ds/segmented"
import { ResolvedRow } from "@/components/parts/action-card"
import { Surface } from "@/components/surface/surface"
import {
  createSurfaceStore,
  surfaceFromMessages,
  useSurface,
} from "@/components/surface/store"
import { openUIToMessages } from "@/components/surface/openui"
import type { SurfaceAction, SurfaceMessage } from "@/components/surface/types"
import { uiaCatalog } from "@/components/catalog"
import {
  costAndQuality,
  costAndQualityLang,
  INTENTS,
  type IntentKey,
} from "@/examples/surface/specs"

// Example: a screen the agent assembles for the moment. Pick an intent; the
// agent's A2UI messages stream in (data first, then components two at a
// time) and the surface renders as they land. Actions come back as named
// events — here they're just logged; in an app they go to the agent.
//
// "OpenUI Lang" shows the same dashboard written in that compact syntax
// (about half the size), streamed line by line through `openUIToMessages`.

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

type Format = "json" | "lang"

/** The Lang version, revealed one line per tick, with the JSON version's data. */
function useStreamedLang(run: number, active: boolean) {
  const lines = React.useMemo(() => costAndQualityLang.split("\n"), [])
  // Progress is tagged with its run, so a replay starts from zero without
  // resetting state inside the effect.
  const [progress, setProgress] = React.useState({ run, count: 0 })
  React.useEffect(() => {
    if (!active) return
    let count = 0
    const t = window.setInterval(() => {
      count = Math.min(count + 1, lines.length)
      setProgress({ run, count })
      if (count >= lines.length) window.clearInterval(t)
    }, STEP_MS / 2)
    return () => window.clearInterval(t)
  }, [run, active, lines])
  const count = progress.run === run ? progress.count : 0
  const text = lines.slice(0, count).join("\n") + "\n"
  const data = costAndQuality.find((m) => "updateDataModel" in m)!
  const { messages } = openUIToMessages(text, uiaCatalog, {
    surfaceId: "cost-quality",
    streaming: true,
  })
  return surfaceFromMessages([...messages, data])
}

const JSON_SIZE = JSON.stringify(
  costAndQuality.filter((m) => !("updateDataModel" in m))
).length
const LANG_SIZE = costAndQualityLang.length

export function SurfaceExample() {
  const [intent, setIntent] = React.useState<IntentKey>("cost")
  const [run, setRun] = React.useState(0)
  const [showSpec, setShowSpec] = React.useState(false)
  const [events, setEvents] = React.useState<SurfaceAction[]>([])
  const [format, setFormat] = React.useState<Format>("json")
  const messages = INTENTS[intent].messages
  const lang = intent === "cost" && format === "lang"
  const jsonSurface = useStreamedSurface(messages, run)
  const langSurface = useStreamedLang(run, lang)
  const surface = lang ? langSurface : jsonSurface

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
        {intent === "cost" && (
          <Segmented
            value={format}
            onValueChange={(v) => setFormat(v as Format)}
          >
            <SegmentedItem value="json">JSON</SegmentedItem>
            <SegmentedItem value="lang">OpenUI Lang</SegmentedItem>
          </Segmented>
        )}
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
        <div className="flex flex-col gap-2">
          {intent === "cost" && (
            <span className="eyebrow text-muted-foreground">
              JSON {JSON_SIZE.toLocaleString("en-US")} chars · OpenUI Lang{" "}
              {LANG_SIZE.toLocaleString("en-US")} chars (
              {Math.round((1 - LANG_SIZE / JSON_SIZE) * 100)}% smaller)
            </span>
          )}
          <pre className="max-h-[28rem] overflow-auto rounded-2xl bg-muted/50 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {lang ? costAndQualityLang : JSON.stringify(messages, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
