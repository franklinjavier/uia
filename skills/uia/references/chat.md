# Chat

How to assemble a chat with the uia kit. Built on the AI SDK v5+ (`ai`,
`@ai-sdk/react`); the kit adds state, the tool registry and the pieces.

## 1. Type the message and its tools

Tools are typed once on the server (or with `createChat` for client-only
demos) and the UI derives from `UIMessage<…, …, Tools>`:

```ts
import type { InferUITools, UIMessage } from "ai"
export type ChatMessage = UIMessage<unknown, never, InferUITools<typeof serverTools>>
```

Server tools that need consent: `tool({ …, needsApproval: true })`.
Client tools (the person produces the output): declare them without
`execute` — the UI supplies the output.

## 2. Register how each tool renders

```tsx
import { defineTools } from "@/components/chat/tool-registry"

export const tools = defineTools<ChatMessage>()({
  searchDocs: {
    phase: "searching",            // what the orb shows while it runs
    render: (part) => <Trace><ToolLine part={part} titles={…} /></Trace>,
  },
  askQuestions: {
    client: true,                  // the chat waits for ctx.addOutput
    render: (part, ctx) => …,
  },
  createIssues: {                  // needsApproval on the server
    render: (part, ctx) => …ctx.respond(true)…,
  },
})
```

`render(part, ctx)` gets the fully typed part (`part.input`, `part.output`,
`part.state`) and:

- `ctx.addOutput(output)` — finish a client tool; the turn continues.
- `ctx.respond(approved)` — answer an approval request.
- `ctx.streaming` — the turn is still streaming.

Parts the registry doesn't know fall back to a generic `ToolLine`, so a new
server tool never breaks the transcript — but give every tool a proper entry.

Render `null` for states you don't want to show (e.g. `input-streaming` of a
client tool, so a half-built card never flashes).

## 3. The hook

```tsx
const chat = useAgentChat<ChatMessage>({ transport, tools })
// chat.messages, sendMessage, stop, addToolOutput, addToolApprovalResponse  (from useChat)
// chat.busy      submitted or streaming
// chat.waiting   the last turn waits on the person (open client tool / approval)
// chat.phase     AgentPhase for the orb
// chat.activeIndex  the live assistant turn, or -1
// chat.state     "streaming" | "waiting" | "ready" | "error"
```

It auto-sends after a client tool is answered or approvals are responded to,
and never after a server tool that finished in-stream (that would loop).

## 4. Assemble

```tsx
<ChatThread busy={chat.busy}>
  {chat.messages.map((message, index) => (
    <ChatThreadItem key={message.id} message={message}>
      <ChatTurn
        message={message}
        tools={tools}
        phase={chat.phase}
        active={index === chat.activeIndex}
        streaming={chat.busy && index === chat.messages.length - 1}
        pending={chat.waiting && index === chat.messages.length - 1}
        onToolOutput={(tool, toolCallId, output) => chat.addToolOutput({ tool, toolCallId, output } as never)}
        onApproval={(id, approved) => chat.addToolApprovalResponse({ id, approved })}
      />
    </ChatThreadItem>
  ))}
</ChatThread>

<Composer onSubmit={send}>
  <ComposerInput value={input} onChange={(e) => setInput(e.target.value)}
    placeholder={chat.waiting ? "Answer above to continue…" : "Ask anything…"} />
  <ComposerToolbar>
    <ComposerAttach />
    <ComposerModelSelect models={MODELS} value={model} onValueChange={setModel} />
    <ComposerMic className="ml-auto" />
    <ComposerSubmit busy={chat.busy} onStop={chat.stop} disabled={!input.trim() || chat.waiting} />
  </ComposerToolbar>
</Composer>
```

Empty conversation → `ChatEmpty` with 2–4 `ChatSuggestion`s (icon + a real
task phrased as the person would type it).

### Layouts

**Full page** — header (orb + title) with a bottom hairline, the thread fills
the middle, content column `mx-auto max-w-[720px]`, composer in a card at the
bottom (`rounded-2xl border bg-card shadow-xs`) inside the same column. Page
background `bg-background`. Nothing under the composer.

**Widget** — `Widget` shell: `WidgetHeader` (orb + title), a `WidgetPanel
className="h-[480px] p-0"` holding the thread, a `WidgetPanel className="p-0"`
holding the composer, and an optional `WidgetFooter` with `ChatStatus`.

**Embedded parts only** — when the host app already has its chat and you only
add tool UIs, you only need the registry entries (`render`) and the
parts; match the host's container width and keep cards full-width of
the message column.

## Models

```tsx
const MODELS = {
  claude: { name: "Claude", provider: "Anthropic", icon: <ModelIcon family="claude" /> },
  gpt: { name: "GPT", provider: "OpenAI", icon: <ModelIcon family="openai" /> },
}
```

## Phases

`AgentPhase`: `idle → connecting → thinking → searching/working → composing`,
`waiting` when the person holds the turn. `useAgentChat` derives it; set a
tool's `phase` so its run shows the right orb state.
