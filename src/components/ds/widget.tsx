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
        "group/widget flex w-full flex-col text-card-foreground",
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

function WidgetFooter({ className, ...props }: React.ComponentProps<"footer">) {
  return (
    <footer
      data-slot="widget-footer"
      className={cn(
        "flex min-h-12 items-center gap-3 px-1 group-data-[variant=framed]/widget:min-h-16 group-data-[variant=framed]/widget:px-3",
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
  WidgetMeta,
  WidgetPanel,
  WidgetTitle,
}
