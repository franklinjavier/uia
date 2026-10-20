# uia

Design system for AI products: shadcn (Base UI, `base-rhea`) + our tokens,
generative-UI parts for human-in-the-loop flows, and a composable chat kit.

```bash
bun install
bun run dev            # playground: every example widget + full chat
```

## For coding agents

Building UI with uia in another project? Do this first:

1. **New project** (skip if one exists; it must be shadcn with Base UI):
   ```bash
   bunx --bun shadcn@latest create --preset beqC8BzE --template vite --name app --no-monorepo
   ```
2. **Install the whole system** from this repo.
   It brings tokens, fonts, components and the agent skill:
   ```bash
   npx shadcn@latest add franklinjavier/uia/uia franklinjavier/uia/examples --overwrite
   ```
   `examples` adds the reference widgets to `src/examples/`: start every new
   screen from the closest one.
3. **Point the project's agents at the skill** (once). The skill lands in
   `.agents/skills/uia/`. Add this section to `AGENTS.md` (create it if
   missing; never replace what's there):
   ```md
   ## UI: uia design system
   Before building or changing any UI, read `.agents/skills/uia/SKILL.md`
   and follow it. Start every screen from the closest example in `src/examples/`.
   ```
   And make `CLAUDE.md` import it (add the line if the file exists):
   ```md
   @AGENTS.md
   ```
4. **Read the skill now** (`.agents/skills/uia/SKILL.md`) before writing any
   UI. It has the setup checks (`typeset.css`, `TooltipProvider`), the
   patterns, the tokens and the known pitfalls.

## Layers

```
registry/              everything that ships, one registry item per piece
  ui/                  shadcn primitives (owned; tuned ones ship as overrides)
  ds/                  system: Widget (+ WidgetList), Stat, Segmented, Status,
                       TickMeter, MeterBar, Sparkline, BarSeries, Stepper,
                       TaskList, NumberTicker, AgentOrb, ModelIcon
  parts/               generative UI / human-in-the-loop: ActionCard, DecisionCard,
                       AskUser, Confirmation, PreviewApproval, DecisionChip,
                       DraftCard, Plan, ConnectPrompt, Findings, ChartCard,
                       Attachment, PartTransition, ToolLine, Reasoning, Sources…
  chat/                chat kit: useAgentChat, tool + data registries, ChatThread,
                       ChatTurn, Composer*, ChatEmpty, ChatError, ChatPill…
  widgets/             data-driven widgets with typed props (AiSpend, FleetHealth,
                       ModelEvals, ModelRouter, AgentRuntime)
  app/                 agent-app shell: AppNav, ThemeToggle
  lib/ hooks/ theme/   motion, ai, url, highlighter; tokens (index.css), typeset
  examples/            fixtures: demo data + simulation over the widgets and parts
playground/            the demo app (router, dock, pages) — not shipped
skills/uia/            the agent skill (ships as the `skill` item)
scripts/registry.ts    generates registry.json from the source
```

Every piece is a composable part (`data-slot`, `className`, props passthrough).
Bigger patterns (Confirmation, DraftCard…) are ready-made compositions of
smaller parts you can also use directly.

## Registry: install pieces in other projects

`registry.json` is generated from the source (imports → dependencies, tokens
from `registry/theme/index.css`). Rebuild it after changing or adding components:

```bash
bun run registry:build   # registry.json + public/r/*.json
```

To add a new component: create the file, add one line to `ITEMS` in
`scripts/registry.ts`, run the command above.

### Use it in a project

Install straight from GitHub. No server, no config: dependencies (other
pieces, tokens, npm packages, upstream shadcn primitives) come along.

```bash
npx shadcn@latest add franklinjavier/uia/uia           # everything
npx shadcn@latest add franklinjavier/uia/chat          # chat kit
npx shadcn@latest add franklinjavier/uia/hitl          # human-in-the-loop parts
npx shadcn@latest add franklinjavier/uia/confirmation  # one piece
```

- **Private fork?** Run `gh auth login` once; the CLI reads the repo through
  your `gh` credentials. In CI, set `GH_TOKEN` (fine-grained, Contents: read).
- **Pin a version:** append a tag or commit, e.g. `franklinjavier/uia/chat#v0.1.0`.
- Use `--overwrite` when the project already has `button`, `select`, … so our
  tuned versions replace the stock ones.
- Then import `typeset.css` after Tailwind in your main CSS
  (`@import "./typeset.css";`) and wrap the app in `TooltipProvider`.

#### Alternative: hosted JSON under a namespace

For a static host (or `bun run dev` here, serving `public/r`), build with a
namespace and point projects at it:

```bash
UIA_REGISTRY=@uia bun run registry:build
```

```json
// components.json of the consuming project
{ "registries": { "@uia": "https://your-host/r/{name}.json" } }
```

```bash
npx shadcn@latest add @uia/chat
```

### Items

| Group | Items |
| --- | --- |
| Foundation | `theme`, `font-inter`, `font-geist-mono`, `typeset` |
| Primitives (tuned) | `button`, `select`, `bubble`, `code-block`, `questionnaire`, `spinner`, `message-scroller` |
| System | `widget`, `stat`, `segmented`, `status`, `tick-meter`, `meter-bar`, `sparkline`, `stepper`, `number-ticker`, `agent-orb`, `model-icons` |
| Generative UI | `action-card`, `ask-user`, `confirmation`, `preview-approval`, `decision-chip`, `draft-card`, `part-transition`, `tool-line`, `reasoning`, `sources`, `search-results`, `markdown` |
| Chat | `agent-chat`, `chat-thread`, `chat-turn`, `turn-actions`, `composer`, `chat-empty`, `chat-status` |
| Bundles | `uia`, `chat`, `hitl` |
| Lib | `motion`, `ai`, `url`, `highlighter` |
| Examples | `examples` (bundle), `example-assistant`, `example-model-router`, `example-agent-runtime`, `example-ai-spend`, `example-fleet-health`, `example-model-evals`, `example-bottega` (page) |
| Agent skill | `skill` |

```bash
npx shadcn@latest list franklinjavier/uia       # browse
npx shadcn@latest view franklinjavier/uia/chat  # inspect before installing
```

### Agent skill

`skills/uia/` teaches coding agents to build with uia the way it was designed
(patterns, tokens, HITL copy, pitfalls). It comes with the `uia` bundle, or:

```bash
npx shadcn@latest add franklinjavier/uia/skill   # → .agents/skills/uia/
```

One copy for every agent: `AGENTS.md` points at it (Codex, Cursor and most
agents read that file) and `CLAUDE.md` imports `AGENTS.md` for Claude Code.
See step 3 of "For coding agents" for the two snippets.

### Rendering your own tools

The chat renders text, reasoning and sources itself; tools come from a typed
registry you pass in:

```tsx
const tools = defineTools<MyMessage>()({
  webSearch: { phase: "searching", render: (part) => <ToolLine … /> },
  askQuestions: {
    client: true, // the person supplies the output
    render: (part, ctx) => <AskUser onSubmit={(a) => ctx.addOutput({ answers: a })} … />,
  },
  createIssues: { render: (part, ctx) => <Confirmation onAllow={() => ctx.respond(true)} … /> },
})

const chat = useAgentChat<MyMessage>({ transport, tools })
<ChatTurn message={m} tools={tools} phase={chat.phase} … />
```

See `registry/examples/assistant/tools.tsx` for a complete example.

## Deploy (Cloudflare)

The playground and the registry are static: `wrangler.jsonc` serves `dist/`
as Workers static assets, so `/r/<item>.json` is a public registry too.

```bash
bunx wrangler login     # once
bun run deploy          # build + publish (uia.imfrank.dev, also uia.<subdomain>.workers.dev)
bun run cf:preview      # build + serve locally like production
```

To deploy on every push instead: Cloudflare dashboard → Workers & Pages →
Create → Import a repository → this repo, build command `bun run build`,
deploy command `npx wrangler deploy`.

Once deployed, projects can install from it without GitHub:

```json
// components.json
{ "registries": { "@uia": "https://uia.<your-subdomain>.workers.dev/r/{name}.json" } }
```

(Build with `UIA_REGISTRY=@uia bun run registry:build` first, so items
reference each other through the namespace.)

## License

MIT. Model marks in `model-icons` come from [LobeHub Icons](https://github.com/lobehub/lobe-icons) (MIT).
