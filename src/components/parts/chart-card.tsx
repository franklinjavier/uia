import * as React from "react"

import { cn } from "@/lib/utils"
import { Widget, WidgetHeader, WidgetPanel, WidgetTitle } from "@/components/ds/widget"

// ChartCard: a chart the agent made, inside its reply. It's a Widget at
// size="sm" — the same shell the dashboard uses — with a stat row (the 2–4
// numbers that answer the question) above the chart. If you have a whole
// widget for this data, render that at size="sm" instead.
//
//   <ChartCard title="Weekly signups" stats={[{ label: "Total", value: "13,009" },
//     { label: "vs first week", value: "+53.2%", tone: "success" }]}>
//     <BarSeries data={weeks} />
//   </ChartCard>

export type ChartStat = { label: string; value: React.ReactNode; tone?: "success" | "destructive" }

function ChartCard({
  title,
  stats = [],
  className,
  children,
}: {
  title: React.ReactNode
  stats?: ChartStat[]
  className?: string
  children: React.ReactNode
}) {
  return (
    <Widget size="sm" data-slot="chart-card" className={cn("not-typeset", className)}>
      <WidgetHeader>
        <WidgetTitle>{title}</WidgetTitle>
      </WidgetHeader>
      <WidgetPanel className="flex flex-col gap-3">
        {stats.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col gap-0.5">
                <dt className="eyebrow text-muted-foreground">{s.label}</dt>
                <dd
                  className={cn(
                    "text-base tabular-nums",
                    s.tone === "success" && "text-success",
                    s.tone === "destructive" && "text-destructive"
                  )}
                >
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {children}
      </WidgetPanel>
    </Widget>
  )
}

export { ChartCard }
