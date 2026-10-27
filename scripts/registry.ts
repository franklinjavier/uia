/**
 * Generates registry.json from the source tree, so the registry never drifts
 * from the code.
 *
 *   bun run registry          # writes registry.json
 *   bun run registry:build    # registry.json → public/r/*.json (shadcn build)
 *
 * Items reference each other as `franklinjavier/uia/<item>` (GitHub registry)
 * unless UIA_REGISTRY is set (e.g. `@uia` for a namespace).
 *
 * - Each item lists its files; dependencies are read from their imports:
 *   npm packages → `dependencies`, our files → `<NS>/<item>`, official
 *   shadcn primitives we did not change → bare names (e.g. "tooltip").
 * - Theme tokens are read from registry/theme/index.css (:root, .dark, @theme inline).
 *
 * To add a component: create the file, add one line to ITEMS, run
 * `bun run registry`.
 */
import { readFileSync, writeFileSync } from "node:fs"

// How items reference each other. Default: GitHub addresses, so
// `npx shadcn add franklinjavier/uia/<item>` resolves everything from the
// repo (private repos work through `gh` credentials). For a hosted/local
// JSON registry under a namespace: UIA_REGISTRY=@uia bun run registry:build
const REPO = "franklinjavier/uia"
const NS = process.env.UIA_REGISTRY ?? REPO
const AUTHOR = "uia"

type Item = {
  name: string
  type: string
  title: string
  description: string
  files: string[]
  dependencies?: string[]
  registryDependencies?: string[]
  extra?: Record<string, unknown>
}

// shadcn primitives we customised: shipped from our registry, not upstream.
const UI_OVERRIDES = [
  ["button", "Button with the `brand` variant and calmer disabled states."],
  ["select", "Select with the outlined pill trigger."],
  ["bubble", "Bubble with chat density (38px single line)."],
  ["code-block", "Code block with hairline surface and compact `sm` size."],
  ["questionnaire", "Questionnaire with chat density and calm validation."],
  ["spinner", "Thin-arc spinner that inherits currentColor."],
  ["message-scroller", "Message scroller fading at both edges."],
] as const

const ITEMS: Item[] = [
  ...UI_OVERRIDES.map(([name, description]) => ({
    name,
    type: "registry:ui",
    title: title(name),
    description,
    files: [`registry/ui/${name}.tsx`],
  })),

  // lib & hooks
  item("motion", "registry:lib", "Shared motion vocabulary (springs, easings).", ["registry/lib/motion.ts"]),
  item("url", "registry:lib", "URL helpers.", ["registry/lib/url.ts"]),
  item("ai", "registry:lib", "AI SDK helpers: createChat re-export, getMessageText.", ["registry/lib/ai.ts"]),
  item("highlighter", "registry:lib", "Lazy shiki highlighter that streams line by line.", [
    "registry/lib/highlighter.tsx",
    "registry/hooks/use-highlighted-code.ts",
  ]),
  item("ascii-canvas", "registry:hook", "useAsciiCanvas: the engine under uia's ASCII animations — a cell grid sized to its box, ink read from CSS, one rAF loop that sleeps off screen, a still frame under reduced motion.", ["registry/hooks/use-ascii-canvas.ts"]),

  // ds
  item("widget", "registry:component", "Card-in-card shell: Widget, header, panels, footer.", ["registry/ds/widget.tsx"]),
  item("stat", "registry:component", "Eyebrow label, large value, unit and meta line.", ["registry/ds/stat.tsx"]),
  item("segmented", "registry:component", "Single-choice pill group with a sliding indicator.", ["registry/ds/segmented.tsx"]),
  item("status", "registry:component", "StatusDot and StatusBadge with semantic tones.", ["registry/ds/status.tsx"]),
  item("tick-meter", "registry:component", "Progress as a row of hairline ticks.", ["registry/ds/tick-meter.tsx"]),
  item("number-ticker", "registry:component", "Numbers that animate between values.", ["registry/ds/number-ticker.tsx"]),
  item("model-icons", "registry:component", "Monochrome marks of the major LLM families (Claude, OpenAI, Gemini, Meta, Grok).", ["registry/ds/model-icons.tsx"]),
  item("agent-orb", "registry:component", "The assistant's presence; one animated state per agent phase.", ["registry/ds/agent-orb.tsx"]),
  item("meter-bar", "registry:component", "A value against its limit: segments, threshold markers, highlight.", ["registry/ds/meter-bar.tsx"]),
  item("stepper", "registry:component", "Where something is in a fixed sequence of stages, on one line.", ["registry/ds/stepper.tsx"]),
  item("sparkline", "registry:component", "A recent series as a line over a soft area, latest point marked.", ["registry/ds/sparkline.tsx"]),
  item("task-list", "registry:component", "TaskRow + TaskListHeader: tasks through a fixed flow with Stepper, container-query columns, counts per stage, taskRank to sort.", ["registry/ds/task-list.tsx"]),
  item("bar-series", "registry:component", "A short series as bars in one hue, the latest at full strength, hover to read.", ["registry/ds/bar-series.tsx"]),

  // parts
  item("action-card", "registry:component", "One shape for every human-in-the-loop moment, plus ResolvedRow and TranscriptEvent.", ["registry/parts/action-card.tsx"]),
  item("decision-card", "registry:component", "One decision the agent needs: what, why, options with the agent's pick, consequence, actions as data, urgent glow that drains, agreement → make it a rule.", ["registry/parts/decision-card.tsx"]),
  item("status-card", "registry:component", "A state with its steps and what's next (incident, deploy, migration): status pill, labelled Stepper, fields, note, answers; collapses to a ResolvedRow when resolved.", ["registry/parts/status-card.tsx"]),
  item("activity", "registry:component", "ActivityItem + ActivityList: what the agent did for you — time, what, why, the rule that did it, Undo or Final (host-decided).", ["registry/parts/activity.tsx"]),
  item("policy", "registry:component", "Policy + PolicyList: a standing rule as a switch row (the row is the label), applied count, off state says its effect.", ["registry/parts/policy.tsx"]),
  item("diff", "registry:component", "A code change for review: summary, files with +/- lines (success/destructive washes), answers; resolves to a row.", ["registry/parts/diff.tsx"]),
  item("citation", "registry:component", "Evidence behind a claim: source host as eyebrow, the quote, a mono reference, a link out (http(s) only).", ["registry/parts/citation.tsx"]),
  item("plan", "registry:component", "A multi-step job the agent runs in front of you: steps check off, the running one spins, a tick meter fills.", ["registry/parts/plan.tsx"]),
  item("connect-prompt", "registry:component", "Docked above the composer when the agent needs access: ask → connecting → connected.", ["registry/parts/connect-prompt.tsx"]),
  item("attachment", "registry:component", "File chips (type badge + name, removable in the composer) and a hover preview with the file's gist.", ["registry/parts/attachment.tsx"]),
  item("findings", "registry:component", "What the agent pulled from a source, ranked by a severity signal, each with its reference (page, line).", ["registry/parts/findings.tsx"]),
  item("chart-card", "registry:component", "A chart inside a reply: title, the few numbers that answer, then the chart.", ["registry/parts/chart-card.tsx"]),
  item("ask-user", "registry:component", "Clarifying questions (A/B/C keys) and their answered states.", ["registry/parts/ask-user.tsx"]),
  item("confirmation", "registry:component", "Approval gate before a tool with side effects runs.", ["registry/parts/confirmation.tsx"]),
  item("draft-card", "registry:component", "Editable draft that is its own approval; resolves to an expandable row.", ["registry/parts/draft-card.tsx"]),
  item("decision-chip", "registry:component", "A pending decision, compact, for a 'needs you' strip outside the chat.", ["registry/parts/decision-chip.tsx"]),
  item("preview-approval", "registry:component", "A visual change waiting for the person's eye: before/after, accept or ask for changes.", ["registry/parts/preview-approval.tsx"]),
  item("part-transition", "registry:component", "Height + crossfade transition when a part resolves.", ["registry/parts/part-transition.tsx"]),
  item("tool-line", "registry:component", "A tool call as a trace line, expandable with details.", ["registry/parts/tool-line.tsx"]),
  item("reasoning", "registry:component", "Thinking / Thought trace line with measured duration.", ["registry/parts/reasoning.tsx"]),
  item("sources", "registry:component", "Cited sources as a 2-up grid of cards.", ["registry/parts/sources.tsx"]),
  item("search-results", "registry:component", "Everything a search returned, as a compact list.", ["registry/parts/search-results.tsx"]),
  {
    ...item("markdown", "registry:component", "Assistant prose with typeset and highlighted code blocks.", [
      "registry/parts/markdown.tsx",
      "registry/markdown-code.tsx",
    ]),
    registryDependencies: [`${NS}/typeset`],
  },

  item("theme-provider", "registry:component", "Light/dark/system theme with a `useTheme` hook (class on <html>, saved in localStorage).", ["registry/theme-provider.tsx"]),

  // chat kit
  item("agent-chat", "registry:hook", "useAgentChat, the tool registry types and pure transcript reads.", [
    "registry/chat/use-agent-chat.ts",
    "registry/chat/tool-registry.ts",
    "registry/chat/chat-state.ts",
  ]),
  item("chat-thread", "registry:component", "Scrolling transcript that follows the stream.", ["registry/chat/chat-thread.tsx"]),
  item("chat-turn", "registry:component", "UserTurn, AssistantTurn, ChatParts; tools render via the registry.", ["registry/chat/chat-turn.tsx"]),
  item("turn-actions", "registry:component", "Copy / good / bad row under a finished turn.", ["registry/chat/turn-actions.tsx"]),
  item("composer", "registry:component", "Prompt box as parts: input, toolbar, attach, model select, submit.", ["registry/chat/composer.tsx"]),
  item("chat-empty", "registry:component", "First screen: resting orb, greeting, suggestions.", ["registry/chat/chat-empty.tsx"]),
  item("chat-status", "registry:component", "One-line conversation status.", ["registry/chat/chat-status.tsx"]),
  item("chat-error", "registry:component", "A turn that didn't happen: one quiet line with what it cost and Retry.", ["registry/chat/chat-error.tsx"]),
  item("chat-pill", "registry:component", "The assistant minimised: orb, live phase, Open (attention when it needs you).", ["registry/chat/chat-pill.tsx"]),

  // Blocks: whole product views (data-driven widgets) with typed props. The same component
  // renders on a dashboard and, at size="sm", inside a chat reply.
  item("block-ai-spend", "registry:component", "AiSpend: a period's AI cost by model against a budget, projection, alert, models as the meter's legend.", ["registry/blocks/ai-spend.tsx"]),
  item("block-purchase-orders", "registry:component", "PurchaseOrders: orders as a schedule (placed → delivery, filled as billed, today line), status tabs with counts, date chip, supplier, search, bulk Approve / Mark billed.", ["registry/blocks/purchase-orders.tsx"]),
  item("block-bills-filter", "registry:component", "BillsFilter: due-date range, amount range over a histogram, overdue switch, document types with counts, live \"Show N bills\".", ["registry/blocks/bills-filter.tsx"]),
  item("block-ground-station", "registry:component", "GroundStation: drag-to-turn globe with orbits, sky plot of the next pass or live downlink, onboard storage, satellites with their passes, book a pass.", ["registry/blocks/ground-station.tsx"]),
  item("block-koi-pond", "registry:component", "KoiPond: koi drawn on a cell grid swimming under the content; click to drop food, ASCII rings spread and the koi turn for it.", ["registry/blocks/koi-pond.tsx"]),
  item("block-ocean", "registry:component", "Ocean: sharks or a piranha pack hunting bait schools in ASCII under the content; glyph-ramp shading, schools scatter, click drops a school.", ["registry/blocks/ocean.tsx"]),
  item("block-merge-conflicts", "registry:component", "MergeConflicts: a pull request behind its base — branches as a commit graph, the files both sides changed side by side, merge the base in and resolve, merge.", ["registry/blocks/merge-conflicts.tsx"]),
  item("block-fleet-health", "registry:component", "FleetHealth: tokens/s with sparkline, fleet meters, GPU heatmap with modes, rebalance.", ["registry/blocks/fleet-health.tsx"]),
  item("block-model-evals", "registry:component", "ModelEvals: pass rate vs a baseline and a target, per-suite comparison, failures filtered by suite, re-run.", ["registry/blocks/model-evals.tsx"]),
  item("block-model-router", "registry:component", "ModelRouter: routing policy with a flow graph and routes list, fallback, deploy.", ["registry/blocks/model-router.tsx"]),
  item("block-agent-runtime", "registry:component", "AgentRuntime: sandboxes with lifecycle (cold → warm → idle → zero), invoke.", ["registry/blocks/agent-runtime.tsx"]),

  // Surfaces: the agent composes UI (A2UI v0.9) from a catalog. The runtime
  // has no styling; the catalog entries wrap uia pieces. Install the groups
  // you need and extend the catalog with your own entries.
  item("surface", "registry:lib", "A2UI v0.9 runtime: messages → surfaces (store, JSON Pointer bindings), <Surface> renderer with autofix, validation, streaming placeholders, actions and motion; OpenUI Lang as an input format; defineComponent/defineCatalog, catalogToJSONSchema/catalogToPrompt.", [
    "registry/surface/types.ts",
    "registry/surface/store.ts",
    "registry/surface/format.ts",
    "registry/surface/catalog.ts",
    "registry/surface/validate.ts",
    "registry/surface/openui.ts",
    "registry/surface/surface.tsx",
  ]),
  item("catalog-layout", "registry:component", "Catalog entries: Column, Row, Grid (container-query columns, span), Section, Card, Tabs, Divider.", ["registry/catalog/layout.tsx"]),
  item("catalog-display", "registry:component", "Catalog entries: Text, Badge, Note (alert line), Empty.", ["registry/catalog/display.tsx"]),
  item("catalog-data", "registry:component", "Catalog entries: Stat, Meter, Progress, BarSeries, Sparkline, Table, List, KeyValue, Stepper.", ["registry/catalog/data.tsx"]),
  item("catalog-input", "registry:component", "Catalog entries: Button, TextField, ChoicePicker, CheckBox, Slider, Confirm (two-way bindings, named actions).", ["registry/catalog/input.tsx"]),
  item("catalog-patterns", "registry:component", "Catalog entries the agent fills (compound agent patterns): DecisionCard, Confirmation, Plan, Findings, ActivityItem, Policy, Diff, Citation, BeforeAfter, StatusCard.", ["registry/catalog/patterns.tsx"]),
  item("catalog-blocks", "registry:component", "Optional catalog layer of product blocks (AiSpend…): register only the ones your product shows.", ["registry/catalog/blocks.tsx"]),
  item("catalog", "registry:component", "The uia catalog (all groups) with its published id.", ["registry/catalog/index.ts"]),

  // App shell for agent products.
  item("app-nav", "registry:component", "Side nav of an agent app: brand orb (home), sections, counts (attention where needed), hover nudges, orb for conversations; AppNavSelect for phones.", ["registry/app/app-nav.tsx"]),
  item("theme-toggle", "registry:component", "Sun/moon ghost button for an app's own chrome.", ["registry/app/theme-toggle.tsx"]),

  // Reference widgets: complete, working examples of how uia is composed.
  // They install into src/examples/ to be read, run and adapted.
  item("example-model-router", "registry:block", "Example: model router with policy, routing flow, routes list and deploy.", ["registry/examples/model-router.tsx"]),
  item("example-agent-runtime", "registry:block", "Example: scale-to-zero sandboxes with an isometric scene and invoke.", ["registry/examples/agent-runtime.tsx"]),
  item("example-ai-spend", "registry:block", "Example: monthly AI spend by model against a budget, with alert and projection.", ["registry/examples/ai-spend.tsx"]),
  item("example-model-evals", "registry:block", "Example (pt-BR): pass rate vs a baseline and a target, per-suite comparison, failures filtered by suite, re-run.", ["registry/examples/model-evals.tsx"]),
  item("example-purchase-orders", "registry:block", "Example: September's purchase orders and the bills filter over seeded data.", ["registry/examples/purchase-orders.tsx"]),
  item("example-ground-station", "registry:block", "Example: three stations, three satellites on real orbits at ×60, onboard data and Book.", ["registry/examples/ground-station.tsx"]),
  item("example-koi-pond", "registry:block", "Example: the koi pond as a page backdrop, a typed line over the water and a fed count.", ["registry/examples/koi-pond.tsx"]),
  item("example-ocean", "registry:block", "Example: the ocean as a page backdrop, sharks or piranhas, with an eaten count.", ["registry/examples/ocean.tsx"]),
  item("example-merge-conflicts", "registry:block", "Example: PR #128 behind main after a key rotation, two files resolved one by one, then merged.", ["registry/examples/merge-conflicts.tsx"]),
  item("example-fleet-health", "registry:block", "Example: tokens/s with sparkline, fleet meters and a GPU heatmap.", ["registry/examples/fleet-health.tsx"]),
  item("example-bottega", "registry:block", "Example page (pt-BR): an agent workshop — decisions strip, projects by stage, production, activity and the one conversation with decision cards.", [
    "registry/examples/bottega/bottega.tsx",
    "registry/examples/bottega/conversation.tsx",
    "registry/examples/bottega/use-bottega.ts",
    "registry/examples/bottega/bottega-data.ts",
  ]),
  item("example-davinci", "registry:block", "Example app: an agent coordinator as an inbox — decisions grouped by urgency (the urgent one glows), threads per project, projects by stage that scale to dozens of tasks, a log of what was decided for you, rules with switches; each view a route. Plus the one-chat version it replaced.", [
    "registry/examples/davinci2/davinci2.tsx",
    "registry/examples/davinci2/davinci2-data.ts",
    "registry/examples/davinci/davinci.tsx",
    "registry/examples/davinci/cards.tsx",
    "registry/examples/davinci/davinci-data.ts",
  ]),
  item("example-davinci-surface", "registry:block", "Example: the davinci inbox as an agent sends it — A2UI messages built only from patterns, every fact bound to the factory's data, the factory's action contract deciding what's reversible; Inbox, Decided for you, Rules.", [
    "registry/examples/davinci-surface/factory.ts",
    "registry/examples/davinci-surface/compose.ts",
    "registry/examples/davinci-surface/davinci-surface.tsx",
  ]),
  item("example-surface", "registry:block", "Example: screens an agent assembles for the moment (A2UI against the uia catalog) — a cost & quality dashboard and an incident view, streamed in, with actions back as named events.", [
    "registry/examples/surface/specs.ts",
    "registry/examples/surface/surface-demo.tsx",
  ]),
  item("example-assistant", "registry:block", "Example: a scripted agent chat with questions, a draft and an approval.", [
    "registry/examples/assistant/assistant.tsx",
    "registry/examples/assistant/scripts.ts",
    "registry/examples/assistant/tools.tsx",
  ]),
]

// Bundles: no files, just dependencies.
const BUNDLES = [
  bundle("chat", "Everything to build an agent chat.", [
    "agent-chat", "chat-thread", "chat-turn", "turn-actions", "composer", "chat-empty", "chat-status", "chat-error", "chat-pill", "attachment",
  ]),
  bundle("surfaces", "Agent-composed UI: the A2UI runtime and the whole uia catalog.", [
    "surface", "catalog", "catalog-layout", "catalog-display", "catalog-data", "catalog-input", "catalog-patterns", "catalog-blocks",
  ]),
  bundle("hitl", "All human-in-the-loop parts.", [
    "action-card", "ask-user", "confirmation", "draft-card", "preview-approval", "decision-chip", "part-transition", "tool-line", "decision-card", "status-card", "activity", "policy", "diff", "citation", "plan", "connect-prompt", "findings", "chart-card",
  ]),
  bundle("blocks", "Every product block (data-driven widget), ready to feed with your data.", [
    "block-ai-spend", "block-fleet-health", "block-ground-station", "block-purchase-orders", "block-bills-filter", "block-merge-conflicts", "block-koi-pond", "block-ocean", "block-model-evals", "block-model-router", "block-agent-runtime",
  ]),
  bundle("examples", "Every reference widget, to read, run and adapt.", [
    "example-assistant", "example-model-router", "example-agent-runtime", "example-ai-spend", "example-fleet-health", "example-ground-station", "example-purchase-orders", "example-merge-conflicts", "example-koi-pond", "example-ocean", "example-model-evals", "example-bottega", "example-davinci", "example-surface", "example-davinci-surface",
  ]),
]

/* ------------------------------------------------------------------ */

function title(name: string) {
  return name.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")
}
function item(name: string, type: string, description: string, files: string[]): Item {
  return { name, type, title: title(name), description, files }
}
function bundle(name: string, description: string, deps: string[]) {
  return {
    name,
    type: "registry:block",
    title: title(name),
    description,
    author: AUTHOR,
    registryDependencies: deps.map((d) => `${NS}/${d}`),
  }
}

// Two installed files with the same basename confuse the shadcn CLI: when it
// rewrites a consumer's imports it can point one at the other (it pointed
// the examples' data.ts at the catalog's data.tsx). Fail the build instead.
// Blocks and their example fixtures share names on purpose and resolve fine
// (they're imported by distinct aliases, never relatively).
{
  const allowed = new Set(["ai-spend", "fleet-health", "ground-station", "purchase-orders", "merge-conflicts", "koi-pond", "ocean", "model-evals", "model-router", "agent-runtime"])
  const seen = new Map<string, string>()
  for (const it of ITEMS)
    for (const f of it.files) {
      const base = f.split("/").pop()!.replace(/\.(tsx?|css)$/, "")
      const other = seen.get(base)
      if (other && other !== f && !allowed.has(base))
        throw new Error(`Two registry files are named "${base}": ${other} and ${f}. Rename one (the shadcn CLI resolves imports by name).`)
      seen.set(base, f)
    }
}

const fileOwner = new Map<string, string>()
for (const it of ITEMS) for (const f of it.files) fileOwner.set(f, it.name)
const overrides = new Set<string>(UI_OVERRIDES.map(([n]) => n))

function resolveAlias(spec: string): string | null {
  const base = spec
    .replace(/^@\/components\//, "registry/")
    .replace(/^@\/lib\//, "registry/lib/")
    .replace(/^@\/hooks\//, "registry/hooks/")
    .replace(/^@\/examples\//, "registry/examples/")
  for (const ext of [".tsx", ".ts", "/index.ts", "/index.tsx"]) if (fileOwner.has(base + ext)) return base + ext
  return null
}

function scan(it: Item) {
  const deps = new Set<string>()
  const reg = new Set<string>(it.registryDependencies ?? [])
  // Visual pieces use our tokens (bg-surface, text-attention, eyebrow…).
  if (["registry:ui", "registry:component", "registry:block"].includes(it.type)) reg.add(`${NS}/theme`)
  for (const file of it.files) {
    const src = readFileSync(file, "utf8")
    for (const [, spec] of src.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)) {
      if (spec.startsWith(".")) continue
      if (spec === "@/lib/utils") continue
      if (spec.startsWith("@/components/ui/")) {
        const name = spec.split("/").pop()!
        reg.add(overrides.has(name) ? `${NS}/${name}` : name)
        continue
      }
      if (spec.startsWith("@/")) {
        const target = resolveAlias(spec)
        if (!target) throw new Error(`${file}: cannot map import "${spec}" to a registry item`)
        const owner = fileOwner.get(target)!
        if (owner !== it.name) reg.add(`${NS}/${owner}`)
        continue
      }
      const pkg = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]
      if (["react", "react-dom"].includes(pkg)) continue
      deps.add(pkg)
    }
  }
  return { deps: [...deps].sort(), reg: [...reg].sort() }
}

function target(path: string) {
  // Examples land in the consumer's src/examples; everything else follows
  // the consumer's aliases (components.json).
  if (path.startsWith("registry/examples/")) return `~/src/examples/${path.slice("registry/examples/".length)}`
  return path
    .replace(/^registry\/ui\//, "@ui/")
    .replace(/^registry\/lib\//, "@lib/")
    .replace(/^registry\/hooks\//, "@hooks/")
    .replace(/^registry\//, "@components/")
}

/* ------------------------------ theme ------------------------------ */

const css = readFileSync("registry/theme/index.css", "utf8")
function block(selector: string) {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`index.css: ${selector} not found`)
  const body = css.slice(start, css.indexOf("\n}", start))
  return Object.fromEntries(
    [...body.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)].map(([, k, v]) => [k, v.trim()])
  )
}
const themeInline = block("@theme inline")
const OURS = /^(color-(surface|faint-foreground|brand|brand-foreground|attention|attention-foreground|success|warning|info)|shadow-widget|ease-out-quint)$/
const themeVars = Object.fromEntries(Object.entries(themeInline).filter(([k]) => OURS.test(k)))
themeVars["animate-spin-slow"] = "spin 2.4s linear infinite"

const themeItem = {
  name: "theme",
  type: "registry:theme",
  title: "Theme",
  description: "uia tokens: cool zinc light, neutral dark, ink brand, attention, semantic tones.",
  cssVars: { theme: themeVars, light: block(":root"), dark: block(".dark") },
  css: {
    "@utility eyebrow": {
      "font-family": "var(--font-mono)",
      "font-size": "11px",
      "line-height": "16px",
      "letter-spacing": "0.08em",
      "text-transform": "uppercase",
      "font-variant-numeric": "tabular-nums",
    },
    "@layer base": {
      body: { "background-color": "var(--background)", "-webkit-font-smoothing": "antialiased" },
      html: { "font-feature-settings": '"cv11", "ss03"' },
      // iOS zooms into fields under 16px on focus; touch screens get 16px.
      "@media (pointer: coarse)": { "input, textarea, select": { "font-size": "16px !important" } },
    },
    ".typeset-chat": {
      "--typeset-font-body": "var(--font-sans)",
      "--typeset-font-heading": "var(--font-sans)",
      "--typeset-font-mono": "var(--font-mono)",
      "--typeset-size": "14px",
      "--typeset-leading": "1.65",
      "--typeset-flow": "0.85em",
    },
    ".typeset.typeset-chat": { "font-size": "var(--typeset-size)" },
  },
}

const fonts = [
  {
    name: "font-inter",
    type: "registry:font",
    title: "Inter",
    description: "Inter Variable as --font-sans.",
    font: {
      family: "'Inter Variable', sans-serif",
      provider: "google",
      import: "Inter",
      variable: "--font-sans",
      subsets: ["latin"],
      dependency: "@fontsource-variable/inter",
    },
  },
  {
    name: "font-geist-mono",
    type: "registry:font",
    title: "Geist Mono",
    description: "Geist Mono Variable as --font-mono (eyebrows, numbers, code).",
    font: {
      family: "'Geist Mono Variable', ui-monospace, monospace",
      provider: "google",
      import: "Geist_Mono",
      variable: "--font-mono",
      subsets: ["latin"],
      // Only code-ish elements: the default selector (html) would make the
      // whole app monospace. Eyebrows use var(--font-mono) directly.
      selector: "code, kbd, pre, samp",
      dependency: "@fontsource-variable/geist-mono",
    },
  },
]

const typeset = {
  name: "typeset",
  type: "registry:file",
  title: "Typeset",
  description: "shadcn/typeset, tuned for streaming chat (no tabular-nums on tables).",
  files: [{ path: "registry/theme/typeset.css", type: "registry:file", target: "~/src/typeset.css" }],
  docs: 'Import it after Tailwind in your main CSS file: @import "./typeset.css";',
}

// The agent skill: one copy, in .agents/skills (where Codex and most agents
// look). Claude Code reaches it through CLAUDE.md → AGENTS.md; the registry
// never writes those two files, since projects already have their own.
const SKILL_FILES = ["SKILL.md", "references/tokens.md", "references/components.md", "references/hitl.md", "references/chat.md", "references/pitfalls.md", "references/examples.md", "references/grammar.md", "references/surfaces.md", "references/adopting.md"]
const skill = {
  name: "skill",
  type: "registry:file",
  title: "uia skill",
  description: "Agent skill that teaches coding agents to build chat, generative UI and human-in-the-loop interfaces with uia.",
  files: SKILL_FILES.map((f) => ({ path: `skills/uia/${f}`, type: "registry:file", target: `~/.agents/skills/uia/${f}` })),
  docs: "Point your agents at it: add the uia section to AGENTS.md, and make CLAUDE.md import AGENTS.md (see the README).",
}

/* ------------------------------ output ----------------------------- */

const items = [
  ...fonts,
  themeItem,
  typeset,
  ...ITEMS.map((it) => {
    const { deps, reg } = scan(it)
    return {
      name: it.name,
      type: it.type,
      title: it.title,
      description: it.description,
      author: AUTHOR,
      ...(deps.length ? { dependencies: deps } : {}),
      ...(reg.length ? { registryDependencies: reg } : {}),
      files: it.files.map((path) => ({
        path,
        type: it.type === "registry:block" ? "registry:file" : it.type,
        target: target(path),
      })),
      ...it.extra,
    }
  }),
  ...BUNDLES,
  skill,
  {
    name: "uia",
    type: "registry:base",
    title: "uia",
    description: "The whole design system: fonts, theme, typeset, ds, hitl and chat.",
    author: AUTHOR,
    registryDependencies: [
      "font-inter", "font-geist-mono", "theme", "typeset",
      ...UI_OVERRIDES.map(([n]) => n),
      "widget", "stat", "segmented", "status", "tick-meter", "meter-bar", "sparkline", "stepper", "number-ticker", "agent-orb", "model-icons",
      "hitl", "reasoning", "sources", "search-results", "markdown", "chat", "skill",
    ].map((n) => `${NS}/${n}`),
  },
]

const registry = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: "uia",
  homepage: `https://github.com/${REPO}`,
  items,
}

writeFileSync("registry.json", JSON.stringify(registry, null, 2) + "\n")
console.log(`registry.json: ${items.length} items`)
