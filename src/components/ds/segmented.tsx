import * as React from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { springSnappy } from "@/lib/motion"

// Segmented control: single-choice pill group with a sliding indicator.
// `variant="mono"` uses eyebrow type (filters, modes); `sans` for tabs.

type SegmentedContextValue = {
  value: string
  indicatorId: string
  variant: "mono" | "sans"
}

const SegmentedContext = React.createContext<SegmentedContextValue | null>(
  null
)

function Segmented({
  value,
  onValueChange,
  variant = "mono",
  className,
  children,
  ...props
}: Omit<ToggleGroupPrimitive.Props, "value" | "onValueChange"> & {
  value: string
  onValueChange: (value: string) => void
  variant?: "mono" | "sans"
}) {
  const indicatorId = React.useId()

  return (
    <ToggleGroupPrimitive
      data-slot="segmented"
      data-variant={variant}
      value={[value]}
      onValueChange={(next) => {
        if (next[0]) onValueChange(next[0])
      }}
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-muted/60 p-0.5 dark:bg-transparent",
        className
      )}
      {...props}
    >
      <SegmentedContext.Provider value={{ value, indicatorId, variant }}>
        {children}
      </SegmentedContext.Provider>
    </ToggleGroupPrimitive>
  )
}

function SegmentedItem({
  value,
  className,
  children,
  ...props
}: Omit<TogglePrimitive.Props, "value"> & { value: string }) {
  const context = React.useContext(SegmentedContext)
  if (!context) throw new Error("SegmentedItem must be used within Segmented")
  const active = context.value === value

  return (
    <TogglePrimitive
      data-slot="segmented-item"
      value={value}
      className={cn(
        "relative inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 data-pressed:text-foreground",
        context.variant === "mono" ? "eyebrow" : "text-sm",
        className
      )}
      {...props}
    >
      {active && (
        <motion.span
          layoutId={context.indicatorId}
          transition={springSnappy}
          className="absolute inset-0 rounded-full bg-card shadow-sm ring-1 ring-border/60 dark:bg-accent dark:ring-0"
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-1.5">
        {children}
      </span>
    </TogglePrimitive>
  )
}

export { Segmented, SegmentedItem }
