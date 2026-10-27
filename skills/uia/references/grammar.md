# Grammar

The moves every uia screen is built from. The rules in SKILL.md say what to
avoid; this says what to do. Read it with the closest example open
(`examples.md`): the examples are this grammar applied.

## Contents

1. Anatomy of a widget
2. The hero: one number and what explains it
3. Lists are legends
4. Data visualisation
5. Live and interactive
6. Copy
7. Spacing and type, in numbers
8. Pages
9. Mobile first
10. Agent apps: an inbox, not one chat

---

## 1. Anatomy of a widget

```
Widget
├─ WidgetHeader     title · (one scope control on the right)
├─ WidgetPanel      HERO: the number that answers "how is it going?"
│                   + the visual that explains it
├─ WidgetPanel      DETAIL: a titled list / grid that breaks the number down
└─ WidgetFooter     live meta on the left · one action on the right
```

- **Header:** `WidgetTitle` plus, at most, one control that changes the
  *scope* of everything below (environment, region, cluster, month). Put it
  in `WidgetActions` as a `Select` with a leading muted icon. Nothing else:
  no info icon, no settings, no close.
  - *Extension:* when part of the list is waiting on the person, the header
    may carry one `StatusBadge tone="attention"` count ("2 need you") — and
    it is a button that filters to exactly those (PurchaseOrders). Why: it is
    the one fact that decides where to look first, and it does something.
    A count that doesn't filter stays out of the header.
- **Two panels is the default.** A third only when there's a genuinely
  separate block. Never one panel per stat.
- **Footer:** `WidgetMeta` with a `StatusDot tone="success" pulse` when the
  data is live, then cadence and scope ("Live · every 1.6 s · Ashburn"). The
  one action is a `brand` button, `min-w-32`, with three states: idle,
  working (spinner + "-ing" label), done (check + past tense, ~1.8 s) — see
  Deploy policy / Rebalance. Disable it when there's nothing to do.
  - *Extension:* a `secondary` button may sit left of the primary when it is
    a real second verb on the same thing — a bulk action on the same
    selection (Mark billed · **Approve 2**) or undoing the form (Reset ·
    **Show 142 bills**). Never two `brand` buttons; Reset appears only once
    something changed. Why: these footers act on what the person picked;
    hiding the second verb in a menu would add a control that only exists
    to hold it.
  - With rows selected, the meta becomes the selection ("2 selected
    $16,480.00") and the primary counts what it will act on ("Approve 2",
    only the rows it applies to).

## 2. The hero: one number and what explains it

```
EYEBROW LABEL                                  secondary stat / sparkline / segmented
1,887,331  unit or / limit   [▲ 4.0%]
META · META · META
──────────────────────────────── (dashed hairline when a row of meters follows)
the visual: MeterBar · TickMeter row · flow graph · scene
```

- One big number per widget (`StatValue`, light, `text-4xl`). Unit or limit
  in `StatUnit` (`/ $1,500`, `/ 52 kW`, `/ 4`). A change goes in a
  `StatusBadge dot={false}` next to it: `success` when up is good, `neutral`
  otherwise — a drop isn't automatically a warning.
- The meta line (`StatMeta`) gives context the number lacks: compared to
  what, and one or two secondary facts. Max three items joined by `·`.
- The right side answers the next question: where it's heading
  ("Projected $2,100"), how it moved (`Sparkline` + "Last 64 s"), or how to
  slice it (`Segmented` with Cost / Balanced / Quality).
- **Then the visual.** Every hero has one, and it shows the reference the
  number is judged against: the budget, the capacity, the limit, the
  baseline. A number against a limit is a `MeterBar` with markers; several
  capacities are a row of three `Stat size="sm"` + `TickMeter`, separated
  from the hero by `border-t border-dashed`.

## 3. Lists are legends

- The detail panel opens with `WidgetSectionTitle` (+ optional eyebrow
  summary under it: "8 nodes · 1 running hot · 1 draining") and continues
  with `WidgetList`: eyebrow column headers, hairline rows.
- Each row is a thing in the visual above. Same colour dot as its segment
  or line; hovering the row lights it up in the visual and dims the other
  rows; clicking selects it when selection drives an action (Invoke
  planner). Hovering the visual does the same back.
- Row anatomy: name (`text-sm`) + its meta as eyebrow (inline and
  `faint` for a provider; under the name and `muted` for specs), then
  numeric columns right-aligned with `tabular-nums`, then state as a
  `StatusBadge`, then a quiet eyebrow column (countdown, count).

## 4. Data visualisation

- **Categorical** (models, routes): `--chart-1…4`, then
  `--muted-foreground` for "other / self-hosted". Don't use `--chart-5`
  for a category; it's orange and reads as attention.
- **Sequential** (heatmaps, intensity): one hue, `--chart-1`, as opacity
  over the card: `color-mix(in oklch, var(--chart-1) N%, transparent)`.
  Never mix the hue with grey (it drifts purple in dark mode). Show the
  scale as a small swatch strip with eyebrow ends ("0% … 100%").
- **Meters:** `TickMeter` for a single ratio (track is the same hue at
  20%); `MeterBar` for a breakdown or when thresholds matter.
- **Lines:** `Sparkline` — no axes, dashed mean, last point marked.
- **Illustrations** (flow graph, isometric scene) are drawn in hairlines
  with `currentColor`/tokens, fill `--card`/`--muted`, and highlight the
  focused thing with `--foreground`, not a new colour. A leader line from
  the focused element to a mono label says its one key fact.
- **Tooltips** for dense visuals: dark (`TooltipContent`), a title row with
  the thing and its kind, then key/value rows (`opacity-60` keys,
  `tabular-nums` values). Open instantly (`delay={0}`).
- States inside a visual: hatched (`repeating-linear-gradient` of
  `--border`) for draining/disabled, near-empty for idle, a small `warning`
  dot for "needs a look". Never a red cell.

## 5. Live and interactive

- Numbers that change use `NumberTicker`; bars and markers animate with
  `springSoft`; transitions between states are opacity/height, never
  slides.
- Simulated data in examples is a small state machine with a clock
  (`setInterval` in an effect, cleaned up). Real data replaces the clock,
  not the components.
- Everything clickable responds: rows, nodes, boxes, segments. If a thing
  looks interactive and isn't, remove the affordance.
- When an action changes the data (Rebalance, Deploy, Invoke), the visual
  shows the consequence (load evens out, version bumps, a box wakes up).
- **ASCII animations are backdrops, not widgets.** Build them on
  `useAsciiCanvas` (one cell grid, ink read from CSS, sleeps off screen, a
  still frame under reduced motion). They sit behind the content, in the
  ink plus at most one colour of their own, and never carry data or the
  only way to do something. The content on top stays readable and keeps
  its clicks; the backdrop may answer the pointer (food, ripples) but
  nothing depends on it. One per page.

## 6. Copy

- Eyebrows are noun phrases with units: "TOKENS SERVED / S", "COLD START
  P50 170 MS", "ZERO AFTER 12S IDLE".
- Titles are plain nouns: "Fleet health", "Routes", "By model".
- An alert line is `StatusBadge` (the state) + one sentence with new
  information: when, how much, what happens next ("At this pace the budget
  runs out around Oct 23"). Not advice ("Review your budget").
- Button labels are verbs about the thing: "Invoke planner", "Deploy
  policy", "Rebalance".

## 7. Spacing and type, in numbers

| Thing | Value |
| --- | --- |
| Widget width | `max-w-[560px]` (chat widgets 620) |
| Panel padding | default `p-5`; list panels `pt-3` |
| Gap inside the hero | `gap-5` |
| Row of three stats | `grid grid-cols-3 gap-6`, dashed hairline above |
| Big number | `StatValue` (text-4xl, tracking -0.03em, light) |
| Secondary number | `StatValue size="sm"` |
| Section title | `WidgetSectionTitle` (15px) |
| Labels / meta / column headers | `eyebrow` (11px mono uppercase) |
| Body / rows | `text-sm` |
| List columns | fixed widths in `grid-cols-[1fr_…]`, set once in a `COLS` const |

## 8. Pages

A page is widgets in a column plus, for agent products, the conversation as
a rail. The example is `example-bottega`.

```
┌ header: title · eyebrow summary ─────────── [one scope select] ┐
│ Needs you · N        (decision chips; the only orange)  │ rail: │
│ Section widget (titled list, full width)                │ orb · │
│ Section widget │ Section widget   (2-up at xl)          │ chat  │
└─────────────────────────────────────────────────────────┴───────┘
```

- **Header** (`h-14`, sticky, hairline below): page title, an eyebrow
  summary ("5 projetos · 3 no ar"), and one `Select` that scopes the whole
  page. Clicking a row that represents the same thing sets that scope too.
- **What needs the person comes first.** A strip of `DecisionChip`s, each
  opening its full card in the conversation. When empty, one quiet line
  ("Nada esperando você"). Nothing else on the page uses `attention`.
- **Sections are plain `Widget`s** (title outside, panels inside) stacked
  with `gap-8` in a centred column (`max-w-[60rem]`, `px-6 py-8`). Pair
  two at `xl` when they're peers (production · activity).
- **Outcomes over machinery.** For agent products show where each thing is
  (`Stepper` over the flow), what is live and healthy, and what the agent
  did on its own (a quiet log) — not agents, tasks and tests. Details stay
  one click away.
- **The conversation rail** (`26rem`, `border-l`): header with the
  `AgentOrb`, the agent's name and a status eyebrow ("Esperando você"),
  the thread, the composer at the bottom. Decisions are answered there; the
  page reflects the consequence (stage moves, version changes, log entry,
  the agent confirms in the thread).

## 9. Mobile first

Design at 375 px first, then add columns as space allows. Nothing may
extend past the viewport (a page wider than the phone zooms out and every
tap target shrinks).

- **Lists keep the name and one or two numbers.** Secondary columns get
  `max-sm:hidden` on *both* the header cell and the row cell, and the
  columns are set per breakpoint:
  `grid-cols-[minmax(0,1fr)_80px_44px] sm:grid-cols-[minmax(0,1fr)_64px_80px_44px]`.
  Inline metadata that competes with the name (provider eyebrows) hides too.
  A per-row visual that has a numeric twin (Δ next to a comparison bar)
  can go; the number stays.
- **Rows with a wide visual go to two lines:** name · state on top, the
  visual full width below (`col-span-2 order-last`, back to its column at
  `md`). See the projects list in `example-bottega`.
- **Heroes stack:** the secondary stat, sparkline or `Segmented` moves under
  the big number (`flex-col sm:flex-row`); a control that was absolute in a
  corner becomes static (`self-start sm:absolute …`).
- **Meta lines and footers wrap** (`flex-wrap`, `gap-y-*`); badges never wrap
  inside (`StatusBadge` is `whitespace-nowrap`).
- **Side panels: a column at `lg`, a Sheet below.** At `lg` a detail panel
  is an inline third column (non-modal, the list stays usable); below it's a
  full-screen shadcn `Sheet` (focus trap, Esc, scroll lock) with the same
  header and content, rendered once for both (`matchMedia("(min-width:
  64rem)")`). See `example-davinci`.
- **Rails become sheets.** Below `lg` the conversation rail is a full-screen
  sheet opened by a floating `brand` button ("Conversa" + attention count);
  decision chips open the sheet and scroll to their card.
- **Chat on phones:** no avatar beside the agent's messages (the header's
  orb carries presence; the text gets the full width — `AssistantTurn`
  does this); the scroll-to-end button sits bottom-right, off the cards'
  buttons; a full-screen sheet stacks above any floating chrome.
- **Nothing is hover-only.** A phone has no hover and long-press is hidden:
  whatever a mouse reveals on hover, a tap reveals and a second tap lets
  go (`BarSeries` bars, `AttachmentPreview` cards). Check the pointer type
  so a mouse click doesn't undo its own hover:
  `e.nativeEvent.pointerType === "mouse"`.
- **A free-text field gets its own row.** In a form footer (Back · field ·
  Submit) the field takes the full width on phones and the buttons sit
  below it, Back left and Submit right (`flex-wrap`, field
  `max-sm:order-first max-sm:basis-full`; if the input renders inside a
  wrapper, put those classes on the wrapper).
- **Many tabs become a select.** A `Segmented` with more than ~4 options
  turns into a `Select` on phones (`max-md:hidden` / `md:hidden` pair).
- **Check it for real:** emulate a phone (device toolbar or the browser
  tool's mobile preset), not a narrow desktop window — desktop Chrome
  won't go below ~500 px, so headless screenshots at 390 px lie. Then run
  the overflow check from `pitfalls.md`.

## 10. Agent apps: an inbox, not one chat

When an agent works *for* someone (a coordinator, an operator, a reviewer
bot), their attention is the scarce thing. One chat for everything buries
the urgent decision under yesterday's small talk, makes "what's pending?"
a scroll, and loses what was decided. Build the app the example
`example-davinci` shows instead:

```
┌ nav ───────────┬ view (route) ─────────────────────┬ panel ─────┐
│ ◌ davinci      │ 6 decisions need you              │ task / diff│
│ Inbox       6  │ Since 21:00: 7 shipped, 1 stuck,  │ / preview  │
│ THREADS        │ 7 decided for you.                │ (sheet on  │
│ ◌ blog         │ NOW    [card, attention glow]     │  phones)   │
│ ◌ bottega      │ TODAY  [card] [card]              │            │
│ LOOK           │ CAN WAIT [card]                   │            │
│ Projects       │ Answered today · Undo             │            │
│ Decided     7  │                                   │            │
│ Rules       3  │                                   │            │
│ ─ ─ ─ ─ ─ ─ ─  │                                   │            │
│ digest 21:00 ☾ │                                   │            │
└────────────────┴───────────────────────────────────┴────────────┘
```

- **Decisions are state, not messages.** The inbox holds only what needs
  the person, grouped by urgency (Now / Today / Can wait). Each card stands
  alone: what, why in one line, the agent's pick marked on its option, and
  the consequence ("If you go with davinci: …"). Mark the exception only
  ("Irreversible"); most things can be undone, so don't badge them.
- **Only the urgent card glows** (`ActionCard tone="attention"`); answering
  drains the glow, then the card sinks out, the cards below glide up, and
  it lands as the newest "Answered today" row (dropping in from above,
  glowing once) with Undo, which sends it back up into its section. When the urgent card scrolls away, a compact "Now" bar pins it.
- **The summary line links**: every count in it ("7 shipped", "1 stuck",
  "7 decided for you") opens the place that explains it.
- **Threads are for talking**, one per project, under the agent's still
  orb. A thread can reference an inbox item; the reference shows the
  item's live status, it doesn't duplicate the card.
- **Look, don't act**: Projects (stage tracks; nothing there needs you, the
  copy says so), "Decided for you" (time, what, why, the rule that did it,
  Undo or Final), Rules.
- **Rules come from agreement.** When the person has gone with the agent's
  pick every time in a category (14 of 14), offer "Make it a rule" on the
  card. Rules list as switches (see SKILL.md, verbs vs switches) with how
  often each applied. Undoing a decision a rule made also offers to drop
  the rule.
- **Nav counts**: only the inbox count uses `attention`; the rest are
  faint. Phones: the nav becomes a `Select` in the header, next to the
  orb (home) and the theme toggle.
