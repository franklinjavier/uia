---
name: uia
description: Build AI-product interfaces with the uia design system (shadcn + Base UI) — chat UIs, generative-UI parts rendered inside a conversation, human-in-the-loop moments (clarifying questions, editable drafts, approvals, resolved records), agent status, widgets and dashboards. Use this whenever the project has uia components (src/components/{ds,parts,chat}, `franklinjavier/uia` in registry deps, tokens like --attention/--surface/--faint-foreground) or the user asks for a chat, assistant, agent, tool-call UI, approval card, prompt box, AI widget or any screen in such a project — even if they never say "uia" or "design system". Also use it to review or polish UI built with uia.
---

# uia

uia is a design system for AI products. It already encodes the taste: calm
greys, one ink for actions, one colour for "this needs you", mono micro-labels,
white pages with hairline cards and quiet motion. Your job is not to invent a style but
to compose the existing pieces so the result looks like the designer built it.

## How to work

1. **Find what exists.** Read `src/components/{ui,ds,parts,chat}` in the
   project. If a piece you need is missing, install it from the registry
   before writing anything (`npx shadcn@latest add franklinjavier/uia/<item>`,
   items listed in `references/components.md`). Writing a lookalike by hand is
   how systems drift. Check the setup once: the main CSS imports
   `./typeset.css` after Tailwind, the app is wrapped in `TooltipProvider`,
   and `AGENTS.md` has a "UI: uia design system" section pointing at
   `.agents/skills/uia/SKILL.md` (with `CLAUDE.md` importing `@AGENTS.md`)
   so the next agent finds this skill; add whichever is missing, appending,
   never replacing.
2. **Start from the closest example.** uia ships complete widgets built by
   the designer (`references/examples.md`; install with
   `npx shadcn@latest add franklinjavier/uia/examples`). Open the one closest
   to the request, render it, and copy its structure — anatomy, panel split,
   spacing, the pieces that carry the data — then change the content. The
   moves behind them are in `references/grammar.md`. Rules alone don't make
   screens look related; imitating the examples does.
3. **Pick the pattern before the pixels.** Is this a widget, a chat, or a
   moment inside a chat? For anything where the agent needs the person, read
   `references/hitl.md` first; the pattern decides the components.
4. **Compose parts, don't restyle them.** Every component is a set of parts
   (`Widget` → `WidgetHeader`/`WidgetPanel`/`WidgetFooter`, `ActionCard` →
   `ActionCardHeader`/`…Status`/`…Panel`/`…Actions`). Arrange parts and pass
   `className` for layout only (gap, width, padding). If you are overriding
   colours, radii or font sizes, stop: use a token or a variant instead
   (`references/tokens.md`).
5. **Use the tokens by meaning.** `brand` = the primary action (ink).
   `attention` = something waits on the person. Semantic tones only for state.
   Never use a colour because it looks nice.
6. **Verify in the browser**, light and dark, by walking the real flow (see
   the checklist below). Most of what makes uia feel right — spacing, motion,
   states — is only visible when it runs.

## The look, in rules (and why)

- **Hierarchy by size and colour, not weight.** Titles are 15–16px regular;
  numbers are large and light. Bold is rare. Heavy weights make the calm
  surfaces look shouty.
- **Mono uppercase `eyebrow` is the second voice**: labels, units, meta lines,
  provider names, counters (`<span className="eyebrow text-muted-foreground">`).
  It carries metadata so body text can stay plain.
- **No frames by default.** The page is plain `background` (white); a
  `Widget` is just header + white panels + footer, aligned on one edge. Use
  `<Widget variant="framed">` (grey `surface` shell + shadow) only when the
  widget must read as an object among neighbours (dashboards, floating
  panels). Never add a grey page or decorative backdrop. Inside a message, cards use `bg-muted/60` (ActionCard) or
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
- **Every control does something.** No info icons, settings sliders, close
  buttons, ⋮ menus or status footers that are only there to look complete.
  If it has no action or no information the person needs, leave it out;
  empty space is fine.
- **Build what was asked.** A widget request gets a widget: no page header,
  breadcrumb, tagline or hero copy around it. A page request gets a page
  (`references/grammar.md` §8).
- **No instructions on screen.** "Select a suite to filter", "Hover a GPU",
  "Click a node to focus" are signs the affordance is weak; make it
  discoverable instead (hover state, cursor, the visual reacting).
- **Don't label the data as fake.** No "demo", "sample data", "no API
  connected" pills or footers; mock data should look like real data.
- **Colour only what needs a look.** In a list of deltas, regressions get a
  tone; improvements stay muted. A column of green badges is noise.
- **Adapting a reference or mockup:** keep its structure and behaviour, not
  its decoration. Its accent colour becomes `brand` (ink); its "needs you"
  moments become `attention`; repeated indicators (a dot *and* a badge for
  the same state) collapse into one.
- **Say each fact once.** If the meter already reads "86% used", the label,
  the meta line and the alert don't repeat it; each says something new
  (what's left, when it resets, what to do). Repetition is noise that
  competes with the one line that matters.
- **Tone escalates with severity.** `neutral` → `warning` (getting close) →
  `destructive` (over, failed, blocked). Each step changes the colour *and*
  the words; two states with the same tone read as the same state.
- **Speak the user's language and locale.** Copy, currency, dates and number
  formats follow the product's audience (e.g. pt-BR → "R$ 1.287,05",
  "20 de out."), not the model's defaults. If it isn't clear, follow the
  language the request was written in.

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

**Review it like the designer would.** Screenshot your screen and the
closest example side by side, light and dark, and ask: does it look like
the same person made both? Check the hero (one number, its limit visible,
a meta line), the list (titled, eyebrow headers, linked to the visual),
the footer (live meta, one action), the spacing, and that nothing on screen
is decoration. Fix what differs before reporting.

- [ ] Started from the closest example and kept its structure.
- [ ] Every piece came from the project or the registry; no hand-made lookalikes.
- [ ] No hard-coded colours, radii or font sizes; tokens and variants only.
- [ ] Ran it: light **and** dark, at the real container size, and on a phone
      (375 px emulated; nothing sticks out, nothing is crushed — grammar §9).
- [ ] Walked every state: empty, streaming, waiting on the person, each answer
      (approve, deny, discard, skip), resolved, error.
- [ ] Typecheck the app for real: in the Vite template `tsc --noEmit` on the
      root config checks nothing (`files: []`); run
      `tsc -p tsconfig.app.json --noEmit`.
- [ ] Console clean after a fresh reload.
- [ ] Re-read `references/pitfalls.md` for anything you touched.

## References

- `references/examples.md` — the reference widgets: what each shows, how to install and copy them. Open first.
- `references/grammar.md` — the moves the examples are made of: anatomy, hero, lists as legends, data viz, copy, spacing.
- `references/tokens.md` — every token, what it means, when to use it.
- `references/components.md` — catalog: what to reach for, imports, examples, registry item names.
- `references/hitl.md` — the human-in-the-loop patterns, states and copy.
- `references/chat.md` — `useAgentChat`, the tool registry, assembling a chat (widget or full page).
- `references/pitfalls.md` — real bugs met while building uia and how to avoid them.
