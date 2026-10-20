# Surfaces: UI the agent composes

When no prebuilt part or widget fits the moment, the agent describes a
screen and uia renders it: a dashboard assembled for this question, a
comparison inside a chat reply, a small form. The format is **A2UI v0.9**
(open spec, https://a2ui.org); the vocabulary is the **uia catalog**.

Three tiers, use the first that fits:

1. **A part or widget** through a typed tool (`tools` registry): the agent
   fills props of something we built (`DecisionCard`, `AiSpend`…).
2. **A surface** (this page): the agent composes from catalog entries.
3. Nothing else: no HTML, no code, no styling from the agent.

## The format, in one example

```json
[
  { "version": "v0.9", "createSurface": { "surfaceId": "reviews", "catalogId": "https://uia.imfrank.dev/catalog/v1.json" } },
  { "version": "v0.9", "updateDataModel": { "surfaceId": "reviews", "path": "/", "value": { "models": [{ "model": "Sonnet", "pass": 0.847, "cost": 0.09 }] } } },
  { "version": "v0.9", "updateComponents": { "surfaceId": "reviews", "components": [
    { "id": "root", "component": "Section", "title": "Code reviews", "children": ["table", "route"] },
    { "id": "table", "component": "Table", "rows": { "path": "/models" },
      "columns": [{ "key": "model", "label": "Model" }, { "key": "pass", "label": "Pass", "align": "end", "format": "percent" }] },
    { "id": "route", "component": "Button", "label": "Route reviews to Sonnet",
      "action": { "event": { "name": "route_reviews", "context": { "to": "sonnet" } } } }
  ] } }
]
```

- **Flat list with ids**; `children` are ids (or a template
  `{ "path": "/items", "componentId": "row" }` repeated per item, where
  relative paths read the item). Rendering starts at `"root"`.
- **Props are literals or bindings** `{ "path": "/pointer" }` into the data
  model. Data can be updated later (`updateDataModel`) without resending
  components: live dashboards.
- **Actions are named events**, never code. Their `context` resolves
  bindings at click time (form values).
- **Numbers are raw**; `format` (`currency`, `percent`, `integer`,
  `compact`, `duration`, `date`) and the host's `locale`/`currency` turn
  them into text. The agent never formats.
- **No styling from the agent**: only catalog names, enums (`tone`,
  `variant`, `columns`, `gap`, `span`) and data. Taste lives in the
  renderer; every composition looks like uia.

## The catalog (`public/catalog/v1.json`, prompt text in `v1.txt`)

Three layers; the agent prefers them from the top. A test of the same
incident composed from loose primitives vs one compound entry showed the
compound pixel-identical to the hand-made card and the primitives visibly
worse — the quality floor lives in the patterns.

| Layer | Entries |
| --- | --- |
| **pattern** — compound pieces the agent fills (prefer these) | `DecisionCard`, `Confirmation`, `Plan`, `Findings`, `StatusCard`, `ActivityItem` (+ `ActivityList`), `Policy`, `Diff`, `Citation`, `BeforeAfter`, `DecisionChip` |
| **block** — product views, an optional layer a product registers | `AiSpend` (`catalog-blocks`; add yours with `extendCatalog`) |
| layout | `Column`, `Row`, `Grid` (columns 1–4, children `span`, follows its own width), `Section` (title + white panel — the unit of a dashboard), `Card`, `Tabs`, `Divider` |
| data | `Stat` (value, format, unit, delta + `deltaIsGood`, meta), `Meter` (value or segments against max, markers), `Progress`, `BarSeries`, `Sparkline`, `Table`, `List` + `KeyValue`, `Stepper` |
| display | `Text` (title, body, muted, eyebrow, markdown), `Badge`, `Note` (badge + one sentence of new information), `Empty` |
| input | `Button`, `TextField`, `ChoicePicker`, `CheckBox`, `Slider` (two-way bound through `value`), `Confirm` |

Which pattern:
- a judgment call with options and the agent's pick → `DecisionCard`
- a gate before something happens (often destructive) → `Confirmation`
- a state to read, with its steps (incident, deploy) → `StatusCard`
- something done without asking → `ActivityItem` in an `ActivityList`
- a standing rule → `Policy` in a `PolicyList` (a switch, never a button)
- code to review → `Diff`; a visual change → `BeforeAfter`; the evidence
  for one claim → `Citation`; a multi-step job → `Plan`; ranked findings
  from a source → `Findings`; a pending decision in a "needs you" strip →
  `DecisionChip`

Composition rules (the runtime checks the ones marked ✓):
- One `Section` per question the screen answers; `Grid` of 2 for peers,
  `span: 2` for the wide one (a series, a decision).
- A `Section` leads with its answer: a `Stat` (or a pattern), then what
  explains it (`Meter`, `BarSeries`, `List`), then at most one `Note` ✓.
- Colour only for state: `tone` on `Badge`/`Note`/`KeyValue`; regressions
  get a tone, improvements stay muted.
- One loose primary `Button` per surface ✓; decisions go in
  `DecisionCard`/`Confirmation`, each with its own answer.
- In a chat reply (`layout: "inline"`, the default at `size="sm"`): at most
  2 loose buttons ✓, no `Tabs` ✓, grids of at most 2 columns ✓.

**Motion comes with the layout.** Two phases, decided by the renderer:
- **Building** (some referenced child hasn't arrived): the screen fills
  top-down; only the next missing child shows a skeleton, so nothing on
  screen gets pushed; each piece fades in where it lands (opacity + 4 px
  lift) as it replaces its skeleton. Nothing slides.
- **Complete** (every child arrived; `data-complete` on the surface): a
  change is a move — an item that leaves sinks and fades, the rest glide
  into the gap, a newcomer drops in from above (one `LayoutGroup` per
  surface, so a card can move between lists).

The agent never asks for any of it. For template children, give the item
key so identity survives updates: `{ "path": "/items", "componentId":
"row", "key": "id" }`.

## What the host owns

**Facts.** Counts, rates, money, durations and dates come from the data
model by binding. Entries list them in `facts` (e.g. `DecisionCard.agreement`,
`Policy.applied`): a literal is rejected (`UNBOUND_FACT`), the schema
published to the agent only accepts `{ "path" }` there, and the evals flag
numbers written into prose. The agent writes the why, never the how much.

**Settled is data.** A resolved card (`resolved` on `Confirmation`,
`StatusCard`, `Diff`, `BeforeAfter`) comes from the host updating the data
model, not from the agent deciding it's done.

**Actions.** The host registers the events it accepts and what each one is:

```ts
const actions = defineActions({
  approve: { reversible: true },
  integrate: { reversible: false },          // shows "Irreversible"
  rollback: { destructive: true },          // only inside a confirmation
  undo: { reversible: (ctx) => isUndoable(ctx.id) }, // per call, still the host's call
})
<Surface … actions={actions} />
```

Unregistered events don't render (`UNKNOWN_ACTION`); a destructive event on
a plain control doesn't render (`UNCONFIRMED_DESTRUCTIVE`); "Irreversible",
Undo and "Final" come from the registry. Whatever the agent marks is
ignored. In a product, each name maps to its real action contract
(receipts, idempotency).

**Look.** No classes, colours, fonts or spacing in any schema: only enums
(`tone`, `variant`, `columns`, `gap`, `span`) and data.

## Validate twice, and evaluate

- `validateSurface(surface, catalog, { actions, layout })` is the same check
  `<Surface>` runs, as a pure function: run it where the agent runs, before
  sending, and send issues back so it fixes them.
- `bun run eval:surfaces` checks agent outputs in
  `evals/surfaces/outputs/<case>.<run>.json` against the cases in
  `evals/surfaces/cases.ts`: inbox routing (only the owner's decisions ask),
  facts bound (no numbers in prose), a resolved incident is a record not a
  question, destructive actions only confirmed. `.good`/`.bad` runs show
  what passes and what doesn't.
- For visual quality, compare against the hand-made reference (the
  `/compare` experiment): pixel-identical for patterns, pairwise judged for
  free compositions.

## Rendering

```tsx
import { Surface } from "@/components/surface/surface"
import { createSurfaceStore, useSurface, surfaceFromMessages } from "@/components/surface/store"
import { uiaCatalog } from "@/components/catalog"

// A page: keep a store, feed it messages as they arrive (stream them).
const store = createSurfaceStore()
store.process(messages)
const surface = useSurface(store, "cost-quality")
<Surface surface={surface} catalog={uiaCatalog} onAction={sendToAgent} onIssue={reportToAgent} />

// Inside a chat reply: a client tool whose input is the messages; the
// person's action is the tool output, and the turn continues with it.
renderUI: {
  client: true,
  render: (part, ctx) => (
    <Surface surface={surfaceFromMessages(part.input?.messages)} catalog={uiaCatalog} size="sm"
      onAction={(a) => ctx.addOutput({ name: a.name, context: a.context })} />
  ),
}
```

- **Streaming**: nothing renders until `root` exists; a child that hasn't
  arrived is a skeleton. Send the data first, then components.
- **Validation**: each node is checked against its schema. An unknown
  component or invalid props drops that node (a placeholder with
  `showIssues`) and calls `onIssue({ componentId, code, message })` —
  send it back so the agent fixes and resends. A node may name a
  `fallback` id. Limits: 400 nodes, depth 16.
- **Size**: `size="sm"` in a chat; layout follows the surface's width
  (container queries), so a `Grid` of 3 is one column in a reply.

## Autofix

Before validating, the runtime repairs what is unambiguous — a component
name or enum value in the wrong case (`column` → `Column`, `Warning` →
`warning`), a number sent as text (`"2"` → `2`) — and reports each repair
as `AUTOFIXED`. Send those back too: the agent stops making the mistake.
Anything ambiguous is left to validation.

## OpenUI Lang as input

Models can write the same surface in OpenUI Lang
(https://www.openui.com/docs/openui-lang), a line syntax at about half
the size of the JSON (fewer tokens, faster first paint):

```
root = Grid([spend, decision], 2)
spend = Section("Spend", "October", [spent])
spent = Stat("Spent", @Path("/spend/total"), "currency", "/ $1,500")
decision = DecisionCard("davinci", null, "Move reviews to Sonnet?", null, null, null, null, null,
  [{label: "Move", action: @RouteReviews({to: "sonnet"})}], null, null, {span: 2})
```

`openUIToMessages(text, catalog, { surfaceId, streaming })` turns it into
the same A2UI messages, so the catalog, the host's actions and facts, and
validation all apply; `catalogToOpenUIPrompt(catalog)` writes the
signatures for the prompt. Positional arguments follow each entry's prop
order. uia conventions: `@Path("/x")` binds a fact, `@Each("/items", row,
"id")` is a template list, `@SomeAction({…})` is the event `some_action`, an
extra trailing `{span, fallback}`. Left out on purpose (they put logic in
the model's hands): `$variables`, ternaries and operators, Query, Mutation,
functions — a line that uses them is dropped and reported. Prefer JSON
(A2UI) by default; reach for OpenUI Lang when big screens make tokens or
latency matter. See `example-surface` → "OpenUI Lang".

## Extending

```tsx
const Deploys = defineComponent({
  name: "Deploys", kind: "block",
  description: "Recent deploys with status; use for 'what shipped'.",
  props: z.object({ items: z.array(z.object({ version: z.string(), status: z.enum(["live", "failed"]) })) }),
  render: (p, ctx) => <MyDeploysWidget items={p.items} size={ctx.size} />,
})
export const catalog = extendCatalog(uiaCatalog, [Deploys], "https://acme.dev/catalog/v1.json")
```

Keep the agent's prompt small: load layers per surface
(`catalogToPrompt(catalog, { kinds: ["pattern", "data", "display"] })` for a
chat reply) and register only the product blocks you show. A domain name
(davinci's "IncidentCard") belongs in the product's catalog, usually as a
thin entry over a uia pattern (`Confirmation`).

See `example-davinci-surface`: the davinci inbox as an agent sends it,
bound to the factory's data, with the factory's action contract.

Give the agent `catalogToPrompt(catalog)` (or the published `.txt`) in the
tool description, and publish `catalogToJSONSchema(catalog)` at the
catalog id. Registry: `surface` (runtime), `catalog` + `catalog-*` groups,
bundle `surfaces`; example `example-surface`.
