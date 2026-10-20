# Human-in-the-loop

A generative UI earns trust by being clear about three things: what the agent
needs from the person, what will happen if they say yes, and what actually
happened afterwards. Every pattern below exists to answer one of those.

## Choosing the pattern

| The agent… | Pattern | Component |
| --- | --- | --- |
| is missing information it can't infer | Ask | `AskUser` (client tool) |
| produced something that will go out in the person's name (email, post, message, PR description) | Draft = approval | `DraftCard` (client tool) |
| wants to run something with side effects (create, delete, pay, invite, deploy) | Gate | `Confirmation` (AI SDK `needsApproval`) |
| needs a choice between a few concrete options with consequences | Custom ActionCard | `ActionCard` parts + buttons per option |
| is doing something the person should see but not stop | Trace | `ToolLine` / `TranscriptEvent` |

If you're unsure whether to gate: does it change something outside the chat,
cost money, or reach other people? Gate it. Reading and searching never gate.

## The life of a moment

Every HITL part has the same three phases. Design all three, always.

1. **Asking** — a full card (`ActionCard` family). Title says *who wants to do
   what* ("Assistant wants to create 4 issues in Linear"), a status pill in
   `attention` says it's waiting ("Approval needed", "Needs your answer"),
   then the minimum context, details behind a disclosure, a trust note, and
   the actions. The chat's `waiting` is true; the composer should say
   "Answer above to continue…".
2. **Working** (if the result isn't instant) — `TranscriptEvent` with a
   `shimmer` line ("Creating 4 issues…"). Not a spinner; the orb already
   moves.
3. **Resolved** — the card shrinks to a record:
   - `ResolvedRow` with icon · label · past-tense summary, expandable to the
     record (the list created, the body sent, the answers given).
   - `muted` (dimmed) when it didn't go ahead: denied, discarded, skipped. Use
     an icon that says so (`BanIcon`, `Trash2Icon`).
   - A single answered question becomes a small static card (question +
     `AnswerKey`) instead of a row — the answer is the content.

Wrap the part in `PartTransition state={…}` keyed on the phase so the card
closes into its record (height eases, content crossfades) instead of jumping.

## Copy

- Title: "Assistant wants to {verb} {object} {where}". Concrete numbers and
  names ("12 threads", "#launch", "Linear"), not "some items".
- Status pill: short state, not an instruction. "Approval needed", "Ready",
  "Sent", "Denied".
- Description: one or two lines of *why* or *what exactly*. Skip if the title
  says it all.
- Disclosure labels: "Show the {thing}" / "Hide the {thing}".
- Note (fine print): what the person can undo or where to find it later. "You
  can close or edit them in Linear afterwards." "Nothing is sent until you
  press Send."
- Buttons: the verb of the action ("Send email", "Create issues", "Archive"),
  not "OK"/"Confirm". Decline is "Deny", "Discard" or "Not now" depending on
  what's being declined.
- Resolved summary: past tense, with the outcome. "Sent email · Beta list ·
  1,284 people", "Denied · create 4 issues".

## Honesty rules

- **Never claim an action happened** that the tool output didn't confirm. The
  assistant's follow-up text reads from the output ("Sent to 1,284 people")
  and handles denial plainly ("Okay, I didn't create them.").
- **Respect the answer.** If the person picked "Formal", the draft is formal;
  if they skipped, say what you assumed.
- **Edits are the person's.** A `DraftCard` body is editable; send the edited
  body (`onSend(body)`), and show that body in the resolved record.
- One decision per card. Don't stack two gates; merge them or sequence them.

## Questions (`AskUser`)

```tsx
<AskUser
  questions={[{ id: "channel", question: "Which channel is this for?", choices: ["Email", "Blog", "X thread"] }]}
  onSubmit={(answers) => ctx.addOutput({ answers })}
  onSkip={() => ctx.addOutput({ answers: {} })}
/>
```

- 1–3 questions, each with 2–4 choices; a free-text answer is always
  available. One question at a time (Back/Next for several).
- Ask only what changes the result. If a sensible default exists, use it and
  say so instead of asking.
- Answered: `<AskUserAnswered questions answers />` (single → card, multiple
  → expandable row, skipped → muted row).

## Drafts (`DraftCard`)

```tsx
const draft: Draft = {
  kind: "New email", app: "Mail", icon: "mail",
  title: "The new dashboard is live",
  fields: [{ label: "To", value: "Beta list" }, { label: "From", value: "product@example.com" }],
  summary: "Beta list · 1,284 people",
  body: "Hi there,\n\n…",
  sendLabel: "Send email", sentVerb: "Sent email",
}
<DraftCard draft={draft} state={status} sentBody={sentBody}
  onSend={(body) => ctx.addOutput({ status: "sent", body })}
  onDiscard={() => ctx.addOutput({ status: "discarded" })} />
```

The card is its own approval: no separate Confirmation after it.

## Approvals (`Confirmation`)

Server tool declared with `needsApproval: true` in the AI SDK. The part comes
in as `state: "approval-requested"`; answer with `ctx.respond(true|false)`.
Use `toolPhase(part)` to get `running | done | error | denied` afterwards.
Full example: the `createIssues` entry in `chat.md`.

## Building a new HITL card

When none of the ready-made ones fit (choose a meeting slot, pick a plan,
approve a refund amount), compose `ActionCard` parts. Keep the order:
header (title + status) → description → panel(s) → note → actions. Put the
choice inside a panel (a list of `Item`s, `ActionCardFields`, a small form),
keep one primary button, and give it a resolved state the same way. Make it a
`client: true` tool if the person's choice *is* the tool output.
