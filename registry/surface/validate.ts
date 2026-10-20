import type {
  Catalog,
  CatalogEntry,
  HostActions,
} from "@/components/surface/catalog"
import { getAt, joinPath } from "@/components/surface/store"
import type {
  ComponentNode,
  SurfaceIssue,
  SurfaceState,
} from "@/components/surface/types"

// Checks a surface without rendering it: the same rules <Surface> applies,
// as a pure function. Run it where the agent runs too (validate twice), and
// in evals.
//
//   const issues = validateSurface(surface, catalog, { actions, layout: "inline" })

export const MAX_NODES = 400
export const MAX_DEPTH = 16

export function isPathRef(v: unknown): v is { path: string } {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).length === 1 &&
    typeof (v as { path?: unknown }).path === "string"
  )
}

export function resolveDeep(
  value: unknown,
  data: unknown,
  scope: string | undefined
): unknown {
  if (isPathRef(value)) return getAt(data, joinPath(scope, value.path))
  if (Array.isArray(value)) return value.map((v) => resolveDeep(v, data, scope))
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveDeep(v, data, scope)])
    )
  }
  return value
}

const PASS_THROUGH = new Set(["children", "child", "action"])
const COMMON = new Set(["id", "component", "span", "fallback"])

export function rawProps(
  node: ComponentNode,
  data: unknown,
  scope: string | undefined
) {
  const raw: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(node))
    if (!COMMON.has(k))
      raw[k] = PASS_THROUGH.has(k) ? v : resolveDeep(v, data, scope)
  return raw
}

export function unboundFacts(entry: CatalogEntry, node: ComponentNode) {
  return (entry.facts ?? []).filter(
    (k) => node[k] !== undefined && !isPathRef(node[k])
  )
}

/** Every action spec on a node, wherever the entry keeps it. */
function actionSpecs(value: unknown, out: { name: string }[] = []) {
  if (Array.isArray(value)) value.forEach((v) => actionSpecs(v, out))
  else if (value && typeof value === "object") {
    const ev = (value as { event?: { name?: unknown } }).event
    if (ev && typeof ev.name === "string") out.push({ name: ev.name })
    else Object.values(value).forEach((v) => actionSpecs(v, out))
  }
  return out
}

/** Entries that are confirmations: destructive events may live here. */
const CONFIRMING = new Set([
  "Confirm",
  "Confirmation",
  "DecisionCard",
  "StatusCard",
  "Diff",
  "BeforeAfter",
])

/** A loose primary button (cards carry their own answer, not counted). */
function isPrimary(node: ComponentNode) {
  return (
    node.component === "Button" && (!node.variant || node.variant === "primary")
  )
}

export function issueText(error: {
  issues: { path: PropertyKey[]; message: string }[]
}) {
  return error.issues
    .map((i) => `${i.path.map(String).join(".") || "(props)"}: ${i.message}`)
    .join("; ")
}

/** Walk what's reachable from root and list what can't render, for the agent. */
export function collectIssues(
  surface: SurfaceState,
  catalog: Catalog,
  data: unknown,
  actions: HostActions | undefined,
  layout: "inline" | "page"
): SurfaceIssue[] {
  const out: SurfaceIssue[] = []
  const seen = new Set<string>()
  let count = 0
  let totalActions = 0
  let primaries = 0
  const add = (
    componentId: string,
    code: SurfaceIssue["code"],
    message: string
  ) => out.push({ surfaceId: surface.id, componentId, code, message })
  const visit = (id: string | undefined, depth: number, scope?: string) => {
    if (!id) return
    const node = surface.components[id]
    if (!node) return // still streaming
    const key = `${id}@${scope ?? ""}`
    if (seen.has(key)) return
    seen.add(key)
    if (++count > MAX_NODES || depth > MAX_DEPTH)
      return add(
        id,
        "LIMIT_EXCEEDED",
        `Max ${MAX_NODES} nodes and depth ${MAX_DEPTH}.`
      )
    const entry = catalog.components[node.component]
    if (!entry) {
      add(
        id,
        "UNKNOWN_COMPONENT",
        `"${node.component}" is not in catalog ${catalog.id}.`
      )
      return visit(
        typeof node.fallback === "string" ? node.fallback : undefined,
        depth + 1,
        scope
      )
    }
    const unbound = unboundFacts(entry, node)
    if (unbound.length)
      add(
        id,
        "UNBOUND_FACT",
        `${unbound.join(", ")} must be bound to the data model ({"path": …}), not written.`
      )
    const parsed = entry.props.safeParse(rawProps(node, data, scope))
    if (!parsed.success) add(id, "VALIDATION_FAILED", issueText(parsed.error))
    if (node.component === "Button") totalActions++
    for (const a of actionSpecs({ ...node, children: undefined })) {
      const info = actions?.[a.name]
      if (actions && !info)
        add(
          id,
          "UNKNOWN_ACTION",
          `"${a.name}" is not an action the host offers.`
        )
      else if (info?.destructive && !CONFIRMING.has(node.component))
        add(
          id,
          "UNCONFIRMED_DESTRUCTIVE",
          `"${a.name}" is destructive: put it in a Confirmation.`
        )
    }
    if (isPrimary(node)) primaries++
    if (node.component === "Section" && Array.isArray(node.children)) {
      const notes = node.children.filter(
        (c) => surface.components[String(c)]?.component === "Note"
      ).length
      if (notes > 1)
        add(id, "COMPOSITION", `One Note per Section (found ${notes}).`)
    }
    if (layout === "inline" && node.component === "Tabs")
      add(id, "COMPOSITION", "No Tabs inside a chat reply.")
    if (
      layout === "inline" &&
      node.component === "Grid" &&
      Number(node.columns ?? 2) > 2
    )
      add(id, "COMPOSITION", "Grids of at most 2 columns inside a chat reply.")
    const kids = node.children
    if (Array.isArray(kids))
      kids.forEach((c) => visit(String(c), depth + 1, scope))
    else if (
      kids &&
      typeof kids === "object" &&
      "componentId" in kids &&
      "path" in kids
    ) {
      const base = joinPath(scope, String((kids as { path: string }).path))
      const items = getAt(data, base)
      if (Array.isArray(items) && items.length)
        visit(
          String((kids as { componentId: string }).componentId),
          depth + 1,
          `${base}/0`
        )
    }
    for (const k of ["child", "aside"])
      if (typeof node[k] === "string")
        visit(node[k] as string, depth + 1, scope)
    if (Array.isArray(node.tabs))
      for (const t of node.tabs as { child?: string }[])
        visit(t?.child, depth + 1, scope)
  }
  visit("root", 0)
  if (primaries > 1)
    add(
      "root",
      "COMPOSITION",
      `One loose primary button per surface (found ${primaries}); decisions belong in DecisionCard/Confirmation.`
    )
  if (layout === "inline" && totalActions > 2)
    add(
      "root",
      "COMPOSITION",
      `At most 2 loose buttons in a chat reply (found ${totalActions}).`
    )
  return out
}

export function validateSurface(
  surface: SurfaceState,
  catalog: Catalog,
  {
    actions,
    layout = "page",
  }: { actions?: HostActions; layout?: "inline" | "page" } = {}
) {
  const { surface: fixed, fixes } = autofix(surface, catalog)
  return [
    ...fixes,
    ...collectIssues(fixed, catalog, fixed.data, actions, layout),
  ]
}

/* -------------------------------- autofix ------------------------------- */

type ZodDef = {
  type: string
  innerType?: unknown
  entries?: Record<string, string>
}
const defOf = (schema: unknown) => (schema as { def?: ZodDef })?.def

function unwrap(schema: unknown): ZodDef | undefined {
  let d = defOf(schema)
  while (
    d &&
    (d.type === "optional" || d.type === "default" || d.type === "nullable")
  )
    d = defOf(d.innerType)
  return d
}

/**
 * Repair what is unambiguous before validating, and say so: a component name
 * or an enum value in the wrong case, a number sent as a string. Anything
 * ambiguous is left for validation to report. Returns the repaired surface
 * and one AUTOFIXED issue per repair (send them back so the agent learns).
 */
export function autofix(
  surface: SurfaceState,
  catalog: Catalog
): { surface: SurfaceState; fixes: SurfaceIssue[] } {
  const fixes: SurfaceIssue[] = []
  const names = new Map(
    Object.keys(catalog.components).map((n) => [n.toLowerCase(), n])
  )
  const components: Record<string, ComponentNode> = {}
  for (const [id, original] of Object.entries(surface.components)) {
    let node = original
    if (!catalog.components[node.component]) {
      const name = names.get(node.component.toLowerCase())
      if (name) {
        fixes.push({
          surfaceId: surface.id,
          componentId: id,
          code: "AUTOFIXED",
          message: `component "${node.component}" → "${name}"`,
        })
        node = { ...node, component: name }
      }
    }
    const entry = catalog.components[node.component]
    const shape = (
      entry?.props as { shape?: Record<string, unknown> } | undefined
    )?.shape
    if (shape) {
      for (const [k, schema] of Object.entries(shape)) {
        const v = node[k]
        const d = unwrap(schema)
        if (!d || v === undefined || isPathRef(v)) continue
        if (d.type === "enum" && typeof v === "string") {
          const options = Object.values(d.entries ?? {})
          const hit = options.find((o) => o.toLowerCase() === v.toLowerCase())
          if (hit && hit !== v) {
            fixes.push({
              surfaceId: surface.id,
              componentId: id,
              code: "AUTOFIXED",
              message: `${k}: "${v}" → "${hit}"`,
            })
            node = { ...node, [k]: hit }
          }
        }
        if (
          d.type === "number" &&
          typeof v === "string" &&
          v.trim() !== "" &&
          Number.isFinite(Number(v))
        ) {
          fixes.push({
            surfaceId: surface.id,
            componentId: id,
            code: "AUTOFIXED",
            message: `${k}: "${v}" → ${Number(v)}`,
          })
          node = { ...node, [k]: Number(v) }
        }
      }
    }
    components[id] = node
  }
  return fixes.length
    ? { surface: { ...surface, components }, fixes }
    : { surface, fixes }
}
