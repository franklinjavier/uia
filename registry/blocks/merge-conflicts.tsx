import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { CheckIcon, ChevronRightIcon, GitPullRequestIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { enter } from "@/lib/motion"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { StatusBadge, StatusDot } from "@/components/ds/status"
import {
  Widget,
  WidgetActions,
  WidgetFooter,
  WidgetHeader,
  WidgetMeta,
  WidgetPanel,
  WidgetSectionTitle,
  WidgetTitle,
  type WidgetSize,
} from "@/components/ds/widget"

// MergeConflicts: a pull request whose base moved on. The branches as a
// commit graph (one lane per branch, drawn row by row so the lines stay
// aligned whatever the row count), the files both sides changed with their
// hunks side by side, then how each was resolved. One verb at a time in the
// footer: merge the base in and resolve, then merge the pull request.
// Pure view: pass the commits, the files and the `state` in (from your git
// host, a tool's output, a fixture) and handle `onResolve` / `onMerge`;
// it keeps only UI state (file opened, file hovered).
//
//   <MergeConflicts number={128} title="Refresh sessions…" head="feat" base="main"
//     branches={branches} commits={commits} files={files} state="conflict"
//     onResolve={resolve} onMerge={merge} />
//
// The widget never writes commits itself: the merge commit that resolves
// the conflicts and the one that merges the pull request arrive in the
// next `commits` you pass (`pending` draws one dashed while it is made).

export type MergeBranch = {
  id: string
  name: string
  /** A token colour (`var(--chart-1)`); defaults follow the lane order. */
  color?: string
}

export type MergeCommit = {
  sha: string
  message: string
  author: string
  /** Relative time as you want it read ("6m", "now"). */
  time: string
  /** Branch id: the lane the commit sits in. */
  branch: string
  /** Parent shas, first parent first. A parent not in the list ends the line. */
  parents: string[]
  /** Being written: dashed, its message shimmering. */
  pending?: boolean
}

export type MergeHunk = {
  /** The head branch's lines. */
  ours: string[]
  /** The base branch's lines. */
  theirs: string[]
  /** The resolved lines and where each came from. */
  result: { text: string; from: "ours" | "theirs" | "new" }[]
}

export type MergeConflictFile = {
  path: string
  /** The head commit that changed these lines. */
  ours: string
  /** The base commit that changed the same lines. */
  theirs: string
  hunks: MergeHunk[]
  /** How it was resolved, in two words ("Kept both"). */
  outcome: string
  /** And why, in one line. */
  note: string
}

export type MergeConflictsState =
  "conflict" | "resolving" | "resolved" | "merging" | "merged"

export type MergeConflictsProps = {
  number: number
  title: React.ReactNode
  /** Branch ids. */
  head: string
  base: string
  additions: number
  deletions: number
  /** In lane order, left to right. */
  branches: MergeBranch[]
  /** Newest first. */
  commits: MergeCommit[]
  files: MergeConflictFile[]
  state: MergeConflictsState
  /** Paths already resolved while `state` is "resolving". */
  resolved?: string[]
  /** Merge the base in and resolve; omit to hide the button. */
  onResolve?: () => void
  /** Merge the pull request; omit to hide the button. */
  onMerge?: () => void
  /** "sm" inside a chat reply. */
  size?: WidgetSize
  className?: string
}

const LANE_COLORS = [
  "var(--muted-foreground)",
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
]

const LANE = 16
const PAD = 9

const BADGE: Record<
  MergeConflictsState,
  { tone: "attention" | "neutral" | "success" | "brand"; label: string }
> = {
  conflict: { tone: "attention", label: "Conflicts" },
  resolving: { tone: "neutral", label: "Resolving" },
  resolved: { tone: "success", label: "Ready to merge" },
  merging: { tone: "success", label: "Ready to merge" },
  merged: { tone: "brand", label: "Merged" },
}

type Segment = { d: string; color: string; dashed?: boolean }

// Every edge child → parent becomes one segment per row it crosses, so each
// row draws its own slice of the graph and a row added on top never shifts
// a line out of place. Same lane: straight down. A merge's other parent:
// the line leaves the child at once and runs down the parent's lane. A
// branch's first commit: the line runs down its own lane and joins the
// parent on the parent's row.
function graphRows(
  commits: MergeCommit[],
  lane: (c: MergeCommit) => number,
  color: (lane: number) => string,
  row: number
) {
  const rows = commits.map(() => [] as Segment[])
  const index = new Map(commits.map((c, i) => [c.sha, i]))
  const x = (l: number) => PAD + l * LANE
  const mid = row / 2
  commits.forEach((c, i) => {
    c.parents.forEach((p, k) => {
      const j = index.get(p)
      if (j === undefined || j <= i) return
      const cl = lane(c)
      const pl = lane(commits[j])
      const run = cl === pl || k > 0 ? pl : cl
      const seg = { color: color(run), dashed: c.pending }
      const cx = x(cl)
      const px = x(pl)
      const rx = x(run)
      rows[i].push({
        ...seg,
        d:
          cl !== pl && k > 0
            ? `M${cx} ${mid}C${cx} ${row} ${px} ${mid} ${px} ${row}`
            : `M${cx} ${mid}V${row}`,
      })
      for (let r = i + 1; r < j; r++)
        rows[r].push({ ...seg, d: `M${rx} 0V${row}` })
      rows[j].push({
        ...seg,
        d:
          cl !== pl && k === 0
            ? `M${cx} 0C${cx} ${mid} ${px} 0 ${px} ${mid}`
            : `M${px} 0V${mid}`,
      })
    })
  })
  return rows
}

export function MergeConflicts({
  number,
  title,
  head,
  base,
  additions,
  deletions,
  branches,
  commits,
  files,
  state,
  resolved = [],
  onResolve,
  onMerge,
  size,
  className,
}: MergeConflictsProps) {
  const [hovered, setHovered] = React.useState<string | null>(null)
  const sm = size === "sm"
  const ROW = sm ? 32 : 36

  const laneOf = new Map(branches.map((b, i) => [b.id, i]))
  const colorOf = (l: number) =>
    branches[l]?.color ?? LANE_COLORS[l % LANE_COLORS.length]
  const lane = (c: MergeCommit) => laneOf.get(c.branch) ?? 0
  const rows = graphRows(commits, lane, colorOf, ROW)
  const width = PAD * 2 + (branches.length - 1) * LANE
  const branch = (id: string) => branches.find((b) => b.id === id)
  const headColor = colorOf(laneOf.get(head) ?? 0)
  const baseColor = colorOf(laneOf.get(base) ?? 0)

  // Only the two branches of the pull request carry a label, on their tip.
  const tips = new Map<string, string>()
  for (const id of [head, base]) {
    const tip = commits.find((c) => c.branch === id)
    if (tip) tips.set(tip.sha, id)
  }
  const byCommit = new Map(commits.map((c) => [c.sha, c]))
  const conflicted = state === "conflict" || state === "resolving"
  const theirs = new Set(conflicted ? files.map((f) => f.theirs) : [])
  const focus = files.find((f) => f.path === hovered)

  const fileState = (path: string) =>
    state === "conflict"
      ? "conflict"
      : state === "resolving" && !resolved.includes(path)
        ? resolved.length === files.findIndex((f) => f.path === path)
          ? "working"
          : "conflict"
        : "done"
  const hunks = files.reduce((n, f) => n + f.hunks.length, 0)

  return (
    <Widget size={size} className={cn("max-w-[600px]", className)}>
      <WidgetHeader>
        <GitPullRequestIcon className="size-4 shrink-0 text-muted-foreground" />
        <WidgetTitle className="min-w-0 truncate">{title}</WidgetTitle>
        <span className="shrink-0 eyebrow text-faint-foreground">
          #{number}
        </span>
        <WidgetActions>
          <StatusBadge tone={BADGE[state].tone}>
            {BADGE[state].label}
          </StatusBadge>
        </WidgetActions>
      </WidgetHeader>

      <WidgetPanel className={cn("flex flex-col", sm ? "py-2" : "py-3")}>
        <div role="list" className="flex flex-col">
          <AnimatePresence initial={false}>
            {commits.map((c, i) => {
              const l = lane(c)
              const color = colorOf(l)
              const merge = c.parents.length > 1
              const tip = tips.get(c.sha)
              const dimmed =
                focus !== undefined &&
                focus.ours !== c.sha &&
                focus.theirs !== c.sha
              return (
                <motion.div
                  key={c.sha}
                  role="listitem"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={enter}
                  data-dimmed={dimmed || undefined}
                  className="group/commit flex items-center gap-2 text-sm"
                  style={{ height: ROW }}
                >
                  <svg
                    width={width}
                    height={ROW}
                    viewBox={`0 0 ${width} ${ROW}`}
                    aria-hidden
                    className="shrink-0 overflow-visible"
                  >
                    {rows[i].map((s, k) => (
                      <path
                        key={k}
                        d={s.d}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeDasharray={s.dashed ? "2 3" : undefined}
                      />
                    ))}
                    <circle
                      cx={PAD + l * LANE}
                      cy={ROW / 2}
                      r={merge ? 4.25 : 3.5}
                      fill={merge && !c.pending ? color : "var(--card)"}
                      stroke={color}
                      strokeWidth={1.5}
                      strokeDasharray={c.pending ? "2 2" : undefined}
                    />
                  </svg>
                  <span className="flex min-w-0 flex-1 items-center gap-2 transition-opacity duration-200 group-data-dimmed/commit:opacity-45">
                    {tip && (
                      <span
                        className="shrink-0 rounded-full border px-1.5 eyebrow text-[10px]/4 max-sm:hidden"
                        style={{
                          color: colorOf(laneOf.get(tip) ?? 0),
                          borderColor: `color-mix(in oklab, ${colorOf(laneOf.get(tip) ?? 0)} 35%, transparent)`,
                        }}
                      >
                        {branch(tip)?.name}
                      </span>
                    )}
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate",
                        c.pending && "shimmer text-muted-foreground"
                      )}
                    >
                      {c.message}
                    </span>
                    {theirs.has(c.sha) && (
                      <span className="shrink-0 eyebrow text-attention max-sm:hidden">
                        Same lines
                      </span>
                    )}
                    <span className="shrink-0 eyebrow text-faint-foreground">
                      <span className="max-sm:hidden">{c.sha} · </span>
                      {c.author} · {c.time}
                    </span>
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </WidgetPanel>

      {files.length > 0 && (
        <WidgetPanel className="flex flex-col gap-1 pt-3">
          <div className="flex items-baseline justify-between gap-3 pb-1">
            <WidgetSectionTitle>
              {conflicted ? "Conflicts" : "Resolved"}
            </WidgetSectionTitle>
            <span className="eyebrow text-muted-foreground">
              {files.length} files · {hunks} hunks
            </span>
          </div>
          <div
            className="-mx-2 flex flex-col"
            onMouseLeave={() => setHovered(null)}
          >
            {files.map((f) => (
              <ConflictFile
                key={f.path}
                file={f}
                status={fileState(f.path)}
                oursLabel={`${byCommit.get(f.ours)?.author ?? "Yours"} · ${branch(head)?.name ?? head}`}
                theirsLabel={`${byCommit.get(f.theirs)?.author ?? "Theirs"} · ${branch(base)?.name ?? base}`}
                oursColor={headColor}
                theirsColor={baseColor}
                dimmed={hovered !== null && hovered !== f.path}
                onHover={() => setHovered(f.path)}
              />
            ))}
          </div>
        </WidgetPanel>
      )}

      <WidgetFooter>
        <WidgetMeta>
          {branch(head)?.name ?? head} → {branch(base)?.name ?? base} ·{" "}
          <span className="text-success">
            +{additions.toLocaleString("en-US")}
          </span>{" "}
          <span className="text-destructive">
            −{deletions.toLocaleString("en-US")}
          </span>
        </WidgetMeta>
        {state === "conflict" && onResolve && (
          <Button size="sm" className="ml-auto" onClick={onResolve}>
            Merge {branch(base)?.name ?? base} and resolve
          </Button>
        )}
        {(state === "resolved" || state === "merging") && onMerge && (
          <Button
            size="sm"
            className="ml-auto"
            disabled={state === "merging"}
            onClick={onMerge}
          >
            {state === "merging" ? "Merging…" : "Merge pull request"}
          </Button>
        )}
      </WidgetFooter>
    </Widget>
  )
}

function ConflictFile({
  file,
  status,
  oursLabel,
  theirsLabel,
  oursColor,
  theirsColor,
  dimmed,
  onHover,
}: {
  file: MergeConflictFile
  status: "conflict" | "working" | "done"
  oursLabel: string
  theirsLabel: string
  oursColor: string
  theirsColor: string
  dimmed: boolean
  onHover: () => void
}) {
  const dir = file.path.slice(0, file.path.lastIndexOf("/") + 1)
  const name = file.path.slice(dir.length)
  return (
    <Collapsible
      className="relative rounded-lg transition-opacity duration-200 before:pointer-events-none before:absolute before:inset-x-2 before:top-0 before:h-px before:bg-border/70 first:before:hidden data-dimmed:opacity-45"
      data-dimmed={dimmed || undefined}
      onMouseEnter={onHover}
    >
      <CollapsibleTrigger className="group/file flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left text-sm outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/30">
        <span className="flex size-3.5 shrink-0 items-center justify-center">
          {status === "done" ? (
            <CheckIcon className="size-3.5 text-success" />
          ) : (
            <StatusDot tone={status === "working" ? "neutral" : "attention"} />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs">
          <span className="text-muted-foreground">{dir}</span>
          <span className={cn(status === "working" && "shimmer")}>{name}</span>
        </span>
        <span className="shrink-0 eyebrow text-muted-foreground">
          {status === "done"
            ? file.outcome
            : `${file.hunks.length} ${file.hunks.length === 1 ? "hunk" : "hunks"}`}
        </span>
        <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/file:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pb-2.5">
        {/* Keyed by state: the resolved lines replace the two sides in place. */}
        <motion.div
          key={status === "done" ? "done" : "open"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={enter}
          className="flex flex-col gap-2"
        >
          {status === "done" && (
            <p className="text-sm text-muted-foreground">{file.note}</p>
          )}
          {file.hunks.map((h, i) =>
            status === "done" ? (
              <Code key={i}>
                {h.result.map((l, k) => (
                  <Line
                    key={k}
                    color={
                      l.from === "ours"
                        ? oursColor
                        : l.from === "theirs"
                          ? theirsColor
                          : "var(--success)"
                    }
                    className={cn(l.from === "new" && "bg-success/5")}
                  >
                    {l.text}
                  </Line>
                ))}
              </Code>
            ) : (
              <Code key={i}>
                <Side label={oursLabel} color={oursColor} lines={h.ours} />
                <Side
                  label={theirsLabel}
                  color={theirsColor}
                  lines={h.theirs}
                />
              </Code>
            )
          )}
        </motion.div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="flex flex-col overflow-x-auto rounded-lg border border-border/70 bg-muted/30 py-1.5 font-mono text-xs leading-5">
      {children}
    </pre>
  )
}

function Side({
  label,
  color,
  lines,
}: {
  label: string
  color: string
  lines: string[]
}) {
  return (
    <>
      <span className="px-3 pt-1 eyebrow text-[10px]/5" style={{ color }}>
        {label}
      </span>
      {lines.map((l, k) => (
        <Line key={k} color={color}>
          {l}
        </Line>
      ))}
    </>
  )
}

// One code line with a 2px bar in the colour of the side it came from.
function Line({
  color,
  className,
  children,
}: {
  color: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <span className={cn("relative block px-3 whitespace-pre", className)}>
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-0.5"
        style={{ background: color }}
      />
      {children || " "}
    </span>
  )
}
