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
  panels). Never add a grey page or decorative backdrop. Inside a message, cards use a faint `bg-muted/30` with no shadow (ActionCard) or
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
- **Moves show where things went.** In a list that isn't a streaming
  transcript (an inbox, a queue, a board), acting on an item never makes it
  blink away: it leaves toward where it goes (an answered card sinks toward
  "Answered today": `exit={{ opacity: 0, y: 20, scale: 0.98 }}`), the items
  around it glide into the gap (`layout="position"` with `springSoft`,
  inside `AnimatePresence mode="popLayout"` + `LayoutGroup`, sections
  too), and it arrives from the direction it came (`y: -12` from above),
  glowing once (`bg-muted` fading over ~1 s) so the eye finds it. Newest
  first, so the trip is short. Undo plays it backwards.
- **Chat turns animate themselves.** `ChatTurn` plays the entrance: what
  the person sends lands with a fade, a 8px lift and a blur clearing; the
  answer follows 120 ms later; a thread's history (opened, reloaded) just
  appears. Don't add your own wrapper animations around turns.
- **Navigation icons nudge on hover**: one small gesture per icon that says
  what the place is (inbox drops, layers lift, history rewinds, scale
  weighs), played once per hover, never looping — motion variants on the
  button, see `NUDGE` in `example-davinci`. A conversation entry uses the
  still `AgentOrb` (no chat-bubble icon) and wakes it on hover. Don't size
  nav icons with `[&_svg]:size-4` on the button: it shrinks the orb too.
- **Verbs for actions, switches for policies.** Something done once
  (approve, revert, deploy) is a button whose label is the verb. Something
  that stays on until changed (a rule, an automation, a fallback) is a
  `Switch`, with the whole row as its label; the off state says its effect
  in the meta line ("Off · these come back to your inbox"). No confirmation
  for a switch: it's undoable by flipping it back.
- **Separators are straight hairlines.** A `border-t` on a rounded row
  curls up at both ends; draw the line inside the padding instead
  (`WidgetListRow` does). Never put a border on one side of a rounded box.
- **A widget is a component with props; demo data lives outside.** Build
  data views as pure components (`components/blocks/*`: data in via props,
  UI state inside, actions out via callbacks, pending states as props) and
  keep fixtures and simulations in the example. The same component renders
  on a page and, at `Widget size="sm"`, inside a chat reply — one shell,
  two densities, never a chat-only copy.
- **Name by form or by agent role, never by product subject.** uia is for
  any product: `Stepper`, `Stat`, `Meter` (form); `DecisionCard`,
  `Confirmation`, `Plan`, `ActivityItem` (agent interaction). "Incident",
  "task", "deploy", "spend" are a product's words: they live in that
  product's catalog (`extendCatalog`) or as a block, not in uia's core.
- **shadcn first.** Before building a piece, check the shadcn catalog
  (`bunx shadcn add <name>`): Badge, Alert, Sheet, Attachment, Marker,
  HoverCard, Table, Tabs, Field… uia's pieces are built on them
  (`StatusBadge` = Badge, `ChatError` = Alert, `AttachmentChip` =
  Attachment, `TranscriptEvent` = Marker). Keep uia's look and motion with
  `className` on top of the shadcn API; customise the copied file only when
  that can't work.
- **Every screen has an address.** In an app, each view and sub-view is a
  route (`/app/rules`, `/app/threads/blog`): reload keeps the place, back
  and forward work, a link can point at it. Views take `view` +
  `onViewChange` from the router rather than holding it in state; the logo
  or orb goes home. Simulations and modes ride in the query (`?busy`).
- **An app carries its own theme toggle** (sun/moon ghost icon button at
  the foot of the side nav, in the header on phones), using `useTheme`
  from `theme-provider`. Don't rely on the host page to offer it.
- **Design for load.** Before calling a list done, run it with ten times
  the data (dozens of tasks, not three). What needs the person sorts
  first, the list folds after a handful ("Show 20 more" in the footer), and
  an aggregate carries the shape (counts per stage under the stage names,
  "22 in flight · 4 queued" in the header). Keep that simulation behind a
  dashed "Simulation" switch or a URL flag, never in the default state.
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
the AI SDK `needsApproval` flow and `ctx.respond`. State that isn't a tool
call (a plan's progress) is a data part rendered through `defineData`;
same `id` = updated in place. Full wiring: `references/chat.md`.

Don't reinvent the common moments; each has a part and a place
(`chat.md` → "The moments every chat needs"): toggles that light while the
agent uses them, attachments with a hover gist, a chart in the reply, a
`Plan` that ticks off, `ConnectPrompt` docked above the composer,
`ChatError` with a retry that can switch model, Regenerate, and `ChatPill`
when minimised.

When nothing prebuilt fits, the agent **composes a surface**: A2UI v0.9
messages against the uia catalog (layout, data, display, input and whole
blocks), rendered by `<Surface>` on a page or `size="sm"` in a reply. The
agent sends names, enums and data, never styling or code. Read
`references/surfaces.md` before building agent-composed screens.

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
- [ ] Reloaded on every view: you stay where you were; back/forward work.
- [ ] Ran it with 10× the data: nothing truncates into nonsense, what needs
      the person is on top, long lists fold.
- [ ] Every switch, toggle and icon has its hover/focus state; the theme
      toggle is reachable from the app itself.
- [ ] Console clean after a fresh reload.
- [ ] Re-read `references/pitfalls.md` for anything you touched.

## References

- `references/examples.md` — the reference widgets: what each shows, how to install and copy them. Open first.
- `references/grammar.md` — the moves the examples are made of: anatomy, hero, lists as legends, data viz, copy, spacing, pages, mobile, agent apps (inbox, threads, rules).
- `references/tokens.md` — every token, what it means, when to use it.
- `references/components.md` — catalog: what to reach for, imports, examples, registry item names.
- `references/hitl.md` — the human-in-the-loop patterns, states and copy.
- `references/chat.md` — `useAgentChat`, the tool registry, assembling a chat (full page that opens from its pill).
- `references/adopting.md` — bringing uia into an existing app: replace its UI layer (keep contracts and transport; one adapter maps its blocks to uia parts) or adopt piece by piece.
- `references/surfaces.md` — agent-composed UI: the A2UI format, the uia catalog, rendering, streaming, actions, extending.
- `references/pitfalls.md` — real bugs met while building uia and how to avoid them.
