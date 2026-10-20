import * as React from "react"
import { LayoutGroup, motion } from "motion/react"

import { cn } from "@/lib/utils"
import { enter, springSoft } from "@/lib/motion"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  Catalog,
  HostActions,
  RenderContext,
} from "@/components/surface/catalog"
import {
  autofix,
  collectIssues,
  isPathRef,
  issueText,
  MAX_DEPTH,
  MAX_NODES,
  rawProps,
  resolveDeep,
  unboundFacts,
} from "@/components/surface/validate"
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
// - Repairs what's unambiguous first (name or enum case, numbers sent as
//   text) and reports it as AUTOFIXED.
// - Validates each node with its catalog schema. A node that fails, or whose
//   component isn't in the catalog, is dropped (or, with `showIssues`, shown
//   as a quiet placeholder) and reported through `onIssue` so the agent can
//   fix and resend. The rest of the surface still renders.
// - Inputs write to a local copy of the data model (`onDataChange` to keep
//   your own); actions resolve their context bindings, then call `onAction`.
// - The host owns actions (`actions`): unregistered events don't render,
//   destructive ones only run from a confirmation, and reversibility comes
//   from the host, not the agent.
// - Facts must be bound: an entry's `facts` props written as literals are
//   rejected (the agent must not invent numbers).
// - `layout` sets the limits: "inline" (a chat reply: ≤ 2 actions, no tabs,
//   grids of ≤ 2) or "page". Always: one primary action, one Note per Section.

export function Surface({
  surface: incoming,
  catalog,
  size = "default",
  locale,
  currency,
  showIssues = false,
  actions,
  layout,
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
  /** The events the host offers and what each one is. Omit to allow any. */
  actions?: HostActions
  /** Limits to check: "inline" in a chat reply, "page" otherwise. Default from size. */
  layout?: "inline" | "page"
  onAction?: (action: SurfaceAction) => void
  onIssue?: (issue: SurfaceIssue) => void
  onDataChange?: (path: string, value: unknown, data: unknown) => void
  className?: string
}) {
  // Unambiguous mistakes are repaired first and reported as AUTOFIXED.
  const repaired = React.useMemo(
    () => (incoming ? autofix(incoming, catalog) : undefined),
    [incoming, catalog]
  )
  const surface = repaired?.surface
  const [overrides, setOverrides] = React.useState<Record<string, unknown>>({})
  const data = React.useMemo(() => {
    let d = surface?.data
    for (const [p, v] of Object.entries(overrides)) d = setAt(d, p, v)
    return d
  }, [surface?.data, overrides])

  // Issues come from a pure pass over the tree (same checks as rendering),
  // reported once each after commit.
  const issues = React.useMemo(
    () =>
      surface
        ? [
            ...(repaired?.fixes ?? []),
            ...collectIssues(
              surface,
              catalog,
              data,
              actions,
              layout ?? (size === "sm" ? "inline" : "page")
            ),
          ]
        : [],
    [surface, repaired, catalog, data, actions, layout, size]
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
    scope?: string,
    /** The caller (an animated layout) already applies `span`. */
    noSpan = false
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

    const unbound = unboundFacts(entry, node)
    if (unbound.length)
      return placeholder(
        id,
        `${node.component} · ${unbound.join(", ")} must be bound to data`
      )
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
      children: (ref, opts) => {
        // One child: plain, or (layouts) a motion wrapper that keeps its
        // identity across updates so moves show where things went.
        const one = (
          key: string,
          childId: string,
          childScope: string | undefined
        ) => {
          if (!opts?.animate)
            return (
              <React.Fragment key={key}>
                {renderNode(childId, depth + 1, childScope)}
              </React.Fragment>
            )
          const span = surface.components[childId]?.span
          return (
            <motion.div
              key={key}
              layout="position"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ ...enter, layout: springSoft }}
              className={cn(
                "min-w-0",
                typeof span === "number" && "@xl:col-span-(--span)"
              )}
              style={
                typeof span === "number"
                  ? ({ "--span": span } as React.CSSProperties)
                  : undefined
              }
            >
              {renderNode(childId, depth + 1, childScope, true)}
            </motion.div>
          )
        }
        if (Array.isArray(ref))
          return ref.map((c) => one(String(c), String(c), scope))
        if (
          ref &&
          typeof ref === "object" &&
          "path" in ref &&
          "componentId" in ref
        ) {
          const { path, componentId, key } = ref as {
            path: string
            componentId: string
            key?: string
          }
          const base = joinPath(scope, path)
          const items = getAt(data, base)
          if (!Array.isArray(items)) return []
          return items.map((item, i) => {
            const k =
              key && item && typeof item === "object"
                ? (item as Record<string, unknown>)[key]
                : undefined
            return one(`${componentId}-${k ?? i}`, componentId, `${base}/${i}`)
          })
        }
        return []
      },
      actionInfo: (spec) => {
        const info = spec?.event?.name ? actions?.[spec.event.name] : undefined
        if (!info) return undefined
        const reversible =
          typeof info.reversible === "function"
            ? info.reversible(
                (resolveDeep(spec?.event?.context ?? {}, data, scope) ??
                  {}) as Record<string, unknown>
              )
            : info.reversible
        return { ...info, reversible }
      },
      action: (
        spec: ActionSpec | undefined,
        opts?: { confirmed?: boolean }
      ) => {
        if (!spec?.event?.name) return undefined
        if (actions) {
          const info = actions[spec.event.name]
          if (!info) return undefined
          if (info.destructive && !opts?.confirmed) return undefined
        }
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
    const span =
      typeof node.span === "number" && !noSpan ? node.span : undefined
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
      {/* One layout group: a card leaving one list and arriving in another glides. */}
      <LayoutGroup>{renderNode("root", 0)}</LayoutGroup>
    </div>
  )
}
