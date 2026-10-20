import * as React from "react"
import { motion, useSpring, useTransform } from "motion/react"
import { cn } from "@/lib/utils"

// Animates between numeric values instead of swapping them.
function NumberTicker({
  value,
  format = (v) => Math.round(v).toLocaleString("en-US"),
  className,
}: {
  value: number
  format?: (value: number) => string
  className?: string
}) {
  const spring = useSpring(value, { stiffness: 140, damping: 24 })
  const display = useTransform(spring, format)

  React.useEffect(() => {
    spring.set(value)
  }, [spring, value])

  return (
    <motion.span
      data-slot="number-ticker"
      className={cn("tabular-nums", className)}
    >
      {display}
    </motion.span>
  )
}

export { NumberTicker }
