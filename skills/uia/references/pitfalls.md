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

**"Fits" on a narrow desktop window, overflows on the phone.** Desktop
Chrome (and its headless mode) has a minimum window width around 500 px, so
a 390 px screenshot is laid out wider than a phone. Emulate a device, then
list what sticks out past the visual viewport:

```js
const W = visualViewport.width
;[...document.querySelectorAll("body *")]
  .filter((e) => e.getBoundingClientRect().right > W + 1)
  .filter((e) => ![...e.children].some((c) => c.getBoundingClientRect().right > W + 1))
  .map((e) => (e.dataset.slot || e.tagName) + " " + (e.textContent || "").trim().slice(0, 30))
```

An empty list means nothing overflows; then look at it for crushed text.

**iOS zooms in when a field gets focus.** Safari zooms into any input,
textarea or select under 16px. The theme sets every field to 16px on touch
screens (`@media (pointer: coarse)`, `!important` so it beats `text-sm`),
desktop keeps the compact size. Don't fix it with `maximum-scale=1` in the
viewport meta: that also blocks pinch zoom on Android. If a project lacks
the rule, it's missing the uia `theme` item.

**Select items touching the edges.** Padding is on the list, not on groups —
keep uia's `select`; don't wrap items in extra padded divs.

**The orb shrinks to a dim dot in a nav.** `[&_svg]:size-4` on a button
resizes every nested SVG, including the `AgentOrb`, and a still orb is
already at 60% opacity. Size icons in their own wrapper
(`[&>svg]:size-4`) and give the orb `opacity-100` when it stands for a place.

**A row's divider curls at the ends.** `border-t` on a `rounded-*` element
follows the radius. Draw separators as an inset `before:` hairline
(`WidgetListRow` does) and never border one side of a rounded box.

**The first message enters dry.** An empty state that swaps to the thread
on the first send mounts the thread *with* that message, so "present at
mount" would read it as history. `ChatThread` treats a thread that opens
on ≤2 turns as live; don't re-implement turn entrances around it.

**Motion keyframes with `as const` don't type-check** (readonly arrays).
Type the map with `satisfies Record<string, TargetAndTransition>` instead.

**Deep links 404 in production.** Path routes need the host to serve
`index.html` for unknown paths: Cloudflare Workers assets
`"not_found_handling": "single-page-application"` (Vite's dev server
already does it). Keep query flags (`?bare`, `?busy`) when navigating.

**The glow vanishes instead of fading.** Unmounting a card kills its
transition. Switch `tone` to `"default"` first, wait for the drain
(~300 ms), then remove or resolve the card.
