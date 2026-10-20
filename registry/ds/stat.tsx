import * as React from "react"
import { cn } from "@/lib/utils"

// Stat: eyebrow label, big light number, unit, mono meta line.
// Hierarchy comes from size and colour, never from bold weights.

function Stat({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="stat"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  )
}

function StatLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="stat-label"
      className={cn("eyebrow text-muted-foreground", className)}
      {...props}
    />
  )
}

function StatValue({
  className,
  size = "lg",
  ...props
}: React.ComponentProps<"div"> & { size?: "sm" | "lg" }) {
  return (
    <div
      data-slot="stat-value"
      data-size={size}
      className={cn(
        "flex items-baseline gap-1.5 tabular-nums data-[size=lg]:text-4xl data-[size=lg]:tracking-[-0.03em] data-[size=sm]:text-base group-data-[size=sm]/widget:data-[size=lg]:text-2xl",
        className
      )}
      {...props}
    />
  )
}

function StatUnit({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="stat-unit"
      className={cn(
        "text-base tracking-normal text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function StatMeta({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="stat-meta"
      className={cn("eyebrow text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Stat, StatLabel, StatMeta, StatUnit, StatValue }
