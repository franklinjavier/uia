import * as React from "react"
import { cn } from "@/lib/utils"

// Widget: a tool surface built from parts.
// Anatomy: Widget > WidgetHeader > WidgetPanel(s) > WidgetFooter.
//
// variant="plain" (default): no shell. Panels sit on the page; header and
// footer align with the panels' edge. Use inside a chat or anywhere the
// host already frames the content.
// variant="framed": the floating card-in-card shell (`surface` + widget
// shadow, 4px gutter). Use when the widget must read as an object of its
// own: dashboards with neighbours, floating panels, demos.

type WidgetVariant = "plain" | "framed"

function Widget({
  variant = "plain",
  className,
  ...props
}: React.ComponentProps<"section"> & { variant?: WidgetVariant }) {
  return (
    <section
      data-slot="widget"
      data-variant={variant}
      className={cn(
        "group/widget flex w-full min-w-0 flex-col text-card-foreground",
        variant === "framed"
          ? "gap-1 rounded-3xl bg-surface p-1 shadow-widget"
          : "gap-2",
        className
      )}
      {...props}
    />
  )
}

function WidgetHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="widget-header"
      className={cn(
        "flex min-h-12 items-center gap-2 px-1 group-data-[variant=framed]/widget:min-h-16 group-data-[variant=framed]/widget:pr-3 group-data-[variant=framed]/widget:pl-5",
        className
      )}
      {...props}
    />
  )
}

function WidgetTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="widget-title"
      className={cn("text-base leading-6 tracking-[-0.011em]", className)}
      {...props}
    />
  )
}

function WidgetDescription({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="widget-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function WidgetActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="widget-actions"
      className={cn("ml-auto flex items-center gap-1", className)}
      {...props}
    />
  )
}

function WidgetPanel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="widget-panel"
      className={cn(
        "rounded-2xl bg-card p-5 ring-1 ring-border/70 dark:ring-border",
        className
      )}
      {...props}
    />
  )
}

/** A small heading inside a panel ("Routes", "Agents"). */
function WidgetSectionTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="widget-section-title"
      className={cn("text-[15px] leading-6 tracking-[-0.01em]", className)}
      {...props}
    />
  )
}

// WidgetList: rows inside a panel, separated by hairlines. Set the grid
// columns once on the header and each row (className="grid-cols-[…]").
//
//   <WidgetList>
//     <WidgetListHeader className="grid-cols-[1fr_80px]">…</WidgetListHeader>
//     <WidgetListRow className="grid-cols-[1fr_80px]" selected dimmed onClick>…</WidgetListRow>
//   </WidgetList>
//
// One interaction model for every list linked to a visual: hovering a row
// previews it (the others dim, the visual follows), clicking selects it.
function WidgetList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="widget-list"
      role="list"
      className={cn("-mx-2 flex flex-col", className)}
      {...props}
    />
  )
}

function WidgetListHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="widget-list-header"
      className={cn("grid items-center gap-x-3 px-2 pb-2", className)}
      {...props}
    />
  )
}

/** A row. Renders a button when it has `onClick`, a plain row otherwise. */
function WidgetListRow({
  selected = false,
  dimmed = false,
  className,
  ...props
}: React.ComponentProps<"button"> & { selected?: boolean; dimmed?: boolean }) {
  const interactive = Boolean(props.onClick)
  const Comp = (interactive ? "button" : "div") as "button"
  return (
    <Comp
      data-slot="widget-list-row"
      role={interactive ? undefined : "listitem"}
      type={interactive ? "button" : undefined}
      aria-pressed={interactive ? selected : undefined}
      data-selected={selected || undefined}
      data-dimmed={dimmed || undefined}
      className={cn(
        "grid items-center gap-x-3 rounded-lg border-t border-border/70 px-2 py-2.5 text-left text-sm outline-none transition-[opacity,background-color] duration-200 first:border-t-0 hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/30 data-dimmed:opacity-45 data-selected:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function WidgetFooter({ className, ...props }: React.ComponentProps<"footer">) {
  return (
    <footer
      data-slot="widget-footer"
      className={cn(
        "flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 px-1 group-data-[variant=framed]/widget:min-h-16 group-data-[variant=framed]/widget:px-3",
        className
      )}
      {...props}
    />
  )
}

function WidgetMeta({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="widget-meta"
      className={cn("eyebrow truncate text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  type WidgetVariant,
  Widget,
  WidgetActions,
  WidgetDescription,
  WidgetFooter,
  WidgetHeader,
  WidgetList,
  WidgetListHeader,
  WidgetListRow,
  WidgetMeta,
  WidgetPanel,
  WidgetSectionTitle,
  WidgetTitle,
}
