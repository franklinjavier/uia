import * as React from "react"
import { cn } from "@/lib/utils"

// Progress as a row of hairline ticks. Colour comes from `currentColor`,
// so set a text-* class (text-brand, text-chart-1…) on the meter.
function TickMeter({
  value,
  ticks = 48,
  className,
  ...props
}: React.ComponentProps<"div"> & { value: number; ticks?: number }) {
  const filled = Math.round(Math.min(1, Math.max(0, value)) * ticks)

  return (
    <div
      data-slot="tick-meter"
      role="meter"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("flex h-3 items-stretch justify-between text-brand", className)}
      {...props}
    >
      {Array.from({ length: ticks }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "w-px rounded-full transition-colors duration-300",
            i < filled ? "bg-current" : "bg-border"
          )}
        />
      ))}
    </div>
  )
}

export { TickMeter }
