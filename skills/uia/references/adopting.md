# Adopting uia in an existing app

Two paths. Pick one before touching anything:

- **Replace the UI** (the app's look isn't worth keeping): keep the app's
  logic, throw its UI layer away, rebuild it on uia. Section A.
- **Adopt piece by piece** (the app's look is fine, uia adds what's
  missing): install selectively, never `--overwrite`. Section B.

Either way nothing changes the app's contracts, transport or permissions:
uia renders, the app stays the host.

## A. Replace the UI

**Keep** (the app's logic — read it, don't rewrite it):
- contracts with the backend (typed messages, blocks, events, actions);
- transport and streaming, the server proxy and its secrets, auth;
- persistence, receipts, idempotency, reconciliation of uncertain sends;
- the behavioural tests of that logic.

**Replace** (the UI layer):
- `components/ui` → uia's (`npx shadcn@latest add franklinjavier/uia/uia
  --overwrite`, on a branch); the app's own primitive tweaks are dropped on
  purpose;
- the app's chat components → uia's chat kit (`ChatThread`, `ChatTurn`,
  `Composer`, `useAgentChat` or the app's own hook feeding them);
- the app's renderers for agent output → uia parts, through **one adapter**
  that maps each contract block to a part (table below). The adapter is the
  only file that knows both sides;
- pages → rebuilt from the closest examples: `example-assistant` (the
  conversation), `example-davinci` (an agent app: nav, inbox of
  decisions, activity, rules), `example-davinci-surface` (screens the agent
  composes).

**Order:**
1. Branch. Install uia with `--overwrite` (theme, fonts, primitives, chat,
   hitl, skill). Point `AGENTS.md` at the skill.
2. Write the adapter: contract block → uia part, callbacks → the app's
   action layer. Delete the old renderers once every block type maps.
3. Rebuild the conversation page on the chat kit with the adapter in the
   tool/data registries. Keep the app's hook if it already handles the
   stream, receipts and reconciliation; feed its state to the kit.
4. Rebuild the product screens by hand with uia pieces.
5. Add surfaces last, as one more block type, with the app's actions in
   `defineActions`.
6. The logic tests still pass unchanged; UI tests are rewritten against
   the new pieces. Check light, dark and 375 px.

What not to carry over: the old CSS, custom density tokens, per-component
overrides of shadcn, and any UI state that duplicated the contract.

## B. Adopt piece by piece

### 1. Check compatibility (read only)

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

### 2. Install without overwriting

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

### 3. Map what the app already renders

The same table is the adapter's map in path A. If the app has its own renderers for agent output (typed blocks from a
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

### 4. Keep the host contracts in the app

- **Actions**: the app's action layer (receipts, idempotency, authorization)
  stays. uia components receive callbacks; for agent-composed surfaces,
  register the app's actions with `defineActions` so reversibility and
  confirmation come from the app, never from the agent.
- **Facts**: numbers come from the app's data, bound or passed as props;
  prose from the agent explains why.
- **Generated UI never grants authority**: rendering a button doesn't make
  the action allowed; the app validates on execution.

### 5. Order that works

1. Theme and fonts (no visual change yet, just tokens available).
2. Chat parts the app already has a counterpart for (decision, diff, plan…).
3. Stable product screens built by hand with uia pieces (`AppNav`,
   `DecisionCard`, `ActivityItem`, `Policy`, `TaskRow`) — see
   `example-davinci`.
4. Surfaces last, as one more block type for what no typed block covers
   (`surfaces.md`).
