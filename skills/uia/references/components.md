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
fades the other segments (link it to the list's hover).

```tsx
<MeterBar
  max={1500}
  segments={models.map((m) => ({ id: m.id, value: m.cost, color: m.color }))}
  markers={[{ value: 1200, label: "80%" }, { value: 1500, label: "Budget" }]}
  highlighted={hovered}
/>
```

### Sparkline (`sparkline`)
`<Sparkline values={series} />` — line over a soft area, dashed mean, last
point marked. Pair with a big number and an eyebrow for the window ("Last 64 s").

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
| `TranscriptEvent` | `action-card` | Small centred line for in-progress or system events ("Creating 4 issues…"). |
| `AskUser` / `AskUserAnswered` / `AnswerKey` | `ask-user` | Clarifying questions → answered record. |
| `Confirmation` | `confirmation` | Ready-made approval gate (Allow / Always allow / Deny). |
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
| `ChatEmpty`, `ChatSuggestion` | `chat-empty` | Empty state: orb, greeting, suggestion pills. |
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
System: `widget`, `stat`, `segmented`, `status`, `tick-meter`, `meter-bar`, `sparkline`, `number-ticker`, `agent-orb`, `model-icons`.
Examples: `example-assistant`, `example-model-router`, `example-agent-runtime`, `example-ai-spend`, `example-fleet-health` (bundle: `examples`).
Generative UI: `action-card`, `ask-user`, `confirmation`, `draft-card`, `part-transition`, `tool-line`, `reasoning`, `sources`, `search-results`, `markdown`.
Chat: `agent-chat`, `chat-thread`, `chat-turn`, `turn-actions`, `composer`, `chat-empty`, `chat-status`.
Lib: `motion`, `ai`, `url`, `highlighter`.
Bundles: `uia` (everything), `chat`, `hitl`.
Skill: `skill` (this file set).
