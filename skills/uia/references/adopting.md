# Adopting uia in an existing app

The README's quick start is for a new project. An app that already has
shadcn, its own theme and its own pieces adopts uia **piece by piece**,
without `--overwrite` and without a big bang. Nothing here changes the app's
contracts, transport or permissions: uia renders, the app stays the host.

## 1. Check compatibility (read only)

- `components.json`: shadcn with **Base UI** (`style: "base-*"`). Radix-based
  styles need a different path; stop and ask.
- Aliases (`~/components`, `@/components`…): the shadcn CLI rewrites uia's
  imports to them on install. Nothing to change.
- Theme: note the app's `baseColor` and custom tokens in its main CSS. uia's
  `theme` item adds tokens (`brand`, `attention`, `surface`, `faint-foreground`,
  `--widget-shadow`, `eyebrow`…); it must not silently replace the app's.
- List the app's customised `ui/` primitives (`git log` on `components/ui`).
  uia ships its own versions of `button`, `select`, `bubble`, `code-block`,
  `questionnaire`, `spinner`, `message-scroller` — those collide.

## 2. Install without overwriting

```bash
# tokens and fonts first; read the diff before accepting
npx shadcn@latest add franklinjavier/uia/theme franklinjavier/uia/font-inter franklinjavier/uia/font-geist-mono
# then only the pieces you need, e.g. the patterns the conversation uses
npx shadcn@latest add franklinjavier/uia/decision-card franklinjavier/uia/diff franklinjavier/uia/plan
```

- **Never `--overwrite`.** When the CLI asks about an existing file, answer
  no, then compare: keep the app's version if it's customised and the uia
  piece still works with it; otherwise merge by hand.
- Install the skill once (`franklinjavier/uia/skill`) and point `AGENTS.md`
  at it (README, "For coding agents", step 3).
- The repo is private until it opens: installs from GitHub need the
  person's `gh` credentials.

## 3. Map what the app already renders

If the app has its own renderers for agent output (typed blocks from a
backend contract), keep the **contract** and swap the **rendering** for uia
pieces, one block type at a time:

| typical block | uia piece |
| --- | --- |
| decision / approval with options | `DecisionCard` |
| confirm before acting | `Confirmation` |
| diff / code change | `Diff` |
| steps / checklist / progress | `Plan`, `Stepper` |
| metric / number | `Stat` (+ `Sparkline`, `MeterBar`) |
| notice / status | `Note` (one line), `StatusCard` (with steps) |
| table | `Table` (catalog) or `WidgetList` rows |
| questionnaire / form | `AskUser`, `Confirmation` with fields |
| artifact / document | `DraftCard`, `Citation` |
| something done for the person | `ActivityItem` |
| standing rule | `Policy` |

For each swap: same props in, same callbacks out, the app's tests still
pass, before/after screenshots light and dark and at 375 px.

## 4. Keep the host contracts in the app

- **Actions**: the app's action layer (receipts, idempotency, authorization)
  stays. uia components receive callbacks; for agent-composed surfaces,
  register the app's actions with `defineActions` so reversibility and
  confirmation come from the app, never from the agent.
- **Facts**: numbers come from the app's data, bound or passed as props;
  prose from the agent explains why.
- **Generated UI never grants authority**: rendering a button doesn't make
  the action allowed; the app validates on execution.

## 5. Order that works

1. Theme and fonts (no visual change yet, just tokens available).
2. Chat parts the app already has a counterpart for (decision, diff, plan…).
3. Stable product screens built by hand with uia pieces (`AppNav`,
   `DecisionCard`, `ActivityItem`, `Policy`, `TaskRow`) — see
   `example-davinci`.
4. Surfaces last, as one more block type for what no typed block covers
   (`surfaces.md`).
