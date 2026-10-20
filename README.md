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
3. **Read `.claude/skills/uia/SKILL.md` before writing any UI** and follow it.
   It has the setup checks (`typeset.css`, `TooltipProvider`), the patterns
   (widgets, chat, human-in-the-loop), the tokens and the known pitfalls. The
   skill is installed mid-session, so it may not load on its own: open it.

## Layers

```
src/components/
  ui/            shadcn primitives (owned; a few tuned: button, select, bubble,
                 code-block, questionnaire, spinner, message-scroller)
  ds/            system pieces: Widget (+ WidgetList), Stat, Segmented, Status,
                 TickMeter, MeterBar, Sparkline, NumberTicker, AgentOrb, ModelIcon
  parts/         generative-UI parts: ActionCard*, ResolvedRow, TranscriptEvent,
                 AskUser, Confirmation, DraftCard, PartTransition, ToolLine,
                 Reasoning, Sources, SearchResults, Markdown
  chat/          chat kit: useAgentChat, tool registry, ChatThread, ChatTurn,
                 Composer*, ChatEmpty, ChatStatus, TurnActions
src/lib/         motion, ai, url, highlighter
src/examples/    reference widgets (registry blocks) — never imported by components/
```

Every piece is a composable part (`data-slot`, `className`, props passthrough).
Bigger patterns (Confirmation, DraftCard…) are ready-made compositions of
smaller parts you can also use directly.

## Registry: install pieces in other projects

`registry.json` is generated from the source (imports → dependencies, tokens
from `src/index.css`). Rebuild it after changing or adding components:

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
| System | `widget`, `stat`, `segmented`, `status`, `tick-meter`, `meter-bar`, `sparkline`, `number-ticker`, `agent-orb`, `model-icons` |
| Generative UI | `action-card`, `ask-user`, `confirmation`, `draft-card`, `part-transition`, `tool-line`, `reasoning`, `sources`, `search-results`, `markdown` |
| Chat | `agent-chat`, `chat-thread`, `chat-turn`, `turn-actions`, `composer`, `chat-empty`, `chat-status` |
| Bundles | `uia`, `chat`, `hitl` |
| Lib | `motion`, `ai`, `url`, `highlighter` |
| Examples | `examples` (bundle), `example-assistant`, `example-model-router`, `example-agent-runtime`, `example-ai-spend`, `example-fleet-health`, `example-model-evals` |
| Agent skill | `skill` |

```bash
npx shadcn@latest list franklinjavier/uia       # browse
npx shadcn@latest view franklinjavier/uia/chat  # inspect before installing
```

### Agent skill

`skills/uia/` teaches coding agents to build with uia the way it was designed
(patterns, tokens, HITL copy, pitfalls). It comes with the `uia` bundle, or:

```bash
npx shadcn@latest add franklinjavier/uia/skill   # → .claude/skills/uia/
```

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

See `src/examples/assistant/tools.tsx` for a complete example.

## License

MIT. Model marks in `model-icons` come from [LobeHub Icons](https://github.com/lobehub/lobe-icons) (MIT).
