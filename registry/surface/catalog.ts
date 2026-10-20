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
      .object({ path: z.string(), componentId: z.string() })
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
  /** Render `children` (ids or a template). */
  children: (ref: unknown) => React.ReactNode[]
  /** A click handler for an action spec, or undefined when there is none. */
  action: (spec: ActionSpec | undefined) => (() => void) | undefined
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
  /** Higher-level entries the agent should prefer when the intent matches. */
  kind: "layout" | "display" | "data" | "input" | "block"
  props: z.ZodType<P>
  render: (props: P, ctx: RenderContext) => React.ReactNode
  /** Example for the prompt: one component node. */
  example?: Record<string, unknown>
}

export function defineComponent<S extends z.ZodObject>(entry: {
  name: string
  description: string
  kind: CatalogEntry["kind"]
  props: S
  render: (props: z.infer<S>, ctx: RenderContext) => React.ReactNode
  example?: Record<string, unknown>
}): CatalogEntry {
  return entry as unknown as CatalogEntry
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
      if (!RESERVED.has(k)) schema.properties![k] = { anyOf: [v, pathRef] }
    }
    schema.properties!.component = { const: name }
    components[name] = { description: e.description, kind: e.kind, ...schema }
  }
  return { $id: catalog.id, version: "v0.9", components }
}

/** A compact description for a system prompt or tool description. */
export function catalogToPrompt(catalog: Catalog) {
  const order = ["block", "layout", "data", "display", "input"] as const
  const lines = [
    `Compose UI as A2UI v0.9 messages with catalogId "${catalog.id}".`,
    'Components are a flat list with ids; children reference ids; the root component has id "root".',
    'Props take a literal or a binding {"path":"/pointer"} into the data model (updateDataModel).',
    'Actions are {"event":{"name","context"}}. Never send classes, colours or code; format numbers with `format`, not by hand.',
    "Prefer a block when it matches the intent; otherwise compose from layout + data components.",
    "",
  ]
  for (const kind of order) {
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
