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
  { "version": "v0.9", "createSurface": { "surfaceId": "reviews", "catalogId": "https://uia.frank-47e.workers.dev/catalog/v1.json" } },
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

| Group | Entries |
| --- | --- |
| block (prefer when the intent matches) | `DecisionCard`, `Plan`, `Findings`, `AiSpend` |
| layout | `Column`, `Row`, `Grid` (columns 1–4, children `span`, follows its own width), `Section` (title + white panel — the unit of a dashboard), `Card`, `Tabs`, `Divider` |
| data | `Stat` (value, format, unit, delta + `deltaIsGood`, meta), `Meter` (value or segments against max, markers), `Progress`, `BarSeries`, `Sparkline`, `Table`, `List` + `KeyValue`, `StageTrack` |
| display | `Text` (title, body, muted, eyebrow, markdown), `Badge`, `Note` (badge + one sentence of new information), `Empty` |
| input | `Button`, `TextField`, `ChoicePicker`, `CheckBox`, `Slider` (two-way bound through `value`), `Confirm` (required before anything destructive) |

Composition rules the renderer can't enforce, so the agent must:
- One `Section` per question the screen answers; `Grid` of 2 for peers,
  `span: 2` for the wide one (a series, a decision).
- A `Section` leads with its answer: a `Stat` (or a block), then what
  explains it (`Meter`, `BarSeries`, `List`), then at most one `Note`.
- Colour only for state: `tone` on `Badge`/`Note`/`KeyValue`; regressions
  get a tone, improvements stay muted.
- At most one primary `Button` per surface; destructive verbs go through
  `Confirm`.

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

Give the agent `catalogToPrompt(catalog)` (or the published `.txt`) in the
tool description, and publish `catalogToJSONSchema(catalog)` at the
catalog id. Registry: `surface` (runtime), `catalog` + `catalog-*` groups,
bundle `surfaces`; example `example-surface`.
