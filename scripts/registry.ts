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
 * - Theme tokens are read from src/index.css (:root, .dark, @theme inline).
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
    files: [`src/components/ui/${name}.tsx`],
  })),

  // lib & hooks
  item("motion", "registry:lib", "Shared motion vocabulary (springs, easings).", ["src/lib/motion.ts"]),
  item("url", "registry:lib", "URL helpers.", ["src/lib/url.ts"]),
  item("ai", "registry:lib", "AI SDK helpers: createChat re-export, getMessageText.", ["src/lib/ai.ts"]),
  item("highlighter", "registry:lib", "Lazy shiki highlighter that streams line by line.", [
    "src/lib/highlighter.tsx",
    "src/hooks/use-highlighted-code.ts",
  ]),

  // ds
  item("widget", "registry:component", "Card-in-card shell: Widget, header, panels, footer.", ["src/components/ds/widget.tsx"]),
  item("stat", "registry:component", "Eyebrow label, large value, unit and meta line.", ["src/components/ds/stat.tsx"]),
  item("segmented", "registry:component", "Single-choice pill group with a sliding indicator.", ["src/components/ds/segmented.tsx"]),
  item("status", "registry:component", "StatusDot and StatusBadge with semantic tones.", ["src/components/ds/status.tsx"]),
  item("tick-meter", "registry:component", "Progress as a row of hairline ticks.", ["src/components/ds/tick-meter.tsx"]),
  item("number-ticker", "registry:component", "Numbers that animate between values.", ["src/components/ds/number-ticker.tsx"]),
  item("model-icons", "registry:component", "Monochrome marks of the major LLM families (Claude, OpenAI, Gemini, Meta, Grok).", ["src/components/ds/model-icons.tsx"]),
  item("agent-orb", "registry:component", "The assistant's presence; one animated state per agent phase.", ["src/components/ds/agent-orb.tsx"]),
  item("meter-bar", "registry:component", "A value against its limit: segments, threshold markers, highlight.", ["src/components/ds/meter-bar.tsx"]),
  item("stage-track", "registry:component", "Where something is in a fixed sequence of stages, on one line.", ["src/components/ds/stage-track.tsx"]),
  item("sparkline", "registry:component", "A recent series as a line over a soft area, latest point marked.", ["src/components/ds/sparkline.tsx"]),

  // parts
  item("action-card", "registry:component", "One shape for every human-in-the-loop moment, plus ResolvedRow and TranscriptEvent.", ["src/components/parts/action-card.tsx"]),
  item("ask-user", "registry:component", "Clarifying questions (A/B/C keys) and their answered states.", ["src/components/parts/ask-user.tsx"]),
  item("confirmation", "registry:component", "Approval gate before a tool with side effects runs.", ["src/components/parts/confirmation.tsx"]),
  item("draft-card", "registry:component", "Editable draft that is its own approval; resolves to an expandable row.", ["src/components/parts/draft-card.tsx"]),
  item("decision-chip", "registry:component", "A pending decision, compact, for a 'needs you' strip outside the chat.", ["src/components/parts/decision-chip.tsx"]),
  item("preview-approval", "registry:component", "A visual change waiting for the person's eye: before/after, accept or ask for changes.", ["src/components/parts/preview-approval.tsx"]),
  item("part-transition", "registry:component", "Height + crossfade transition when a part resolves.", ["src/components/parts/part-transition.tsx"]),
  item("tool-line", "registry:component", "A tool call as a trace line, expandable with details.", ["src/components/parts/tool-line.tsx"]),
  item("reasoning", "registry:component", "Thinking / Thought trace line with measured duration.", ["src/components/parts/reasoning.tsx"]),
  item("sources", "registry:component", "Cited sources as a 2-up grid of cards.", ["src/components/parts/sources.tsx"]),
  item("search-results", "registry:component", "Everything a search returned, as a compact list.", ["src/components/parts/search-results.tsx"]),
  {
    ...item("markdown", "registry:component", "Assistant prose with typeset and highlighted code blocks.", [
      "src/components/parts/markdown.tsx",
      "src/components/markdown-code.tsx",
    ]),
    registryDependencies: [`${NS}/typeset`],
  },

  item("theme-provider", "registry:component", "Light/dark/system theme with a `useTheme` hook (class on <html>, saved in localStorage).", ["src/components/theme-provider.tsx"]),

  // chat kit
  item("agent-chat", "registry:hook", "useAgentChat, the tool registry types and pure transcript reads.", [
    "src/components/chat/use-agent-chat.ts",
    "src/components/chat/tool-registry.ts",
    "src/components/chat/chat-state.ts",
  ]),
  item("chat-thread", "registry:component", "Scrolling transcript that follows the stream.", ["src/components/chat/chat-thread.tsx"]),
  item("chat-turn", "registry:component", "UserTurn, AssistantTurn, ChatParts; tools render via the registry.", ["src/components/chat/chat-turn.tsx"]),
  item("turn-actions", "registry:component", "Copy / good / bad row under a finished turn.", ["src/components/chat/turn-actions.tsx"]),
  item("composer", "registry:component", "Prompt box as parts: input, toolbar, attach, model select, submit.", ["src/components/chat/composer.tsx"]),
  item("chat-empty", "registry:component", "First screen: resting orb, greeting, suggestions.", ["src/components/chat/chat-empty.tsx"]),
  item("chat-status", "registry:component", "One-line conversation status.", ["src/components/chat/chat-status.tsx"]),

  // Reference widgets: complete, working examples of how uia is composed.
  // They install into src/examples/ to be read, run and adapted.
  item("example-model-router", "registry:block", "Example: model router with policy, routing flow, routes list and deploy.", ["src/examples/model-router.tsx"]),
  item("example-agent-runtime", "registry:block", "Example: scale-to-zero sandboxes with an isometric scene and invoke.", ["src/examples/agent-runtime.tsx"]),
  item("example-ai-spend", "registry:block", "Example: monthly AI spend by model against a budget, with alert and projection.", ["src/examples/ai-spend.tsx"]),
  item("example-model-evals", "registry:block", "Example (pt-BR): pass rate vs a baseline and a target, per-suite comparison, failures filtered by suite, re-run.", ["src/examples/model-evals.tsx"]),
  item("example-fleet-health", "registry:block", "Example: tokens/s with sparkline, fleet meters and a GPU heatmap.", ["src/examples/fleet-health.tsx"]),
  item("example-bottega", "registry:block", "Example page (pt-BR): an agent workshop — decisions strip, projects by stage, production, activity and the one conversation with decision cards.", [
    "src/examples/bottega/bottega.tsx",
    "src/examples/bottega/conversation.tsx",
    "src/examples/bottega/use-bottega.ts",
    "src/examples/bottega/data.ts",
  ]),
  item("example-davinci", "registry:block", "Example app: an agent coordinator as an inbox — decisions grouped by urgency (the urgent one glows), threads per project, projects by stage that scale to dozens of tasks, a log of what was decided for you, rules with switches; each view a route. Plus the one-chat version it replaced.", [
    "src/examples/davinci2/davinci2.tsx",
    "src/examples/davinci2/data.ts",
    "src/examples/davinci/davinci.tsx",
    "src/examples/davinci/cards.tsx",
    "src/examples/davinci/data.ts",
  ]),
  item("example-assistant", "registry:block", "Example: a scripted agent chat with questions, a draft and an approval.", [
    "src/examples/assistant/assistant.tsx",
    "src/examples/assistant/scripts.ts",
    "src/examples/assistant/tools.tsx",
  ]),
]

// Bundles: no files, just dependencies.
const BUNDLES = [
  bundle("chat", "Everything to build an agent chat.", [
    "agent-chat", "chat-thread", "chat-turn", "turn-actions", "composer", "chat-empty", "chat-status",
  ]),
  bundle("hitl", "All human-in-the-loop parts.", [
    "action-card", "ask-user", "confirmation", "draft-card", "preview-approval", "decision-chip", "part-transition", "tool-line",
  ]),
  bundle("examples", "Every reference widget, to read, run and adapt.", [
    "example-assistant", "example-model-router", "example-agent-runtime", "example-ai-spend", "example-fleet-health", "example-model-evals", "example-bottega", "example-davinci",
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

const fileOwner = new Map<string, string>()
for (const it of ITEMS) for (const f of it.files) fileOwner.set(f, it.name)
const overrides = new Set<string>(UI_OVERRIDES.map(([n]) => n))

function resolveAlias(spec: string): string | null {
  const base = spec.replace(/^@\//, "src/")
  for (const ext of [".tsx", ".ts"]) if (fileOwner.has(base + ext)) return base + ext
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
  if (path.startsWith("src/examples/")) return `~/${path}`
  return path
    .replace(/^src\/components\/ui\//, "@ui/")
    .replace(/^src\/components\//, "@components/")
    .replace(/^src\/lib\//, "@lib/")
    .replace(/^src\/hooks\//, "@hooks/")
}

/* ------------------------------ theme ------------------------------ */

const css = readFileSync("src/index.css", "utf8")
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
  files: [{ path: "src/typeset.css", type: "registry:file", target: "~/src/typeset.css" }],
  docs: 'Import it after Tailwind in your main CSS file: @import "./typeset.css";',
}

// The agent skill: one copy, in .agents/skills (where Codex and most agents
// look). Claude Code reaches it through CLAUDE.md → AGENTS.md; the registry
// never writes those two files, since projects already have their own.
const SKILL_FILES = ["SKILL.md", "references/tokens.md", "references/components.md", "references/hitl.md", "references/chat.md", "references/pitfalls.md", "references/examples.md", "references/grammar.md"]
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
      "widget", "stat", "segmented", "status", "tick-meter", "meter-bar", "sparkline", "stage-track", "number-ticker", "agent-orb", "model-icons",
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
