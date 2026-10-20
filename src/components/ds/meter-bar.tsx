import * as React from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { springSoft } from "@/lib/motion"

// MeterBar: a value against its limit, drawn so the limit is visible.
// One segment for a plain meter, several for a breakdown (spend by model,
// storage by type). Markers label the thresholds that matter (alert,
// budget, quota). The scale always fits both the limit and the total, so
// going over the limit shows as the bar running past the last marker.
//
//   <MeterBar
//     max={1500}
//     segments={models.map((m) => ({ id: m.id, value: m.cost, color: m.color }))}
//     markers={[{ value: 1200, label: "80%" }, { value: 1500, label: "Budget" }]}
//     highlighted={hoveredId}
//   />

type Segment = { id: string; value: number; color?: string }
type Marker = { value: number; label: string }

function MeterBar({
  max,
  segments,
  markers = [],
  highlighted = null,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  /** The limit the value is measured against. */
  max: number
  segments: Segment[]
  markers?: Marker[]
  /** Segment id to keep at full strength while the others fade. */
  highlighted?: string | null
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const scale = Math.max(max, total) || 1
  const pct = (v: number) => `${(v / scale) * 100}%`
  const lastMarker = Math.max(...markers.map((m) => m.value), 0)

  return (
    <div
      data-slot="meter-bar"
      role="meter"
      aria-valuenow={total}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn("relative pt-1", markers.length > 0 && "pb-5", className)}
      {...props}
    >
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((s) => (
          <motion.span
            key={s.id}
            className="h-full transition-opacity duration-200 not-last:border-r-2 not-last:border-card"
            style={{
              background: s.color ?? "var(--brand)",
              opacity: highlighted && highlighted !== s.id ? 0.25 : 1,
            }}
            initial={false}
            animate={{ width: pct(s.value) }}
            transition={springSoft}
          />
        ))}
      </div>
      {markers.map((m) => (
        <motion.div
          key={m.label}
          data-slot="meter-bar-marker"
          className="absolute top-0 flex flex-col items-center"
          initial={false}
          animate={{ left: pct(m.value) }}
          transition={springSoft}
          // The last marker sits at the right edge until the total passes it.
          style={{ translateX: m.value === lastMarker && total <= m.value ? "-100%" : "-50%" }}
        >
          <span className="h-4 w-px bg-foreground/40" />
          <span className="eyebrow mt-1 text-faint-foreground">{m.label}</span>
        </motion.div>
      ))}
    </div>
  )
}

export { MeterBar, type Marker as MeterBarMarker, type Segment as MeterBarSegment }
