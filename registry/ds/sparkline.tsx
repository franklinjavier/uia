import * as React from "react"

import { cn } from "@/lib/utils"

// Sparkline: a recent series as a line over a soft area, with the mean as a
// dashed hairline and the latest point marked. No axes; pair it with a big
// number that says the current value and an eyebrow that says the window
// ("Last 64 s").

function Sparkline({
  values,
  color = "var(--chart-1)",
  className,
  ...props
}: Omit<React.ComponentProps<"svg">, "values"> & { values: number[]; color?: string }) {
  const id = React.useId()
  const w = 160
  const h = 48
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * (w - 4)
  const y = (v: number) => 4 + (1 - (v - lo) / (hi - lo || 1)) * (h - 10)
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const mean = y(values.reduce((a, b) => a + b, 0) / Math.max(1, values.length))

  return (
    <svg
      data-slot="sparkline"
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-12 w-40 overflow-visible", className)}
      aria-hidden
      {...props}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.18" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={0} x2={w - 4} y1={mean} y2={mean} stroke="var(--border)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      <path d={`${line} L${x(values.length - 1)},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1) ?? 0)} r={2.5} fill={color} />
    </svg>
  )
}

export { Sparkline }
