# Tokens

All tokens live in the project's main CSS (installed by `franklinjavier/uia/theme`)
and are exposed as Tailwind utilities (`bg-surface`, `text-attention`, …).
Use them by **meaning**. If no token means what you need, the design probably
doesn't need it.

## Surfaces (back to front)

| Token | Utility | Meaning |
| --- | --- | --- |
| `--canvas` | `bg-canvas` | The page. Body default. Slightly cool grey in light, neutral in dark. |
| `--surface` | `bg-surface` | A widget's shell (`Widget`). Sits on canvas, holds panels. |
| `--background` / `--card` | `bg-background`, `bg-card` | Card level: panels, the composer, resolved rows. shadcn primitives paint `bg-background`, which is why it is card-white, not the page. |
| `--muted` | `bg-muted`, `bg-muted/60` | Inset or pending: ActionCard body, hover, code blocks (`bg-muted/25`). Use translucent steps rather than new greys. |
| `--popover` | `bg-popover` | Menus and select popups. |

Shadow: `shadow-widget` only on the widget shell; `shadow-xs` on cards; nothing
heavier inside a transcript.

Borders are hairlines: `border-border` (or `/70`, `/80`). In dark mode the border
is 9% white, so the same class works in both themes.

## Text

| Utility | Use |
| --- | --- |
| `text-foreground` | Body, titles, values. |
| `text-muted-foreground` | Descriptions, secondary labels, eyebrow labels. |
| `text-faint-foreground` | Tertiary meta: provider names in a list, counters, timestamps next to stronger meta. |

## Colour with meaning

| Token | Meaning | Examples |
| --- | --- | --- |
| `brand` (ink: near-black in light, near-white in dark) | The primary action / the product's voice | `Button` default and `brand` variant, `ComposerSubmit`, `TickMeter`, Segmented indicator |
| `attention` (orange) | **Something waits on the person** — and nothing else | "Approval needed" pill, `ChatStatus` waiting, `StatusDot tone="attention"` |
| `success` | Finished well | done pills, ready dot |
| `warning` | Degraded, needs a look later | quota near limit |
| `info` | Neutral information with a hue | rarely; prefer muted text |
| `destructive` | Failed or irreversible | error pill, delete confirmations |

Rules of thumb:

- One orange thing on screen at a time, ideally. If two parts both need the
  person, they are probably one decision.
- Never use `attention` to decorate (badges, highlights, links). It loses its
  meaning the moment it's decorative.
- Tones escalate: `neutral` (fine) → `warning` (close to a limit, degraded)
  → `destructive` (over the limit, failed). Don't stop at `warning` when the
  limit is actually hit.
- State tones come with words. A dot alone is not enough: `StatusBadge` pairs
  dot + label; `ActionCardStatus` is a pill with text.
- Charts use `--chart-1…5` (from the shadcn theme), not semantic tones.

## Type

- **Inter** for everything; `font-mono` (**Geist Mono**) for code, kbd and
  the `eyebrow`.
- `eyebrow` utility = mono, 11px, uppercase, wide tracking. The second voice
  for labels and metadata. Pair it with `text-muted-foreground` or
  `text-faint-foreground`.
- Sizes in use: 11 (eyebrow), 12 (`text-xs` meta), 14 (`text-sm` body,
  chat), 15 (card titles, question titles), 16 (`text-base` widget titles),
  36 (`text-4xl` stat values, `tracking-[-0.03em]`).
- Weights: regular almost everywhere; `font-medium` for a label that anchors
  a row (ResolvedRow label, ActionCard title). Avoid `font-semibold`/`bold`.
- Long-form assistant prose goes through `Markdown` (typeset preset
  `.typeset-chat`); don't style prose by hand.

## Radius

From `--radius` (0.625rem): cards `rounded-2xl`, widget shell `rounded-3xl`,
buttons and composer controls `rounded-full` (pills), small icon tiles
`rounded-md`. Nested radii shrink inwards (shell 3xl → panel 2xl → row xl).

## Motion

`@/lib/motion`:

| Preset | Use |
| --- | --- |
| `enter` (0.28s ease-out-quint) | Something appears: fade + `y: 4`. |
| `easeOut` (0.2s) | Small UI responses: hover reveals, icon swaps. |
| `springSnappy` | Indicators that follow a choice (Segmented thumb). |
| `springSoft` | Height changes (`PartTransition`, disclosures). |

Respect the existing animations; don't add bounce, slide-from-edge, or
staggered list entrances inside a transcript.
