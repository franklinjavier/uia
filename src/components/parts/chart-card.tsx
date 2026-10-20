import * as React from "react"

import { cn } from "@/lib/utils"

// ChartCard: a chart the agent made, inside its reply. Title, a row of the
// few numbers that answer the question (total, change, median, peak), then
// the chart. The surface matches the other in-message cards: hairline
// border, card fill, no shadow.
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
    <figure data-slot="chart-card" className={cn("not-typeset flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3.5 text-sm", className)}>
      <figcaption className="font-medium">{title}</figcaption>
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
    </figure>
  )
}

export { ChartCard }
