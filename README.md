# uia

Design system for AI products: shadcn (Base UI, `base-rhea`) + our tokens,
generative-UI parts for human-in-the-loop flows, and a composable chat kit.

```bash
bun install
bun run dev            # playground: Model router · Assistant · Full chat
```

## Layers

```
src/components/
  ui/            shadcn primitives (owned; a few tuned: button, select, bubble,
                 code-block, questionnaire, spinner, message-scroller)
  ds/            system pieces: Widget, Stat, Segmented, Status, TickMeter,
                 NumberTicker, AgentOrb
  ai-elements/   generative-UI parts: ActionCard*, ResolvedRow, TranscriptEvent,
                 AskUser, Confirmation, DraftCard, PartTransition, ToolLine,
                 Reasoning, Sources, SearchResults, Markdown
  chat/          chat kit: useAgentChat, tool registry, ChatThread, ChatTurn,
                 Composer*, ChatEmpty, ChatStatus, TurnActions
src/lib/         motion, ai, url, highlighter
src/playground/  demos only — never imported by components/
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

1. Point the `@uia` namespace at the built JSON in the project's
   `components.json`:

   ```json
   {
     "registries": {
       "@uia": "http://localhost:5173/r/{name}.json"
     }
   }
   ```

   Local: run `bun run dev` here. Hosted: any static URL serving `public/r`,
   e.g. a deploy of this repo, or
   `https://raw.githubusercontent.com/<owner>/uia/main/public/r/{name}.json`.

2. Install what you need. Dependencies (other pieces, tokens, npm packages,
   upstream shadcn primitives) come along automatically.

   ```bash
   npx shadcn@latest add @uia/uia          # everything
   npx shadcn@latest add @uia/chat         # chat kit
   npx shadcn@latest add @uia/hitl         # human-in-the-loop parts
   npx shadcn@latest add @uia/confirmation # one piece
   ```

   Use `--overwrite` when the project already has `button`, `select`, … so our
   tuned versions replace the stock ones.

3. Import `typeset.css` after Tailwind in your main CSS
   (`@import "./typeset.css";`) and wrap the app in `TooltipProvider`.

### Items

| Group | Items |
| --- | --- |
| Foundation | `theme`, `font-inter`, `font-geist-mono`, `typeset` |
| Primitives (tuned) | `button`, `select`, `bubble`, `code-block`, `questionnaire`, `spinner`, `message-scroller` |
| System | `widget`, `stat`, `segmented`, `status`, `tick-meter`, `number-ticker`, `agent-orb` |
| Generative UI | `action-card`, `ask-user`, `confirmation`, `draft-card`, `part-transition`, `tool-line`, `reasoning`, `sources`, `search-results`, `markdown` |
| Chat | `agent-chat`, `chat-thread`, `chat-turn`, `turn-actions`, `composer`, `chat-empty`, `chat-status` |
| Bundles | `uia`, `chat`, `hitl` |
| Lib | `motion`, `ai`, `url`, `highlighter` |

```bash
npx shadcn@latest list @uia      # browse
npx shadcn@latest view @uia/chat # inspect before installing
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

See `src/playground/assistant/tools.tsx` for a complete example.
