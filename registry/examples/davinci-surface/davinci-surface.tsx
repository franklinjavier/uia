import * as React from "react"
import { CodeIcon, TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Segmented, SegmentedItem } from "@/components/ds/segmented"
import { ResolvedRow } from "@/components/parts/action-card"
import { Surface } from "@/components/surface/surface"
import { surfaceFromMessages } from "@/components/surface/store"
import type { SurfaceIssue, SurfaceMessage } from "@/components/surface/types"
import { uiaCatalog } from "@/components/catalog"
import {
  composeDecided,
  composeInbox,
  composeRules,
} from "@/examples/davinci-surface/compose"
import {
  factoryActions,
  factoryData,
  QUEUE,
} from "@/examples/davinci-surface/factory"

// davinci on surfaces: the same inbox as the hand-made davinci2, but every
// screen is A2UI messages an agent sends (compose.ts), bound to the
// factory's data (factory.ts) and rendered by <Surface> with the factory's
// action contract. Answering runs the host's action and the agent's screen
// updates from the data. Compare with /davinci2.

type View = "inbox" | "decided" | "rules"

const ANSWER_LABEL: Record<string, string> = {
  revert: "Reverted 3f2a1c",
  keep: "Kept v12",
  integrate: "Approved",
  return: "Returned",
  promote: "Promoted",
  adjust: "Sent back",
  choose: "Answered",
}

export function DavinciSurfaceExample() {
  const [view, setView] = React.useState<View>("inbox")
  const [answered, setAnswered] = React.useState<Record<string, string>>({})
  const [rulesOff, setRulesOff] = React.useState<Record<string, boolean>>({})
  const [panel, setPanel] = React.useState<string | null>(null)
  const [issues, setIssues] = React.useState<SurfaceIssue[]>([])
  const [showSpec, setShowSpec] = React.useState(false)

  const data = React.useMemo(() => {
    const d = factoryData(answered)
    return { ...d, rules: d.rules.map((r) => ({ ...r, on: !rulesOff[r.id] })) }
  }, [answered, rulesOff])

  const open = QUEUE.filter((q) => !answered[q.id])
  const components: SurfaceMessage[] =
    view === "inbox"
      ? composeInbox(
          open,
          Object.keys(answered).filter((k) => !k.startsWith("undo:")).length
        )
      : view === "decided"
        ? composeDecided()
        : composeRules()
  const surfaceId = view === "inbox" ? "inbox" : view
  const messages: SurfaceMessage[] = [
    ...components,
    { version: "v0.9", updateDataModel: { surfaceId, path: "/", value: data } },
  ]

  return (
    <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-6 px-4 pt-8 pb-28 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          variant="sans"
          value={view}
          onValueChange={(v) => {
            setView(v as View)
            setIssues([])
          }}
        >
          <SegmentedItem value="inbox">Inbox</SegmentedItem>
          <SegmentedItem value="decided">Decided for you</SegmentedItem>
          <SegmentedItem value="rules">Rules</SegmentedItem>
        </Segmented>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-muted-foreground"
          aria-pressed={showSpec}
          onClick={() => setShowSpec((s) => !s)}
        >
          <CodeIcon />
          {showSpec ? "Hide spec" : "Spec"}
        </Button>
      </div>

      <Surface
        key={view}
        surface={surfaceFromMessages(messages)}
        catalog={uiaCatalog}
        actions={factoryActions}
        showIssues
        onIssue={(i) => setIssues((all) => [...all, i])}
        onAction={(a) => {
          const id = String(a.context.id ?? "")
          if (a.name === "open_diff" || a.name === "open_preview")
            return setPanel(`${a.name} · ${id}`)
          if (a.name === "undo")
            return setAnswered((s) => ({ ...s, [`undo:${id}`]: "Undone" }))
          if (a.name === "toggle_rule")
            return setRulesOff((s) => ({ ...s, [id]: a.context.on === false }))
          if (a.name === "make_rule") return
          const label =
            a.name === "choose"
              ? String(a.context.option ?? "Answered")
              : (ANSWER_LABEL[a.name] ?? a.name)
          setAnswered((s) => ({ ...s, [id]: label }))
        }}
      />

      {panel && (
        <ResolvedRow
          icon={<CodeIcon />}
          label="Would open the side panel"
          summary={panel}
        />
      )}

      {issues.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {issues.map((i, n) => (
            <ResolvedRow
              key={n}
              icon={<TriangleAlertIcon />}
              label={`${i.code} · ${i.componentId}`}
              summary={i.message}
              muted
            />
          ))}
        </div>
      )}

      {showSpec && (
        <pre className="max-h-[28rem] overflow-auto rounded-2xl bg-muted/50 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
          {JSON.stringify(components, null, 2)}
        </pre>
      )}
    </div>
  )
}
