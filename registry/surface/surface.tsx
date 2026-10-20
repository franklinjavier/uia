import * as React from "react"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import type { Catalog, RenderContext } from "@/components/surface/catalog"
import {
  formatValue,
  type FormatOptions,
  type ValueFormat,
} from "@/components/surface/format"
import { getAt, joinPath, setAt } from "@/components/surface/store"
import type {
  ActionSpec,
  ComponentNode,
  SurfaceAction,
  SurfaceIssue,
  SurfaceState,
} from "@/components/surface/types"

// <Surface>: draws an A2UI surface with a catalog. The same renderer works
// for a full page (a dashboard assembled for this moment) and inside a chat
// reply (`size="sm"`).
//
//   <Surface surface={surface} catalog={uiaCatalog} onAction={send} />
//
// - Streams well: a child that hasn't arrived yet is a skeleton; nothing
//   renders until "root" exists.
// - Validates each node with its catalog schema. A node that fails, or whose
//   component isn't in the catalog, is dropped (or, with `showIssues`, shown
//   as a quiet placeholder) and reported through `onIssue` so the agent can
//   fix and resend. The rest of the surface still renders.
// - Inputs write to a local copy of the data model (`onDataChange` to keep
//   your own); actions resolve their context bindings, then call `onAction`.

const MAX_NODES = 400
const MAX_DEPTH = 16

function isPathRef(v: unknown): v is { path: string } {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).length === 1 &&
    typeof (v as { path?: unknown }).path === "string"
  )
}

function resolveDeep(
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

function rawProps(
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

function issueText(error: {
  issues: { path: PropertyKey[]; message: string }[]
}) {
  return error.issues
    .map((i) => `${i.path.map(String).join(".") || "(props)"}: ${i.message}`)
    .join("; ")
}

/** Walk what's reachable from root and list what can't render, for the agent. */
function collectIssues(
  surface: SurfaceState,
  catalog: Catalog,
  data: unknown
): SurfaceIssue[] {
  const out: SurfaceIssue[] = []
  const seen = new Set<string>()
  let count = 0
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
    const parsed = entry.props.safeParse(rawProps(node, data, scope))
    if (!parsed.success) add(id, "VALIDATION_FAILED", issueText(parsed.error))
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
  return out
}

export function Surface({
  surface,
  catalog,
  size = "default",
  locale,
  currency,
  showIssues = false,
  onAction,
  onIssue,
  onDataChange,
  className,
}: {
  surface: SurfaceState | undefined
  catalog: Catalog
  size?: "default" | "sm"
  locale?: string
  currency?: string
  /** Show a placeholder where a node failed (dev, playgrounds). */
  showIssues?: boolean
  onAction?: (action: SurfaceAction) => void
  onIssue?: (issue: SurfaceIssue) => void
  onDataChange?: (path: string, value: unknown, data: unknown) => void
  className?: string
}) {
  const [overrides, setOverrides] = React.useState<Record<string, unknown>>({})
  const data = React.useMemo(() => {
    let d = surface?.data
    for (const [p, v] of Object.entries(overrides)) d = setAt(d, p, v)
    return d
  }, [surface?.data, overrides])

  // Issues come from a pure pass over the tree (same checks as rendering),
  // reported once each after commit.
  const issues = React.useMemo(
    () => (surface ? collectIssues(surface, catalog, data) : []),
    [surface, catalog, data]
  )
  const reported = React.useRef(new Set<string>())
  React.useEffect(() => {
    for (const issue of issues) {
      const key = `${issue.componentId}:${issue.code}:${issue.message}`
      if (reported.current.has(key)) continue
      reported.current.add(key)
      onIssue?.(issue)
    }
  }, [issues, onIssue])

  if (!surface || !surface.components.root) {
    return (
      <Skeleton
        data-slot="surface-pending"
        className={cn("h-24 w-full rounded-2xl", className)}
      />
    )
  }

  const formatOptions: FormatOptions = { locale, currency }
  let count = 0

  const placeholder = (componentId: string, text: string) =>
    showIssues ? (
      <div
        key={componentId}
        data-slot="surface-issue"
        className="rounded-xl border border-dashed border-border px-3 py-2 eyebrow text-faint-foreground"
      >
        {text}
      </div>
    ) : null

  const renderNode = (
    id: string | undefined,
    depth: number,
    scope?: string
  ): React.ReactNode => {
    if (!id) return null
    const node: ComponentNode | undefined = surface.components[id]
    // Not streamed in yet.
    if (!node)
      return (
        <Skeleton
          key={`${id}-${scope ?? ""}`}
          className="h-12 w-full rounded-xl"
        />
      )
    if (++count > MAX_NODES || depth > MAX_DEPTH) return null
    const entry = catalog.components[node.component]
    if (!entry) {
      const fallback =
        typeof node.fallback === "string" ? node.fallback : undefined
      return fallback
        ? renderNode(fallback, depth + 1, scope)
        : placeholder(id, `Unsupported · ${node.component}`)
    }

    const parsed = entry.props.safeParse(rawProps(node, data, scope))
    if (!parsed.success)
      return placeholder(id, `${node.component} · ${issueText(parsed.error)}`)

    const ctx: RenderContext = {
      surfaceId: surface.id,
      componentId: id,
      size,
      formatOptions,
      format: (v, f) => formatValue(v, f as ValueFormat, formatOptions),
      child: (childId) => renderNode(childId, depth + 1, scope),
      children: (ref) => {
        if (Array.isArray(ref))
          return ref.map((c) => (
            <React.Fragment key={String(c)}>
              {renderNode(String(c), depth + 1, scope)}
            </React.Fragment>
          ))
        if (
          ref &&
          typeof ref === "object" &&
          "path" in ref &&
          "componentId" in ref
        ) {
          const { path, componentId } = ref as {
            path: string
            componentId: string
          }
          const base = joinPath(scope, path)
          const items = getAt(data, base)
          if (!Array.isArray(items)) return []
          return items.map((_, i) => (
            <React.Fragment key={`${componentId}-${i}`}>
              {renderNode(componentId, depth + 1, `${base}/${i}`)}
            </React.Fragment>
          ))
        }
        return []
      },
      action: (spec: ActionSpec | undefined) => {
        if (!spec?.event?.name) return undefined
        return () =>
          onAction?.({
            name: spec.event.name,
            surfaceId: surface.id,
            sourceComponentId: id,
            context: (resolveDeep(spec.event.context ?? {}, data, scope) ??
              {}) as Record<string, unknown>,
            timestamp: new Date().toISOString(),
          })
      },
      boundPath: (prop) => {
        const v = node[prop]
        return isPathRef(v) ? joinPath(scope, v.path) : undefined
      },
      set: (path, value) => {
        setOverrides((o) => ({ ...o, [path]: value }))
        onDataChange?.(path, value, setAt(data, path, value))
      },
    }

    const rendered = entry.render(parsed.data as Record<string, unknown>, ctx)
    const span = typeof node.span === "number" ? node.span : undefined
    return span ? (
      <div
        key={id}
        className="min-w-0 @xl:col-span-(--span)"
        style={{ "--span": span } as React.CSSProperties}
      >
        {rendered}
      </div>
    ) : (
      <React.Fragment key={id}>{rendered}</React.Fragment>
    )
  }

  return (
    <div
      data-slot="surface"
      data-surface={surface.id}
      className={cn("@container flex min-w-0 flex-col", className)}
    >
      {renderNode("root", 0)}
    </div>
  )
}
