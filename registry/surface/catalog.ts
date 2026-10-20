import type * as React from "react"
import { z } from "zod"

import type { ActionSpec } from "@/components/surface/types"
import type { FormatOptions } from "@/components/surface/format"

// A catalog is the vocabulary an agent may compose a surface from. Each
// entry is a Zod schema of its props (as the component receives them, after
// bindings resolve) plus a render function built on uia pieces. The same
// schema validates what the agent sent, describes the entry to the agent
// (`catalogToJSONSchema`, `catalogToPrompt`) and types the implementation.
//
//   const Stat = defineComponent({
//     name: "Stat",
//     description: "One number that answers the question, with its label.",
//     props: z.object({ label: z.string(), value: z.number(), format: format.optional() }),
//     render: (p, ctx) => <Stat …/>,
//   })
//   export const catalog = defineCatalog("https://uia.dev/catalog/v1", [Stat, …])
//
// Agents never send classes, colours or code: only names from the catalog,
// enums (`tone`, `format`, `columns`) and data. Taste lives in the renderer.

/* --------------------------- shared schemas --------------------------- */

/** Children: a list of ids, or a template repeated over a bound array. */
export const children = z
  .union([
    z.array(z.string()),
    z
      .object({
        path: z.string(),
        componentId: z.string(),
        key: z
          .string()
          .optional()
          .describe(
            'Item field with a stable id (e.g. "id"): items keep their identity, so moves animate.'
          ),
      })
      .describe(
        "Repeat componentId once per item of the array at path; inside it, relative paths read the item."
      ),
  ])
  .describe("Ids of child components, or a template over a data array.")

export const action = z
  .object({
    event: z.object({
      name: z
        .string()
        .describe("Named event the agent handles, e.g. raise_limit."),
      context: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
          "Values sent with the event; bindings ({path}) resolve at click time."
        ),
    }),
  })
  .describe(
    "What happens when the person triggers it: a named event back to the agent."
  )

export const tone = z.enum([
  "neutral",
  "success",
  "warning",
  "destructive",
  "attention",
  "info",
])
export const format = z
  .enum([
    "number",
    "integer",
    "currency",
    "percent",
    "compact",
    "duration",
    "date",
    "text",
  ])
  .describe(
    "How the renderer formats the raw value (locale and currency come from the host)."
  )

/** Props every node may carry; handled by the renderer, not the entry. */
const common = z.object({
  id: z.string(),
  component: z.string(),
  span: z
    .number()
    .int()
    .min(1)
    .max(4)
    .optional()
    .describe("Columns to span inside a Grid."),
})

/* ------------------------------ entries ------------------------------- */

export type RenderContext = {
  surfaceId: string
  componentId: string
  /** Render a child by id (a skeleton while it hasn't streamed in). */
  child: (id: string | undefined) => React.ReactNode
  /**
   * Render `children` (ids or a template). `{ animate: true }` (layouts):
   * each child keeps its identity, enters from above, leaves sinking, and the
   * rest glide into place — wrap the result in `<AnimatePresence>`.
   */
  children: (ref: unknown, opts?: { animate?: boolean }) => React.ReactNode[]
  /**
   * A click handler for an action, or undefined when it can't run here: no
   * spec, an event the host didn't register, or a destructive event outside
   * a confirmation (`{ confirmed: true }` is for Confirm-like entries only).
   * Entries render nothing for an undefined handler.
   */
  action: (
    spec: ActionSpec | undefined,
    opts?: { confirmed?: boolean }
  ) => (() => void) | undefined
  /**
   * What the host says about this event (reversible resolved for its
   * context): decided by the host, never the agent.
   */
  actionInfo: (spec: ActionSpec | undefined) => ResolvedHostAction | undefined
  /** For two-way bindings: the data path a prop was bound to, if any. */
  boundPath: (prop: string) => string | undefined
  /** Write a bound value (inputs). */
  set: (path: string, value: unknown) => void
  format: (value: unknown, f?: z.infer<typeof format>) => string
  formatOptions: FormatOptions
  size: "default" | "sm"
}

export type CatalogEntry<P = Record<string, unknown>> = {
  name: string
  description: string
  /**
   * Props that state facts (counts, rates, money, dates): they must be bound
   * to the data model, never written by the agent. A literal is rejected.
   */
  facts?: string[]
  /**
   * pattern: compound pieces the agent fills (prefer these); block: whole
   * product views (an optional layer); the rest are primitives.
   */
  kind: "pattern" | "layout" | "display" | "data" | "input" | "block"
  props: z.ZodType<P>
  render: (props: P, ctx: RenderContext) => React.ReactNode
  /** Example for the prompt: one component node. */
  example?: Record<string, unknown>
}

export function defineComponent<S extends z.ZodObject>(entry: {
  name: string
  description: string
  facts?: (keyof z.infer<S> & string)[]
  kind: CatalogEntry["kind"]
  props: S
  render: (props: z.infer<S>, ctx: RenderContext) => React.ReactNode
  example?: Record<string, unknown>
}): CatalogEntry {
  return entry as unknown as CatalogEntry
}

/* ----------------------------- host actions ---------------------------- */

/**
 * The host's contract for an event the agent may wire to a control. The
 * host decides what an action is — reversible, destructive — and the
 * renderer derives "Irreversible", Undo and the mandatory confirmation from
 * it. Whatever the agent marks is ignored. Events the host didn't register
 * don't render.
 */
export type HostAction = {
  /**
   * Can be undone after it runs (enables Undo, no "Irreversible"). A
   * function decides per call from the event's resolved context — e.g. some
   * decisions are final and others aren't — still on the host's side.
   */
  reversible?: boolean | ((context: Record<string, unknown>) => boolean)
  /** Destroys or changes something for real: only inside a confirmation. */
  destructive?: boolean
  /** One line for the confirmation and the record ("Reverts checkout-api to v41"). */
  describe?: string
}

export type HostActions = Record<string, HostAction>

export type ResolvedHostAction = Omit<HostAction, "reversible"> & {
  reversible?: boolean
}

export function defineActions<T extends HostActions>(actions: T): T {
  return actions
}

export type Catalog = {
  id: string
  components: Record<string, CatalogEntry>
}

export function defineCatalog(id: string, entries: CatalogEntry[]): Catalog {
  return { id, components: Object.fromEntries(entries.map((e) => [e.name, e])) }
}

/** Extend a catalog with your own entries (or replace some of its own). */
export function extendCatalog(
  base: Catalog,
  entries: CatalogEntry[],
  id = base.id
): Catalog {
  return {
    id,
    components: {
      ...base.components,
      ...Object.fromEntries(entries.map((e) => [e.name, e])),
    },
  }
}

/* ---------------------------- for the agent --------------------------- */

const RESERVED = new Set([
  "id",
  "component",
  "children",
  "child",
  "action",
  "span",
])
const pathRef = {
  type: "object",
  properties: { path: { type: "string" } },
  required: ["path"],
  additionalProperties: false,
}

/**
 * JSON Schema of the catalog, published at its id. Every data prop also
 * accepts a binding (`{ "path": "/x" }`).
 */
export function catalogToJSONSchema(catalog: Catalog) {
  const components: Record<string, unknown> = {}
  for (const [name, e] of Object.entries(catalog.components)) {
    const schema = z.toJSONSchema(
      common.extend((e.props as z.ZodObject).shape),
      { io: "input", unrepresentable: "any" }
    ) as {
      properties?: Record<string, unknown>
      [k: string]: unknown
    }
    for (const [k, v] of Object.entries(schema.properties ?? {})) {
      if (RESERVED.has(k)) continue
      schema.properties![k] = e.facts?.includes(k)
        ? {
            ...pathRef,
            description:
              "A fact: bind it to the data model; literals are rejected.",
          }
        : { anyOf: [v, pathRef] }
    }
    schema.properties!.component = { const: name }
    components[name] = { description: e.description, kind: e.kind, ...schema }
  }
  return { $id: catalog.id, version: "v0.9", components }
}

/** A compact description for a system prompt or tool description. */
export function catalogToPrompt(
  catalog: Catalog,
  /** Load only some layers (e.g. a chat reply doesn't need page layouts). */
  { kinds }: { kinds?: CatalogEntry["kind"][] } = {}
) {
  const order = [
    "pattern",
    "block",
    "layout",
    "data",
    "display",
    "input",
  ] as const
  const lines = [
    `Compose UI as A2UI v0.9 messages with catalogId "${catalog.id}".`,
    'Components are a flat list with ids; children reference ids; the root component has id "root".',
    'Props take a literal or a binding {"path":"/pointer"} into the data model (updateDataModel).',
    'Actions are {"event":{"name","context"}} with names the host registered; the host decides what is reversible or destructive (destructive ones only inside Confirmation/DecisionCard). Never send classes, colours or code; format numbers with `format`, not by hand.',
    "Facts (counts, rates, money, dates) come from the data model by binding, never written in props or prose. Prose says why, not how much.",
    "Prefer a pattern (or a product block) when it matches the intent; compose from layout + data primitives only for what none of them covers.",
    "",
  ]
  for (const kind of order.filter((k) => !kinds || kinds.includes(k))) {
    const entries = Object.values(catalog.components).filter(
      (e) => e.kind === kind
    )
    if (!entries.length) continue
    lines.push(`${kind.toUpperCase()}`)
    for (const e of entries) {
      const keys = Object.keys((e.props as z.ZodObject).shape).join(", ")
      lines.push(`- ${e.name}(${keys}): ${e.description}`)
    }
  }
  return lines.join("\n")
}
