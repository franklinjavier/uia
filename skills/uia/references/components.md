# Components

What to reach for, by job. Paths are the default shadcn aliases (`@/components/…`).
Install anything missing with:

```bash
npx shadcn@latest add franklinjavier/uia/<item>          # one piece (deps come along)
npx shadcn@latest add franklinjavier/uia/chat franklinjavier/uia/hitl   # bundles
```

Use `--overwrite` if the project already has stock `button`, `select`, … —
uia ships tuned versions. Then make sure `typeset.css` is imported after
Tailwind and the app is wrapped in `TooltipProvider`.

Every component accepts `className` and passes props through; every part has a
`data-slot` you can target from a parent (`*:data-[slot=…]:…`) instead of
forking the component.

## Contents

1. System pieces (`ds/`)
2. Generative-UI parts (`parts/`)
3. Chat kit (`chat/`)
4. Primitives (`ui/`)
5. Bundles and item names
6. Blocks (`blocks/`, product widgets) and the app shell (`app/`)

---

## 1. System pieces — `@/components/ds/*`

### Widget (`widget`)
A self-contained tool surface: header → panels → footer.

```tsx
<Widget className="max-w-[620px]">
  <WidgetHeader>
    <AgentOrb phase="idle" />
    <WidgetTitle>Knowledge base</WidgetTitle>
    <WidgetActions><Segmented …/></WidgetActions>
  </WidgetHeader>
  <WidgetPanel>…main content…</WidgetPanel>
  <WidgetPanel>…a second, separate block…</WidgetPanel>
  <WidgetFooter><WidgetMeta>Synced 2m ago</WidgetMeta></WidgetFooter>
</Widget>
```

- `Widget variant="plain"` (default): no shell; children gap 2; header and
  footer align with the panels' edge. Right inside chats and white pages.
- `Widget variant="framed"`: the floating shell (`rounded-3xl bg-surface p-1
  shadow-widget`, gap 1). For dashboards with neighbours, floating panels.
- `Widget size="sm"`: message density (header/footer `min-h-8`, title 14px
  medium, panels `p-3.5`, the `lg` stat steps down to 24px). The same widget
  inside a chat reply, a side panel or a dense grid. `ChartCard` and
  `Findings` are compositions of it; never build a second shell.
- `WidgetPanel`: `rounded-2xl bg-card p-5` hairline ring. Use several panels
  rather than dividers inside one.
- `WidgetHeader`/`WidgetFooter`: no card of their own; padding follows the
  variant (don't override it).
- `WidgetDescription` for one muted line under the title; `WidgetMeta` is
  eyebrow-styled.
- `WidgetSectionTitle`: a small heading inside a panel ("Routes", "Agents").
- `WidgetList` > `WidgetListHeader` + `WidgetListRow`: rows inside a panel,
  hairline between rows. Put the same `grid-cols-[…]` on the header and every
  row; header cells are `eyebrow text-muted-foreground`. A row with `onClick`
  becomes a button (`selected` → `bg-muted`); `dimmed` fades it.
- **One interaction for a list linked to a visual** (chart, graph,
  illustration): hovering a row previews it (other rows `dimmed`, the visual
  follows), clicking selects it. Don't invent another model per widget.

```tsx
<WidgetPanel className="flex flex-col pt-3">
  <WidgetList onMouseLeave={() => setHovered(null)}>
    <WidgetListHeader className={COLS}>
      <WidgetSectionTitle>Agents</WidgetSectionTitle>
      <span className="eyebrow text-right text-muted-foreground">Status</span>
    </WidgetListHeader>
    {agents.map((a) => (
      <WidgetListRow key={a.id} className={COLS}
        selected={a.id === selected}
        dimmed={hovered !== null && hovered !== a.id}
        onMouseEnter={() => setHovered(a.id)}
        onClick={() => setSelected(a.id)}>…</WidgetListRow>
    ))}
  </WidgetList>
</WidgetPanel>
```

### Stat (`stat`)
`Stat` > `StatLabel` (eyebrow) · `StatValue size="lg|sm"` (light, tabular) ·
`StatUnit` · `StatMeta` (mono, faint). Big numbers, never bold.

### Segmented (`segmented`)
Base UI toggle group with a moving thumb. `variant="mono"` (eyebrow labels,
for ranges like 1D/1W/1M) or `"sans"` (view switches).

```tsx
<Segmented value={range} onValueChange={setRange} variant="mono">
  <SegmentedItem value="7d">7D</SegmentedItem>
  <SegmentedItem value="30d">30D</SegmentedItem>
</Segmented>
```

### Status (`status`)
`StatusDot tone` and `StatusBadge tone` with tones `neutral | success | warning |
info | destructive | brand | attention`. Pulse only for live states.

### MeterBar (`meter-bar`)
A value against its limit, with the limit visible. One segment for a plain
meter, several for a breakdown; `markers` label thresholds; `highlighted`
fades the other segments (link it to the list's hover). `min` zooms into a
narrow range (pass rates 60–100%) so close markers don't collide.

```tsx
<MeterBar
  max={1500}
  segments={models.map((m) => ({ id: m.id, value: m.cost, color: m.color }))}
  markers={[{ value: 1200, label: "80%" }, { value: 1500, label: "Budget" }]}
  highlighted={hovered}
/>
```

### BarSeries (`bar-series`)
`<BarSeries data={[{ label: "W27", value: 812 }, …]} format={fmt} />` — one hue
(`chart-1`), bars at 30%, the one that matters (`highlight`, default the
latest) at full strength with its value above. Hover/focus a bar to read it;
the label row keeps only the first, last and hovered labels.

### Sparkline (`sparkline`)
`<Sparkline values={series} />` — line over a soft area, dashed mean, last
point marked. Pair with a big number and an eyebrow for the window ("Last 64 s").

### Stepper (`stepper`)
Where something is in a fixed sequence, on one line: dots joined by
hairlines, each `done | active | waiting | failed | todo`. Dots without
names are a puzzle: every track must have its stage names in view. In a
list, put them once in a header with `<StepperLabels stages={…} />`
(same grid as the tracks; when rows stack on narrow widths and the track
spans the row, give the stacked layout its own labels row too). A track that
stands alone (a detail panel) uses `<Stepper labeled />`. Over many tracks
(dozens of tasks), give each label a `count` (how many sit at that stage),
sort what needs the person first, and fold the list after a handful: the
counts show where work piles up without reading every row. Pass
`statusLabels` in the product's language for screen readers.

### TickMeter (`tick-meter`)
Progress as hairline ticks: `<TickMeter value={0.62} className="text-brand" />`.
Colour = `currentColor`.

### NumberTicker (`number-ticker`)
Animated number: `<NumberTicker value={n} format={(v) => v.toFixed(1)} />`.

### AgentOrb (`agent-orb`)
The agent's presence. `phase`: `idle | connecting | thinking | searching |
working | composing | waiting`; `size` 20/32/64; `active` (false = paused,
dimmed). It is **the** working indicator — one per live turn, plus optionally
one in the header/empty state. Don't add spinners next to it.

### ModelIcon (`model-icons`)
`<ModelIcon family="claude|openai|gemini|meta|grok" />`, monochrome,
`currentColor`. For model pickers and attributions.

---

## 2. Generative-UI parts — `@/components/parts/*`

Read `hitl.md` for when to use which. Summary:

| Component | Item | Job |
| --- | --- | --- |
| `ActionCard` + parts | `action-card` | The shape of every HITL moment. Compose your own cards from it. |
| `ResolvedRow` | `action-card` | A settled moment: one line, expandable record, `muted` when it didn't go ahead. |
| `TranscriptEvent` | `action-card` | Small centred line for in-progress or system events ("Creating 4 issues…"); shadcn `Marker` with a fade-in. A line with a rule on each side: `Marker variant="separator"`. |
| `AskUser` / `AskUserAnswered` / `AnswerKey` | `ask-user` | Clarifying questions → answered record. |
| `Confirmation` | `confirmation` | Ready-made approval gate; `allowLabel`/`denyLabel`/`status` take the action's own words ("Reverter para v41"); `children` for a fields panel. |
| `PreviewApproval` / `PreviewApprovalResolved` | `preview-approval` | A visual change waits for the person's eye: before/after, preview link, accept or ask for changes in words. |
| `DecisionChip` | `decision-chip` | A pending decision, compact, for a "needs you" strip outside the chat; opens the full card. |
| `StatusCard` | `status-card` | A state with its steps and what's next (an incident, a deploy, a migration): status pill, labelled `Stepper`, fields, note, optional answers; `resolved` collapses it to a `ResolvedRow`. Read-mostly; a gate with an answer is `Confirmation`. |
| `ActivityItem` / `ActivityList` | `activity` | What the agent did without asking: time, what, why, the rule that did it, Undo or "Final" — decided by the host, never the agent. |
| `Policy` / `PolicyList` | `policy` | A standing rule: a switch row (the whole row is the label), `applied` count, the off state says its effect. A rule is a switch, never a button. |
| `Diff` | `diff` | Code to review: summary, files with +/- lines, answers; resolves to a row. |
| `Citation` | `citation` | The evidence for one claim: source, quote, reference, link. |
| `Plan` | `plan` | A multi-step job the agent runs in front of you: steps `todo → running → done` (or `waiting` on the person, `failed`), a tick meter that fills, `3/4` counter. Stream it as a **data part** with a fixed `id` so it updates in place. |
| `ConnectPrompt` | `connect-prompt` | The agent needs access (Slack, a calendar): docked **above the composer**, not in the transcript; `ask → connecting → connected` in place, then says what happens next and leaves. Back it with a client tool that waits. |
| `Findings` + `SeveritySignal` | `findings` | What the agent pulled from a source, ranked by a 3-bar severity signal (the only colour), each with its reference ("P. 12") in mono so the claim can be checked. |
| `ChartCard` | `chart-card` | A chart inside a reply: title, the 2–4 numbers that answer the question, then the chart (`BarSeries`, `Sparkline`, `MeterBar`). |
| `AttachmentChip` / `AttachmentPreview` / `FileBadge` | `attachment` | Files: a pill chip (shadcn `Attachment` at `size="xs"`) with a type badge; `state="idle\|uploading\|processing\|error\|done"`; removable (`onRemove`) in the composer; wrap in `AttachmentPreview` (shadcn `HoverCard`: hover on mouse, tap on touch) for meta and the file's gist. For card-style attachments with media, use `@/components/ui/attachment` directly. |
| `DraftCard` / `DraftCardResolved` | `draft-card` | Editable draft that is its own approval. |
| `PartTransition` | `part-transition` | Animates a part between states (height + crossfade). |
| `ToolLine` + `toolPhase()` | `tool-line` | A tool call as a quiet trace line; expandable when done. |
| `Reasoning` | `reasoning` | "Thinking…/Thought 3s" collapsible. |
| `SourcesGrid` | `sources` | Source cards with favicon + host. |
| `SearchResults` | `search-results` | Result list inside an expanded ToolLine. |
| `Markdown` | `markdown` | Assistant prose with typeset + shiki code blocks. |

### ActionCard anatomy

```tsx
<ActionCard>
  <ActionCardHeader>
    <ActionCardTitle>Assistant wants to archive 12 threads</ActionCardTitle>
    <ActionCardStatus tone="approval">Approval needed</ActionCardStatus>
  </ActionCardHeader>
  <ActionCardDescription>Older than 90 days, no replies.</ActionCardDescription>
  <ActionCardDisclosure show="Show the threads" hide="Hide the threads">
    <ActionCardPanel>…list…</ActionCardPanel>
  </ActionCardDisclosure>
  <ActionCardPanel>
    <ActionCardFields fields={[{ label: "From", value: "Inbox" }, { label: "To", value: "Archive" }]} />
  </ActionCardPanel>
  <ActionCardNote>You can restore them from Archive.</ActionCardNote>
  <ActionCardActions>
    <Button size="sm">Archive</Button>
    <Button size="sm" variant="secondary">Not now</Button>
  </ActionCardActions>
</ActionCard>
```

`ActionCardStatus tone`: `approval` / `action` (attention + spinner, waiting on
the person), `ready`, `done`, `error`, `neutral`.
`ActionCardFields size="sm"` for dense key/value rows.
`ActionCard tone="attention"`: a faint warm glow in two opposite corners for
the one decision that can't wait (an incident, a "Now" item). Never on every
card: when everything glows, nothing does. When the person answers, set
`tone="default"` first and let the glow drain (~300 ms) before the card
resolves or leaves; the fade is the acknowledgement.

### ToolLine

```tsx
<Trace>
  <ToolLine
    part={part}
    titles={{ running: "Reading the changelog", done: "Read the changelog", error: "Couldn't read the changelog", denied: "Skipped the changelog" }}
    description={part.output ? `${part.output.items.length} entries` : undefined}
  >
    {part.output && <MyDetails items={part.output.items} />}
  </ToolLine>
</Trace>
```

Present tense while running, past tense when done. No icon. Children make it
expandable.

---

## 3. Chat kit — `@/components/chat/*`

| Export | Item | Job |
| --- | --- | --- |
| `useAgentChat` | `agent-chat` | `useChat` + `busy`, `waiting`, `phase`, `activeIndex`, `state`; auto-continues after client tools/approvals. |
| `defineTools`, `ToolContext` | `agent-chat` | Typed tool → UI registry. |
| `ChatThread`, `ChatThreadItem` | `chat-thread` | Scrolling transcript with anchoring and scroll-to-bottom. |
| `ChatTurn`, `UserTurn`, `AssistantTurn`, `ChatParts` | `chat-turn` | Renders a message: text, reasoning, sources, and your tools. |
| `TurnActions`, `TurnAction`, `TurnActionsRow` | `turn-actions` | Copy / vote row under a finished turn. |
| `Composer` + `ComposerInput`, `ComposerToolbar`, `ComposerAttach`, `ComposerMic`, `ComposerModelSelect`, `ComposerSubmit`, `ComposerButton` | `composer` | The prompt box. |
| `ChatEmpty`, `ChatSuggestion` | `chat-empty` | Empty state: orb, greeting, suggestions as staggered rows. |
| `ChatStatus` | `chat-status` | Dot + mono status line (for widget footers). |

Wiring is in `chat.md`.

---

## 4. Primitives — `@/components/ui/*`

Standard shadcn (Base UI flavour). uia tunes: `button` (adds `brand` variant),
`select` (card trigger, padded list), `bubble` (slimmer user bubble),
`code-block` (light inset), `questionnaire` (denser), `spinner` (thin arc),
`message-scroller` (fade edges). Also used: `message`, `trace`, `input-group`,
`empty`, `item`, `collapsible`, `tooltip`, `kbd`, `separator`.

Button language:

| Role | Variant | Size in cards |
| --- | --- | --- |
| Primary (the thing the card is for) | `default` | `sm` |
| Secondary (alternative, cancel, deny) | `secondary` | `sm` |
| Tertiary (discard, more) | `ghost`, pushed right with `ml-auto` | `sm` |
| Widget main CTA | `brand` | default |
| Icon-only | `ghost` + `size="icon-sm"`/`"icon-xs"` + `aria-label` | — |

---

## 5. Item names

Foundation: `theme`, `font-inter`, `font-geist-mono`, `typeset`.
Primitives: `button`, `select`, `bubble`, `code-block`, `questionnaire`, `spinner`, `message-scroller`.
System: `widget`, `stat`, `segmented`, `status`, `tick-meter`, `meter-bar`, `sparkline`, `bar-series`, `stepper`, `task-list`, `number-ticker`, `agent-orb`, `model-icons`.
Blocks (product widgets): `block-ai-spend`, `block-fleet-health`, `block-ground-station`, `block-purchase-orders`, `block-bills-filter`, `block-merge-conflicts`, `block-model-evals`, `block-model-router`, `block-agent-runtime` (bundle: `blocks`).
App shell: `app-nav`, `theme-toggle`, `theme-provider`.
Surfaces (agent-composed UI, see `surfaces.md`): `surface` (runtime), `catalog`, `catalog-layout`, `catalog-display`, `catalog-data`, `catalog-input`, `catalog-patterns`, `catalog-blocks` (optional product layer) (bundle: `surfaces`).
Examples (fixtures over the widgets): `example-assistant`, `example-model-router`, `example-agent-runtime`, `example-ai-spend`, `example-fleet-health`, `example-ground-station`, `example-purchase-orders`, `example-merge-conflicts`, `example-model-evals`, `example-bottega`, `example-davinci`, `example-surface` (bundle: `examples`).
Generative UI: `action-card`, `decision-card`, `status-card`, `activity`, `policy`, `diff`, `citation`, `ask-user`, `confirmation`, `preview-approval`, `decision-chip`, `draft-card`, `plan`, `connect-prompt`, `findings`, `chart-card`, `attachment`, `part-transition`, `tool-line`, `reasoning`, `sources`, `search-results`, `markdown`.
Chat: `agent-chat`, `chat-thread`, `chat-turn`, `turn-actions`, `composer`, `chat-empty`, `chat-status`, `chat-error`, `chat-pill`.
Lib: `motion`, `ai`, `url`, `highlighter`.
Bundles: `uia` (everything), `chat`, `hitl`, `blocks`, `surfaces`, `examples`.
Skill: `skill` (this file set).

---

## 6. Blocks — `@/components/blocks/*` — and the app shell — `@/components/app/*`

**A widget is a component with typed props; its demo data lives outside.**
Each widget is a pure view: data in through props, only UI state inside
(period picked, row hovered, view mode), actions out through callbacks
(`onDeploy(config)`, `onRerun()`, `onRebalance()`), pending states as props
(`deployState`, `running`, `rebalancing`). Configuration the host owns is
controlled-or-uncontrolled (`period` + `onPeriodChange`, defaulting
internally). Copy and formatting come in as `locale`, `currency`, `labels`.
The `example-*` files are only fixtures: data, simulation timers, and a
`<Name>Example` that renders the widget.

| Widget | Item | Key props |
| --- | --- | --- |
| `AiSpend` | `block-ai-spend` | `models`, `periods`, `budget`, `alertAt`, `period`/`onPeriodChange`, `currency`, `locale`, `size` |
| `FleetHealth` | `block-fleet-health` | `nodes`, `tokens`, `queue`, `powerCap`, `interval`, `clusters`/`cluster`, `mode`, `onRebalance`, `rebalancing`, `live` |
| `GroundStation` | `block-ground-station` | `stations`/`stationId`, `satellites` (orbit elements + onboard), `selectedId`, `time`, `speed`, `mask`, `horizon`, `onBook`; exports `look` and `passes` so the host computes the same visibility |
| `PurchaseOrders` | `block-purchase-orders` | `orders` (status, amount, ordered/delivery dates, billed share), `today`, `period`, `onApprove(ids)`, `onMarkBilled(ids)` |
| `MergeConflicts` | `block-merge-conflicts` | `number`, `title`, `head`/`base`, `branches` (lane order), `commits` (newest first, `parents`, `pending`), `files` (ours/theirs commit, hunks with `result` lines by origin, `outcome`, `note`), `state` (conflict → resolving → resolved → merging → merged), `resolved`, `onResolve`, `onMerge`, `size` |
| `BillsFilter` | `block-bills-filter` | `documents`, `defaults`, `onApply(filter, count)`; exports `matches` |
| `ModelEvals` | `block-model-evals` | `model`, `suites`, `baselines`, `failures`, `target`, `min`, `baseline`, `onRerun`, `running`, `labels`, `locale` |
| `ModelRouter` | `block-model-router` | `models`, `policies`, `livePolicy`, `requestsPerSecond`, `environments`, `policy`, `fallback`, `onDeploy`, `deployState` |
| `AgentRuntime` | `block-agent-runtime` | `agents` (status, idle, coldStarts, startMs), `idleTimeout`, `requests`, `coldStartP50`, `onInvoke`, `selected`, `regions`/`region`, `live` |

The same widget answers in a chat: a tool whose output is the widget's data
renders `<AiSpend size="sm" {...part.output} />` after its trace line
(`example-assistant`, scenario *spend*). Don't build a chat-only version.

**Agent-app pieces**
- `AppNav` / `AppNavSelect` (`app-nav`): the side nav of an agent app — the
  agent's orb + name (home), `items` with `section`, `count`, `attention`
  (only where the person is needed), `nudge` (`drop | lift | rewind |
  weigh`) and `agent: true` for conversations (the still orb, waking on
  hover); a `footer` slot. Phones: `AppNavSelect` in the header (orb, a
  select with the same items, `trailing` slot for the theme toggle).
- `ThemeToggle` (`theme-toggle`): every app carries its own.
- `DecisionCard` (`decision-card`): one decision, self-contained — eyebrow,
  title, context, `options` with the agent's `pick`, `consequence`
  ("If you go with {agent}:"), `actions` as data (`kind: primary |
  secondary | aside`), `irreversible` (the exception only), `urgent` (glow
  that drains on answer), `agreement` + `onMakeRule`; `labels` for other
  languages.
- `TaskRow` / `TaskListHeader` / `taskRank` (`task-list`): tasks through a
  fixed flow inside a `WidgetList` in an `@container`; stage names once (with
  `count` when many), what needs the person sorted first.

