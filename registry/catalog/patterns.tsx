import * as React from "react"
import { z } from "zod"
import { BanIcon, CheckIcon, EyeIcon } from "lucide-react"

import {
  ActionCardFields,
  ActionCardPanel,
  ResolvedRow,
} from "@/components/parts/action-card"
import {
  ActivityItem as ActivityItemView,
  ActivityList as ActivityListView,
} from "@/components/parts/activity"
import { Citation as CitationView } from "@/components/parts/citation"
import { Confirmation as ConfirmationView } from "@/components/parts/confirmation"
import { DecisionCard as DecisionCardView } from "@/components/parts/decision-card"
import { DecisionChip as DecisionChipView } from "@/components/parts/decision-chip"
import { Diff as DiffView } from "@/components/parts/diff"
import { Findings as FindingsView } from "@/components/parts/findings"
import { PartTransition } from "@/components/parts/part-transition"
import { Plan as PlanView } from "@/components/parts/plan"
import {
  Policy as PolicyView,
  PolicyList as PolicyListView,
} from "@/components/parts/policy"
import { PreviewApproval } from "@/components/parts/preview-approval"
import { StatusCard as StatusCardView } from "@/components/parts/status-card"
import {
  action,
  children,
  defineComponent,
  type RenderContext,
} from "@/components/surface/catalog"
import type { ActionSpec } from "@/components/surface/types"

// Patterns: compound uia pieces the agent only fills. Named by form or by
// role in an agent interaction (a confirmation, a status, an activity
// entry, a policy), never by product subject. The agent should prefer one
// when it matches the intent and compose from primitives otherwise: a
// filled pattern looks hand-made, a composition of primitives doesn't.
//
// Rules every entry follows:
// - Facts (counts, rates, money, dates) are listed in `facts`: bind-only.
// - Reversible / destructive come from the host (`ctx.actionInfo`), never
//   from a prop. A control whose event the host doesn't offer isn't drawn.
// - No styling props: enums (`tone`, `kind`) and data only.
// - A settled moment is `resolved` (host updates the data model): the
//   card shrinks to a ResolvedRow through PartTransition.

/* ------------------------------ shared ------------------------------- */

const fields = z
  .array(z.object({ label: z.string(), value: z.string() }))
  .describe(
    "Label/value specifics. Bind values that are facts ({path}) rather than writing them."
  )

const resolved = z
  .object({
    label: z.string(),
    summary: z.string(),
    declined: z
      .boolean()
      .optional()
      .describe("It didn't go ahead (denied, sent back): the row dims."),
  })
  .optional()
  .describe(
    "Set (by updating the data model) once it's settled: the card becomes one quiet row."
  )

const answers = z
  .array(
    z.object({
      label: z.string().describe("The verb: what clicking does."),
      kind: z.enum(["primary", "secondary"]).optional(),
      action,
    })
  )
  .optional()

/** Answers whose events the host offers, as part actions. */
function answerActions(
  list: z.infer<typeof answers>,
  ctx: RenderContext,
  confirmed = true
) {
  return (list ?? []).flatMap((a) => {
    const onClick = ctx.action(a.action, { confirmed })
    return onClick ? [{ label: a.label, kind: a.kind, onClick }] : []
  })
}

/** An action spec with extra context merged in (option ids, switch state). */
function withContext(
  spec: ActionSpec,
  extra: Record<string, unknown>
): ActionSpec {
  return {
    event: { ...spec.event, context: { ...spec.event.context, ...extra } },
  }
}

/* ------------------------------ entries ------------------------------ */

export const DecisionCard = defineComponent({
  name: "DecisionCard",
  kind: "pattern",
  description:
    "One decision the agent needs from the person: what, why, options with the agent's pick, the consequence, and the answers. Use for anything waiting on a judgment.",
  props: z.object({
    agent: z.string().optional(),
    eyebrow: z.string().optional(),
    title: z.string(),
    context: z.string().optional(),
    options: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          hint: z.string().optional(),
        })
      )
      .optional(),
    pick: z.string().optional(),
    chooseAction: action
      .optional()
      .describe(
        "Fired when an option is chosen; context.option is the option id."
      ),
    consequence: z.string().optional(),
    actions: z
      .array(
        z.object({
          label: z.string(),
          kind: z.enum(["primary", "secondary", "aside"]).optional(),
          action,
        })
      )
      .optional(),
    urgent: z.boolean().optional(),
    agreement: z
      .object({
        accepted: z.number(),
        total: z.number(),
        category: z.string().optional(),
      })
      .optional()
      .describe(
        "How often the person went with the agent's pick. A fact: bind it."
      ),
  }),
  facts: ["agreement"],
  render: (p, ctx) => (
    <DecisionCardView
      agent={p.agent}
      eyebrow={p.eyebrow}
      title={p.title}
      context={p.context}
      options={p.options}
      pick={p.pick}
      onChoose={(o) => {
        if (!p.chooseAction) return
        ctx.action(
          {
            event: {
              ...p.chooseAction.event,
              context: { ...p.chooseAction.event.context, option: o.id },
            },
          },
          { confirmed: true }
        )?.()
      }}
      consequence={p.consequence}
      // The host says whether the main answer can be undone, not the agent.
      irreversible={(p.actions ?? []).some(
        (a) =>
          a.kind !== "secondary" &&
          a.kind !== "aside" &&
          ctx.actionInfo(a.action)?.reversible === false
      )}
      urgent={p.urgent}
      agreement={p.agreement}
      actions={(p.actions ?? []).flatMap((a) => {
        const onClick = ctx.action(a.action, { confirmed: true })
        return onClick ? [{ label: a.label, kind: a.kind, onClick }] : []
      })}
    />
  ),
})

export const Plan = defineComponent({
  name: "Plan",
  kind: "pattern",
  description:
    "A multi-step job and where it is: steps todo → running → done (waiting = needs the person, failed). Update its data to tick steps off.",
  props: z.object({
    title: z.string(),
    steps: z.array(
      z.object({
        label: z.string(),
        status: z.enum(["todo", "running", "waiting", "done", "failed"]),
        detail: z.string().optional(),
      })
    ),
  }),
  render: (p) => <PlanView title={p.title} steps={p.steps} />,
})

export const Findings = defineComponent({
  name: "Findings",
  kind: "pattern",
  description:
    "What was pulled from a source, ranked by severity, each with its reference (page, line, timestamp) so it can be checked.",
  props: z.object({
    title: z.string(),
    items: z.array(
      z.object({
        text: z.string(),
        severity: z.enum(["high", "medium", "low"]),
        ref: z.string().optional(),
      })
    ),
  }),
  render: (p) => <FindingsView title={p.title} items={p.items} />,
})

export const Confirmation = defineComponent({
  name: "Confirmation",
  kind: "pattern",
  description:
    "A gate before something with side effects runs: who wants to do what, the specifics as fields, a trust note, and the two answers (allow, deny). The only place a destructive event may live besides DecisionCard.",
  props: z.object({
    title: z.string().describe("Who wants to do what, or what happened."),
    description: z.string().optional(),
    status: z
      .string()
      .optional()
      .describe('Pill text, default "Approval needed" ("Incident").'),
    fields: fields.optional(),
    note: z.string().optional().describe("Trust fine print, one line."),
    allowLabel: z
      .string()
      .optional()
      .describe('The verb ("Revert 3f2a1c"), default "Allow".'),
    denyLabel: z.string().optional(),
    action: action.optional().describe("Fired by the allow answer."),
    denyAction: action.optional().describe("Fired by the deny answer."),
    resolved,
  }),
  example: {
    id: "gate",
    component: "Confirmation",
    title: "Blog: production check failed after v12",
    status: "Incident",
    fields: { path: "/incident/fields" },
    allowLabel: "Revert 3f2a1c",
    denyLabel: "Keep and investigate",
    action: { event: { name: "revert", context: { commit: "3f2a1c" } } },
    denyAction: { event: { name: "keep" } },
  },
  render: (p, ctx) => (
    <PartTransition state={p.resolved ? "resolved" : "open"}>
      {p.resolved ? (
        <ResolvedRow
          icon={p.resolved.declined ? <BanIcon /> : <CheckIcon />}
          label={p.resolved.label}
          summary={p.resolved.summary}
          muted={p.resolved.declined}
        />
      ) : (
        <ConfirmationView
          title={p.title}
          description={p.description}
          status={p.status}
          note={p.note}
          allowLabel={p.allowLabel}
          denyLabel={p.denyLabel}
          onAllow={ctx.action(p.action, { confirmed: true })}
          onDeny={ctx.action(p.denyAction, { confirmed: true })}
        >
          {p.fields && p.fields.length > 0 && (
            <ActionCardPanel>
              <ActionCardFields size="sm" fields={p.fields} />
            </ActionCardPanel>
          )}
        </ConfirmationView>
      )}
    </PartTransition>
  ),
})

export const StatusCard = defineComponent({
  name: "StatusCard",
  kind: "pattern",
  description:
    "A state the person should know about, with the steps it went through and what comes next (an incident: detected → reverted → healthy; a deploy; a migration). Update its data to move steps; set resolved when it's over.",
  props: z.object({
    eyebrow: z.string().optional().describe("What it's about · what kind."),
    title: z.string(),
    tone: z
      .enum(["neutral", "success", "warning", "destructive"])
      .optional()
      .describe(
        "neutral → warning → destructive as it worsens; success when fine again."
      ),
    status: z.string().optional().describe('Pill text ("Reverting").'),
    steps: z.array(
      z.object({
        label: z.string(),
        status: z.enum(["done", "active", "waiting", "failed", "todo"]),
      })
    ),
    fields: fields.optional(),
    note: z.string().optional().describe("What happens next, one line."),
    actions: answers,
    resolved,
  }),
  render: (p, ctx) => (
    <PartTransition state={p.resolved ? "resolved" : "open"}>
      <StatusCardView
        eyebrow={p.eyebrow}
        title={p.title}
        tone={p.tone}
        status={p.status}
        steps={p.steps}
        fields={p.fields}
        note={p.note}
        actions={answerActions(p.actions, ctx)}
        resolved={p.resolved}
      />
    </PartTransition>
  ),
})

export const ActivityList = defineComponent({
  name: "ActivityList",
  kind: "pattern",
  description:
    "What the agent did for the person without asking: a titled list whose children are ActivityItem (usually a template over the data).",
  props: z.object({ title: z.string().optional(), children }),
  render: (p, ctx) => (
    <ActivityListView title={p.title} size={ctx.size}>
      {ctx.children(p.children)}
    </ActivityListView>
  ),
})

export const ActivityItem = defineComponent({
  name: "ActivityItem",
  kind: "pattern",
  description:
    "One thing the agent did for the person: when, about what, what, why, the rule that did it, and Undo while the host says it can be undone (otherwise Final). Put inside ActivityList.",
  props: z.object({
    time: z.string().describe("When, as the host formats it. A fact: bind it."),
    subject: z.string().optional().describe("What it was about."),
    what: z.string(),
    why: z.string().optional(),
    rule: z.string().optional().describe("The standing rule that decided."),
    undone: z.boolean().optional(),
    undoAction: action.optional(),
  }),
  facts: ["time"],
  render: (p, ctx) => {
    const onUndo =
      ctx.actionInfo(p.undoAction)?.reversible !== false
        ? ctx.action(p.undoAction)
        : undefined
    return (
      <ActivityItemView
        time={p.time}
        subject={p.subject}
        what={p.what}
        why={p.why}
        rule={p.rule}
        undone={p.undone}
        onUndo={onUndo}
      />
    )
  },
})

export const PolicyList = defineComponent({
  name: "PolicyList",
  kind: "pattern",
  description:
    "The standing rules the agent applies: a titled list whose children are Policy.",
  props: z.object({ title: z.string().optional(), children }),
  render: (p, ctx) => (
    <PolicyListView title={p.title} size={ctx.size}>
      {ctx.children(p.children)}
    </PolicyListView>
  ),
})

// The switch moves the moment it's flipped; the host's data catches up.
function PolicyEntry({
  on,
  onToggle,
  ...rest
}: Omit<React.ComponentProps<typeof PolicyView>, "labels">) {
  const [shown, setShown] = React.useState(on)
  const [prev, setPrev] = React.useState(on)
  if (prev !== on) {
    setPrev(on)
    setShown(on)
  }
  return (
    <PolicyView
      {...rest}
      on={shown}
      onToggle={
        onToggle &&
        ((next) => {
          setShown(next)
          onToggle(next)
        })
      }
    />
  )
}

export const Policy = defineComponent({
  name: "Policy",
  kind: "pattern",
  description:
    "A standing rule the agent applies on the person's behalf, as an on/off switch with its category and how often it applied. Flipping fires toggleAction with context.on. Put inside PolicyList.",
  props: z.object({
    text: z.string().describe("The rule, as a sentence."),
    category: z.string().optional(),
    applied: z
      .number()
      .int()
      .optional()
      .describe("Times it decided. A fact: bind it."),
    on: z.boolean(),
    toggleAction: action
      .optional()
      .describe("Fired on flip; context.on is the new state."),
  }),
  facts: ["applied"],
  render: (p, ctx) => {
    const spec = p.toggleAction
    const can = !!ctx.action(spec)
    return (
      <PolicyEntry
        text={p.text}
        category={p.category}
        applied={p.applied}
        on={p.on}
        onToggle={
          can && spec
            ? (on) => ctx.action(withContext(spec, { on }))?.()
            : undefined
        }
      />
    )
  },
})

export const Diff = defineComponent({
  name: "Diff",
  kind: "pattern",
  description:
    "A code change waiting for review: what it does in a few lines, then the hunks that matter per file, and the answers (approve, send back).",
  props: z.object({
    eyebrow: z.string().optional(),
    title: z.string(),
    status: z.string().optional().describe('Pill text ("High risk").'),
    summary: z
      .array(z.string())
      .optional()
      .describe("What the change does, one plain line each."),
    files: z.array(
      z.object({
        path: z.string(),
        lines: z
          .array(z.string())
          .describe(
            'Unified diff lines: "+ added", "- removed", else context.'
          ),
      })
    ),
    actions: answers,
    resolved,
  }),
  render: (p, ctx) => (
    <PartTransition state={p.resolved ? "resolved" : "open"}>
      <DiffView
        eyebrow={p.eyebrow}
        title={p.title}
        status={p.status}
        summary={p.summary}
        files={p.files}
        actions={answerActions(p.actions, ctx)}
        resolved={p.resolved}
      />
    </PartTransition>
  ),
})

const httpUrl = z
  .string()
  .regex(/^https?:\/\//, "http(s) URLs only")
  .describe("An http(s) URL.")

export const Citation = defineComponent({
  name: "Citation",
  kind: "pattern",
  description:
    "The evidence behind one claim: the quoted passage, its source (name + url, the host shown) and where in it (page, line, timestamp).",
  props: z.object({
    source: z.string().describe("The source's name."),
    url: httpUrl.optional(),
    quote: z.string().describe("The passage, verbatim."),
    ref: z.string().optional().describe('Where in the source ("P. 12").'),
  }),
  render: (p) => (
    <CitationView
      source={p.source}
      url={p.url}
      quote={p.quote}
      reference={p.ref}
    />
  ),
})

const image = z.object({
  src: z
    .string()
    .regex(/^(https?:\/\/|data:image\/)/, "http(s) or data:image URLs only"),
  alt: z.string().optional(),
})

export const BeforeAfter = defineComponent({
  name: "BeforeAfter",
  kind: "pattern",
  description:
    "A visual change waiting for the person's eye: before and after images, a link to the live preview, and two answers — accept, or ask for changes in words (context.note carries them).",
  props: z.object({
    title: z.string(),
    description: z.string().optional(),
    status: z
      .string()
      .optional()
      .describe('Pill text, default "Needs your eye".'),
    before: image,
    after: image,
    url: httpUrl.optional().describe("The live preview."),
    note: z.string().optional(),
    acceptLabel: z
      .string()
      .optional()
      .describe('Default "Accept and publish".'),
    acceptAction: action.optional(),
    changesAction: action
      .optional()
      .describe("Fired with the person's request; context.note is the text."),
    resolved,
  }),
  render: (p, ctx) => {
    const accept = ctx.action(p.acceptAction, { confirmed: true })
    const spec = p.changesAction
    const canChange = !!ctx.action(spec, { confirmed: true })
    const view = (img: z.infer<typeof image>) => (
      <img
        src={img.src}
        alt={img.alt ?? ""}
        className="size-full object-cover object-top"
      />
    )
    return (
      <PartTransition state={p.resolved ? "resolved" : "open"}>
        {p.resolved ? (
          <ResolvedRow
            icon={<EyeIcon />}
            label={p.resolved.label}
            summary={p.resolved.summary}
            muted={p.resolved.declined}
          />
        ) : (
          <PreviewApproval
            title={p.title}
            description={p.description}
            before={view(p.before)}
            after={view(p.after)}
            href={p.url}
            note={p.note}
            labels={{
              ...(p.status && { status: p.status }),
              ...(p.acceptLabel && { accept: p.acceptLabel }),
            }}
            onAccept={accept}
            onRequestChanges={
              canChange && spec
                ? (note) =>
                    ctx.action(withContext(spec, { note }), {
                      confirmed: true,
                    })?.()
                : undefined
            }
          />
        )}
      </PartTransition>
    )
  },
})

export const DecisionChip = defineComponent({
  name: "DecisionChip",
  kind: "pattern",
  description:
    "A pending decision, compact, for a 'needs you' strip (a Row or Grid of chips): kind · subject and what's asked in one line. Clicking fires openAction to open the full decision.",
  props: z.object({
    kind: z.string().describe('What kind of decision ("Preview", "Review").'),
    subject: z.string().describe("What it's about."),
    text: z.string().describe("What's being asked, one short line."),
    openAction: action,
  }),
  render: (p, ctx) => {
    const open = ctx.action(p.openAction)
    return open ? (
      <DecisionChipView kind={p.kind} subject={p.subject} onClick={open}>
        {p.text}
      </DecisionChipView>
    ) : null
  },
})

export const patterns = [
  DecisionCard,
  Confirmation,
  StatusCard,
  Plan,
  Findings,
  ActivityList,
  ActivityItem,
  PolicyList,
  Policy,
  Diff,
  Citation,
  BeforeAfter,
  DecisionChip,
]
