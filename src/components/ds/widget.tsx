import * as React from "react"
import { cn } from "@/lib/utils"

// Widget: the floating "card-in-card" shell every surface is built from.
// Anatomy: Widget > WidgetHeader > WidgetPanel(s) > WidgetFooter.
// The shell is `surface`, panels are `card`, separated by a 4px gutter.

function Widget({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="widget"
      className={cn(
        "flex w-full flex-col gap-1 rounded-3xl bg-surface p-1 text-card-foreground shadow-widget",
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
      className={cn("flex min-h-16 items-center gap-2 pr-3 pl-5", className)}
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
      className={cn("flex min-h-16 items-center gap-3 pr-3 pl-3", className)}
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
  Widget,
  WidgetActions,
  WidgetDescription,
  WidgetFooter,
  WidgetHeader,
  WidgetMeta,
  WidgetPanel,
  WidgetTitle,
}
