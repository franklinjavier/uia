---
name: uia
description: Build AI-product interfaces with the uia design system (shadcn + Base UI) — chat UIs, generative-UI parts rendered inside a conversation, human-in-the-loop moments (clarifying questions, editable drafts, approvals, resolved records), agent status, widgets and dashboards. Use this whenever the project has uia components (src/components/{ds,ai-elements,chat}, `franklinjavier/uia` in registry deps, tokens like --attention/--surface/--canvas) or the user asks for a chat, assistant, agent, tool-call UI, approval card, prompt box, AI widget or any screen in such a project — even if they never say "uia" or "design system". Also use it to review or polish UI built with uia.
---

# uia

uia is a design system for AI products. It already encodes the taste: calm
greys, one ink for actions, one colour for "this needs you", mono micro-labels,
card-in-card surfaces and quiet motion. Your job is not to invent a style but
to compose the existing pieces so the result looks like the designer built it.

## How to work

1. **Find what exists.** Read `src/components/{ui,ds,ai-elements,chat}` in the
   project. If a piece you need is missing, install it from the registry
   before writing anything (`npx shadcn@latest add franklinjavier/uia/<item>`,
   items listed in `references/components.md`). Writing a lookalike by hand is
   how systems drift.
2. **Pick the pattern before the pixels.** Is this a widget, a chat, or a
   moment inside a chat? For anything where the agent needs the person, read
   `references/hitl.md` first; the pattern decides the components.
3. **Compose parts, don't restyle them.** Every component is a set of parts
   (`Widget` → `WidgetHeader`/`WidgetPanel`/`WidgetFooter`, `ActionCard` →
   `ActionCardHeader`/`…Status`/`…Panel`/`…Actions`). Arrange parts and pass
   `className` for layout only (gap, width, padding). If you are overriding
   colours, radii or font sizes, stop: use a token or a variant instead
   (`references/tokens.md`).
4. **Use the tokens by meaning.** `brand` = the primary action (ink).
   `attention` = something waits on the person. Semantic tones only for state.
   Never use a colour because it looks nice.
5. **Verify in the browser**, light and dark, by walking the real flow (see
   the checklist below). Most of what makes uia feel right — spacing, motion,
   states — is only visible when it runs.

## The look, in rules (and why)

- **Hierarchy by size and colour, not weight.** Titles are 15–16px regular;
  numbers are large and light. Bold is rare. Heavy weights make the calm
  surfaces look shouty.
- **Mono uppercase `eyebrow` is the second voice**: labels, units, meta lines,
  provider names, counters (`<span className="eyebrow text-muted-foreground">`).
  It carries metadata so body text can stay plain.
- **Surfaces nest**: `canvas` (page) → `surface` (widget shell, `Widget`) →
  `card` (panels). Inside a message, cards use `bg-muted/60` (ActionCard) or
  `bg-card` with a hairline `border`. Prefer hairline borders over filled
  blocks; solid grey fills read as heavy (the user asked for minimalism).
- **One indicator per meaning.** The `AgentOrb` is the only thing that moves
  while the agent works; trace lines shimmer, they don't spin. Don't add icons
  that repeat what a word already says.
- **Buttons speak one language**: primary `default` (ink), secondary
  `secondary` (grey fill), tertiary `ghost`; in cards use `size="sm"`, pill
  shaped, left-aligned. The `brand` variant is for a widget's main CTA.
- **Numbers**: `tabular-nums` only on numeric cells/values — never on a whole
  row or table (in Inter it widens hyphens: "Re - issue").
- **Motion** comes from `@/lib/motion` (`springSnappy`, `springSoft`,
  `easeOut`, `enter`). Things appear where they land (fade + ≤4px lift). No
  layout animations inside a streaming transcript: content moves under them
  and they fly in from the top. When a part changes state, wrap it in
  `PartTransition`.
- **Errors point at what is missing**, in one quiet line, without painting
  fields red.

## Generative UI inside a chat

A reply is prose plus *parts*. Text, reasoning and sources render themselves
(`ChatTurn`/`ChatParts`). Every tool you add gets one entry in a typed
registry — that is where your UI goes:

```tsx
const tools = defineTools<MyMessage>()({
  searchDocs: { phase: "searching", render: (part) => <Trace><ToolLine … /></Trace> },
  askQuestions: { client: true, render: (part, ctx) => <AskUser … onSubmit={(a) => ctx.addOutput({ answers: a })} /> },
  deleteFiles: { render: (part, ctx) => <Confirmation … onAllow={() => ctx.respond(true)} onDeny={() => ctx.respond(false)} /> },
})
```

`client: true` marks tools the person completes (questions, drafts): the chat
waits on them and continues when `ctx.addOutput` is called. Approval tools use
the AI SDK `needsApproval` flow and `ctx.respond`. Full wiring:
`references/chat.md`.

## Human-in-the-loop in one paragraph

Ask before guessing (`AskUser`: one question at a time, A/B/C keys, free
answer, × to skip). A consequential draft *is* the approval (`DraftCard`:
fields + editable body + "Send email"/"Discard"). Side effects wait at a gate
(`Confirmation`: "Assistant wants to …" + "Approval needed" + Allow/Deny).
Once settled, every moment shrinks to a record that can reopen (`ResolvedRow`,
or the answered-question card for a single question); declined ones dim. Never
claim something happened that didn't. Details and copy rules:
`references/hitl.md`.

## Before you say it's done

- [ ] Every piece came from the project or the registry; no hand-made lookalikes.
- [ ] No hard-coded colours, radii or font sizes; tokens and variants only.
- [ ] Ran it: light **and** dark, at the real container size.
- [ ] Walked every state: empty, streaming, waiting on the person, each answer
      (approve, deny, discard, skip), resolved, error.
- [ ] Console clean after a fresh reload.
- [ ] Re-read `references/pitfalls.md` for anything you touched.

## References

- `references/tokens.md` — every token, what it means, when to use it.
- `references/components.md` — catalog: what to reach for, imports, examples, registry item names.
- `references/hitl.md` — the human-in-the-loop patterns, states and copy.
- `references/chat.md` — `useAgentChat`, the tool registry, assembling a chat (widget or full page).
- `references/pitfalls.md` — real bugs met while building uia and how to avoid them.
