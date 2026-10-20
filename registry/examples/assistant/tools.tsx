import { BanIcon, ListChecksIcon } from "lucide-react"

import { BarSeries } from "@/components/ds/bar-series"
import { ChartCard } from "@/components/parts/chart-card"
import { FileBadge } from "@/components/parts/attachment"
import { Findings } from "@/components/parts/findings"
import { Plan } from "@/components/parts/plan"
import { AiSpend } from "@/components/blocks/ai-spend"
import { Surface } from "@/components/surface/surface"
import { surfaceFromMessages } from "@/components/surface/store"
import { uiaCatalog } from "@/components/catalog"

import { Trace } from "@/components/ui/trace"
import { TranscriptEvent, ResolvedRow } from "@/components/parts/action-card"
import { AskUser, AskUserAnswered } from "@/components/parts/ask-user"
import { Confirmation } from "@/components/parts/confirmation"
import { DraftCard } from "@/components/parts/draft-card"
import { PartTransition } from "@/components/parts/part-transition"
import { SearchResults } from "@/components/parts/search-results"
import { ToolLine, toolPhase } from "@/components/parts/tool-line"
import { defineData, defineTools } from "@/components/chat/tool-registry"
import type { ChatMessage } from "@/examples/assistant/scripts"

// How the demo app renders its tools. This is exactly what a consuming app
// writes: one entry per tool, built from parts.

export const tools = defineTools<ChatMessage>()({
  // Server tool: a quiet trace line that expands to the results.
  webSearch: {
    phase: "searching",
    render: (part) => (
      <Trace>
        <ToolLine
          part={part}
          titles={{
            running: `Searching “${part.input?.query ?? ""}”`,
            done: "Searched the web",
            error: "Search failed",
            denied: "Search skipped",
          }}
          description={part.output ? `${part.output.results.length} results` : undefined}
        >
          {part.output && (
            <SearchResults query={part.input.query} results={part.output.results} />
          )}
        </ToolLine>
      </Trace>
    ),
  },

  // Client tool: the person answers; the turn continues on submit.
  askQuestions: {
    client: true,
    render: (part, ctx) => {
      if (part.state !== "input-available" && part.state !== "output-available") return null
      return (
        <PartTransition state={part.state}>
          {part.state === "output-available" ? (
            <AskUserAnswered questions={part.input.questions} answers={part.output.answers} />
          ) : (
            <AskUser
              questions={part.input.questions}
              onSubmit={(answers) => ctx.addOutput({ answers })}
              onSkip={() => ctx.addOutput({ answers: {} })}
            />
          )}
        </PartTransition>
      )
    },
  },

  // Client tool: the draft is the approval; edits ride along in the output.
  composeDraft: {
    client: true,
    render: (part, ctx) => {
      if (part.state !== "input-available" && part.state !== "output-available") return null
      const status = part.state === "output-available" ? part.output.status : "ready"
      return (
        <PartTransition state={status}>
          <DraftCard
            draft={part.input}
            state={status}
            sentBody={part.state === "output-available" ? part.output.body : undefined}
            onSend={(body) => ctx.addOutput({ status: "sent", body })}
            onDiscard={() => ctx.addOutput({ status: "discarded" })}
          />
        </PartTransition>
      )
    },
  },

  // Server tool with a visual answer: a trace line, then the chart itself.
  queryAnalytics: {
    phase: "working",
    render: (part) => (
      <>
        <Trace>
          <ToolLine
            part={part}
            titles={{
              running: "Querying analytics",
              done: "Queried analytics",
              error: "Query failed",
              denied: "Query skipped",
            }}
            description={part.input?.range}
          />
        </Trace>
        {part.state === "output-available" && (
          <ChartCard
            title={part.output.title}
            stats={[
              { label: "Total", value: part.output.total.toLocaleString("en-US") },
              {
                label: "vs first week",
                value: `${part.output.change >= 0 ? "+" : ""}${(part.output.change * 100).toFixed(1)}%`,
                tone: part.output.change >= 0 ? "success" : "destructive",
              },
              { label: "Median", value: part.output.median.toLocaleString("en-US") },
              { label: "Peak", value: part.output.peak.toLocaleString("en-US") },
            ]}
          >
            <BarSeries data={part.output.series} format={(v) => v.toLocaleString("en-US")} />
          </ChartCard>
        )}
      </>
    ),
  },

  // Client tool answered outside the transcript: the app docks a
  // ConnectPrompt above the composer while this part waits.
  connectApp: {
    client: true,
    render: () => null,
  },

  // A screen the agent composed for this question (A2UI messages against
  // the uia catalog). Client tool: the person's action is the output, and
  // the turn continues with it.
  renderUI: {
    client: true,
    render: (part, ctx) => {
      const surface = surfaceFromMessages(part.input?.messages as unknown[] | undefined)
      const answered = part.state === "output-available"
      return (
        <div className={answered ? "pointer-events-none opacity-60 transition-opacity" : undefined}>
          <Surface
            surface={surface}
            catalog={uiaCatalog}
            size="sm"
            onAction={(a) => !answered && ctx.addOutput({ name: a.name, context: a.context })}
          />
        </div>
      )
    },
  },

  // A whole widget as the answer: the same AiSpend the dashboard renders,
  // fed by the tool's output, at message density.
  reportSpend: {
    phase: "working",
    render: (part) => (
      <>
        <Trace>
          <ToolLine
            part={part}
            titles={{ running: "Reading usage", done: "Read usage", error: "Couldn't read usage", denied: "Skipped" }}
            description={part.input?.period}
          />
        </Trace>
        {part.state === "output-available" && (
          <AiSpend size="sm" models={part.output.models} periods={part.output.periods} budget={part.output.budget} />
        )}
      </>
    ),
  },

  // Reading a file the person attached: trace line, then what it found.
  readFile: {
    phase: "working",
    render: (part) => (
      <>
        <Trace>
          <ToolLine
            part={part}
            titles={{
              running: `Reading ${part.input?.name ?? "the file"}`,
              done: `Read ${part.input?.name ?? "the file"}`,
              error: "Couldn't read the file",
              denied: "Reading skipped",
            }}
            description={part.input?.pages ? `${part.input.pages} pages` : undefined}
          />
        </Trace>
        {part.state === "output-available" && (
          <Findings
            title={part.output.title}
            icon={<FileBadge name={part.input.name} />}
            items={part.output.findings}
          />
        )}
      </>
    ),
  },

  // Approval-gated server tool: ask → running → resolved record.
  createIssues: {
    render: (part, ctx) => {
      const issues = part.input?.issues ?? []
      const phase = toolPhase(part)
      const state = part.state === "approval-requested" ? "ask" : phase === "running" ? "running" : "done"
      const ids = part.state === "output-available" ? part.output.ids : []

      return (
        <PartTransition state={state}>
          {state === "ask" ? (
            <Confirmation
              title={`Assistant wants to create ${issues.length} issues in ${part.input?.tracker}`}
              description="One per checklist row, assigned to its owner."
              detailsLabel="issues"
              details={
                <ul className="divide-y divide-border/70">
                  {issues.map((issue) => (
                    <li key={issue?.title} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="truncate">{issue?.title}</span>
                      <span className="shrink-0 eyebrow text-muted-foreground">{issue?.owner}</span>
                    </li>
                  ))}
                </ul>
              }
              note="You can close or edit them in Linear afterwards."
              onAllow={() => ctx.respond(true)}
              onAlwaysAllow={() => ctx.respond(true)}
              onDeny={() => ctx.respond(false)}
            />
          ) : state === "running" ? (
            <TranscriptEvent icon={<ListChecksIcon />}>
              <span className="shimmer">Creating {issues.length} issues…</span>
            </TranscriptEvent>
          ) : (
            <ResolvedRow
              icon={phase === "denied" ? <BanIcon /> : <ListChecksIcon />}
              label={part.input?.tracker ?? "Tracker"}
              summary={
                phase === "denied"
                  ? `Denied · create ${issues.length} issues`
                  : `Created ${issues.length} issues · ${ids[0]} – ${ids.at(-1)}`
              }
              muted={phase === "denied"}
            >
              <ul className="flex flex-col divide-y divide-border/70 pt-1">
                {issues.map((issue, i) => (
                  <li key={issue?.title} className="flex items-center gap-3 py-1.5 first:pt-0 last:pb-0">
                    {ids[i] && <span className="shrink-0 eyebrow text-muted-foreground">{ids[i]}</span>}
                    <span className="min-w-0 flex-1 truncate">{issue?.title}</span>
                    <span className="shrink-0 eyebrow text-faint-foreground">{issue?.owner}</span>
                  </li>
                ))}
              </ul>
            </ResolvedRow>
          )}
        </PartTransition>
      )
    },
  },
})

// Data parts: state streamed alongside the reply. The plan updates in place
// (same id) as each step lands.
export const data = defineData<ChatMessage>()({
  plan: (plan) => <Plan title={plan.title} steps={plan.steps} />,
})

