import * as React from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { springSoft } from "@/lib/motion"

// BarSeries: a short series as bars (weeks, days, releases). One hue,
// `chart-1`: the bars sit at 30%, the one that matters (the latest by
// default) at full strength. Hover or focus a bar to read it; the label row
// keeps the first, the last and the hovered one, never all of them.
//
//   <BarSeries data={weeks} format={(v) => v.toLocaleString("en-US")} />

export type BarDatum = { label: string; value: number }

function BarSeries({
  data,
  highlight = data.length - 1,
  format = (v: number) => String(v),
  height = 112,
  className,
}: {
  data: BarDatum[]
  /** Index drawn at full strength. Default: the last one. */
  highlight?: number
  format?: (value: number) => string
  height?: number
  className?: string
}) {
  const [active, setActive] = React.useState<number | null>(null)
  const max = Math.max(...data.map((d) => d.value), 1)
  const shown = active ?? highlight

  return (
    <div data-slot="bar-series" className={cn("flex flex-col gap-1.5", className)}>
      <div
        className="relative mt-4 flex items-end gap-[3px]"
        style={{ height }}
        onPointerLeave={() => setActive(null)}
      >
        {data.map((d, i) => (
          <button
            key={d.label}
            type="button"
            aria-label={`${d.label}: ${format(d.value)}`}
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="group/bar relative flex h-full flex-1 items-end outline-none"
          >
            <motion.span
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ ...springSoft, delay: i * 0.025 }}
              style={{ height: `${(d.value / max) * 100}%`, originY: 1 }}
              className={cn(
                "w-full rounded-t-[3px] transition-colors duration-200",
                i === shown ? "bg-chart-1" : "bg-chart-1/30 group-hover/bar:bg-chart-1/50",
                "group-focus-visible/bar:ring-3 group-focus-visible/bar:ring-ring/30"
              )}
            />
            {i === shown && (
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 eyebrow whitespace-nowrap text-foreground tabular-nums">
                {format(d.value)}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex justify-between eyebrow text-faint-foreground">
        <span>{data[0]?.label}</span>
        {active !== null && active !== 0 && active !== data.length - 1 && (
          <span className="text-muted-foreground">{data[active].label}</span>
        )}
        <span>{data.at(-1)?.label}</span>
      </div>
    </div>
  )
}

export { BarSeries }
