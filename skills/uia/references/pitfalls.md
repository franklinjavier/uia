# Pitfalls

Real bugs met while building uia. Each costs time to rediscover.

**Rings get clipped inside the transcript.** `MessageScrollerItem` uses
`content-visibility`, which clips outside paint. Use `border` (not `ring`) for
card outlines inside messages; keep shadows to `shadow-xs` and give
`PartTransition` its built-in `pb-1`.

**Cards fly in from the top.** `layout` / `layout="position"` on anything in a
streaming transcript animates every reflow while text streams and the scroller
anchors. Appear in place (`initial={{ opacity: 0, y: 4 }}`) and use
`PartTransition` for state changes.

**Hyphens spread out in tables.** `tabular-nums` in Inter also makes "-" and
spaces tabular ("Re - issue"). Apply it to the numeric cell only, never to a
row, list or table.

**Questions come back pre-answered.** Browsers restore form state after a
reload/back. Forms that render agent questions need `autoComplete="off"`
(`AskUser` already does).

**Red fields for a missing answer.** Errors are one quiet line that points at
what's missing ("Pick an option or type your own answer."), no red borders.

**Autostart runs twice (or zero times) in dev.** StrictMode mounts, unmounts,
mounts. Kick off with `setTimeout` inside the effect and clear it in cleanup.

**The chat loops after a server tool.** Don't auto-send just because the last
message has tool results: only after a client tool was answered or approvals
were responded to (`useAgentChat` does this).

**A utility silently disappears.** tailwind-merge drops unknown `text-*`
classes it thinks conflict with `text-sm` etc. That's why the label utility is
`eyebrow`, not `text-eyebrow`. Name custom utilities so they don't look like a
Tailwind group.

**Mono font on the whole page.** The Geist Mono font item targets
`code, kbd, pre, samp`; don't set `font-mono` on `html`/`body`.

**Prose too big inside typeset.** `.typeset` sets its own font size;
`.typeset-chat` resets it to 14px. Use `Markdown`, don't wrap prose in
`.typeset` yourself.

**Dark mode done by hand.** Every token already has a dark value. If you
reach for `dark:` overrides, you're probably using a raw colour. Exceptions
are few and live in the primitives (e.g. disabled ink button).

**Two things spinning.** The orb is the working indicator. A spinner in a
card ("Approval needed" pill) is acceptable only because it signals *waiting
on you*, not *working*. Don't add spinners to tool lines or buttons while the
agent works.

**Typecheck that checks nothing.** The shadcn Vite template's root
`tsconfig.json` has `files: []` and only references the app config, so
`tsc --noEmit` passes no matter what. Use `tsc -p tsconfig.app.json --noEmit`.

**State survives hot reload.** Fast refresh keeps `useState` values, so
changing initial data (positions, mocks) doesn't show until a full reload.
Reload before judging a layout change.

**Select items touching the edges.** Padding is on the list, not on groups —
keep uia's `select`; don't wrap items in extra padded divs.
