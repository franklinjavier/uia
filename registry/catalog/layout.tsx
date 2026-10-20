import * as React from "react"
import { AnimatePresence } from "motion/react"
import { z } from "zod"

import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Segmented, SegmentedItem } from "@/components/ds/segmented"
import {
  Widget,
  WidgetDescription,
  WidgetHeader,
  WidgetPanel,
  WidgetTitle,
} from "@/components/ds/widget"
import { children, defineComponent } from "@/components/surface/catalog"

// Layout: how pieces sit together. Columns follow the surface's own width
// (container queries), so a Grid of 3 is one column inside a chat reply and
// three on a wide page — the agent says the intent, the renderer adapts.
//
// Column and Grid also move their children: an item leaves sinking, the rest
// glide into the gap, a new one arrives from above. The agent never asks for
// it; every screen gets it.

const GAP = { sm: "gap-3", md: "gap-5", lg: "gap-8" } as const
const gap = z.enum(["sm", "md", "lg"]).optional()

export const Column = defineComponent({
  name: "Column",
  kind: "layout",
  description: "Stack children vertically. The usual root.",
  props: z.object({ children, gap }),
  render: (p, ctx) => (
    <div className={cn("relative flex min-w-0 flex-col", GAP[p.gap ?? "md"])}>
      <AnimatePresence initial={false} mode="popLayout">
        {ctx.children(p.children, { animate: true })}
      </AnimatePresence>
    </div>
  ),
})

export const Row = defineComponent({
  name: "Row",
  kind: "layout",
  description: "Lay children side by side; wraps on narrow widths.",
  props: z.object({
    children,
    gap,
    align: z.enum(["start", "center", "end", "between"]).optional(),
  }),
  render: (p, ctx) => (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center",
        GAP[p.gap ?? "sm"],
        p.align === "end" && "justify-end",
        p.align === "center" && "justify-center",
        p.align === "between" && "justify-between"
      )}
    >
      {ctx.children(p.children)}
    </div>
  ),
})

const COLS: Record<number, string> = {
  1: "",
  2: "@xl:grid-cols-2",
  3: "@xl:grid-cols-2 @4xl:grid-cols-3",
  4: "@xl:grid-cols-2 @5xl:grid-cols-4",
}

export const Grid = defineComponent({
  name: "Grid",
  kind: "layout",
  description:
    "A dashboard grid. Children may set `span`. Collapses to one column when narrow.",
  props: z.object({
    children,
    columns: z.number().int().min(1).max(4).default(2),
    gap,
  }),
  render: (p, ctx) => (
    <div
      className={cn(
        "relative grid min-w-0 grid-cols-1",
        COLS[p.columns],
        GAP[p.gap ?? "lg"]
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {ctx.children(p.children, { animate: true })}
      </AnimatePresence>
    </div>
  ),
})

export const Section = defineComponent({
  name: "Section",
  kind: "layout",
  description:
    "A titled block: title outside, content in a white panel. The unit of a dashboard.",
  props: z.object({
    title: z.string(),
    description: z.string().optional(),
    children,
    /** Header-right content, e.g. a Badge or Button id. */
    aside: z.string().optional(),
  }),
  render: (p, ctx) => (
    <Widget size={ctx.size}>
      <WidgetHeader>
        <div className="flex min-w-0 flex-col">
          <WidgetTitle>{p.title}</WidgetTitle>
          {p.description && (
            <WidgetDescription>{p.description}</WidgetDescription>
          )}
        </div>
        {p.aside && <div className="ml-auto">{ctx.child(p.aside)}</div>}
      </WidgetHeader>
      <WidgetPanel className="flex flex-col gap-5">
        {ctx.children(p.children)}
      </WidgetPanel>
    </Widget>
  ),
})

export const Card = defineComponent({
  name: "Card",
  kind: "layout",
  description:
    "A white panel without a title, for a second block inside a Section or on its own.",
  props: z.object({
    children: children.optional(),
    child: z.string().optional(),
  }),
  render: (p, ctx) => (
    <Widget size={ctx.size}>
      <WidgetPanel className="flex flex-col gap-5">
        {p.child ? ctx.child(p.child) : ctx.children(p.children)}
      </WidgetPanel>
    </Widget>
  ),
})

function TabsView({
  tabs,
  render,
}: {
  tabs: { label: string; child: string }[]
  render: (id: string) => React.ReactNode
}) {
  const [active, setActive] = React.useState(tabs[0]?.label ?? "")
  const current = tabs.find((t) => t.label === active) ?? tabs[0]
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Segmented
        variant="sans"
        value={current?.label ?? ""}
        onValueChange={setActive}
        className="self-start"
      >
        {tabs.map((t) => (
          <SegmentedItem key={t.label} value={t.label}>
            {t.label}
          </SegmentedItem>
        ))}
      </Segmented>
      {current && render(current.child)}
    </div>
  )
}

export const Tabs = defineComponent({
  name: "Tabs",
  kind: "layout",
  description: "Switch between a few views of the same thing (2–4).",
  props: z.object({
    tabs: z
      .array(z.object({ label: z.string(), child: z.string() }))
      .min(2)
      .max(6),
  }),
  render: (p, ctx) => <TabsView tabs={p.tabs} render={(id) => ctx.child(id)} />,
})

export const Divider = defineComponent({
  name: "Divider",
  kind: "layout",
  description: "A hairline between groups inside a panel.",
  props: z.object({}),
  render: () => <Separator />,
})

export const layout = [Column, Row, Grid, Section, Card, Tabs, Divider]
