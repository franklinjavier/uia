import * as React from "react"
import { motion, useMotionValue, useReducedMotion } from "motion/react"
import { GripVerticalIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { springSoft } from "@/lib/motion"

// The playground's own chrome: a small pill floating over the examples,
// draggable from anywhere on it so it can be moved off whatever it covers
// (the composer of a full-page chat, say). The grip only says it moves. It
// drifts a few pixels sideways until it's been moved once, as a hint, and
// remembers where it was left. A drag never counts as a click: the click
// that ends a drag is swallowed, so the menu doesn't open.

const KEY = "uia-dock"

function load(): { x: number; y: number; moved: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null")
    if (v && typeof v.x === "number" && typeof v.y === "number") return { ...v, moved: true }
  } catch {
    /* storage unavailable: start in the corner */
  }
  return { x: 0, y: 0, moved: false }
}

export function PlaygroundDock({
  className,
  onDragStart,
  children,
}: {
  className?: string
  /** Close anything a press opened (a select opens on pointer down). */
  onDragStart?: () => void
  children: React.ReactNode
}) {
  const area = React.useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [initial] = React.useState(load)
  const x = useMotionValue(initial.x)
  const y = useMotionValue(initial.y)
  const [moved, setMoved] = React.useState(initial.moved)
  const [dragging, setDragging] = React.useState(false)
  const justDragged = React.useRef(false)

  return (
    // The drag area: the viewport minus a margin; the pill can't leave it.
    <div ref={area} className="pointer-events-none fixed inset-3 z-50">
      <motion.div
        drag
        dragConstraints={area}
        dragElastic={0.06}
        dragMomentum={false}
        style={{ x, y }}
        onDragStart={() => {
          onDragStart?.()
          setDragging(true)
          setMoved(true)
          justDragged.current = true
        }}
        onClickCapture={(e) => {
          if (justDragged.current) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        onPointerDownCapture={() => {
          justDragged.current = false
        }}
        onDragEnd={() => {
          setDragging(false)
          try {
            localStorage.setItem(KEY, JSON.stringify({ x: x.get(), y: y.get() }))
          } catch {
            /* not persisted; fine */
          }
        }}
        className={cn("pointer-events-auto absolute bottom-1 left-1 touch-none", dragging ? "cursor-grabbing" : "cursor-grab")}
      >
        {/* The hint: a slow sideways drift, until the first drag. */}
        <motion.div
          animate={moved || reduced ? { x: 0 } : { x: [0, 6, 0, -3, 0] }}
          transition={moved || reduced ? springSoft : { duration: 3.2, ease: "easeInOut", repeat: Infinity, repeatDelay: 1.2 }}
          className={cn(
            "flex items-center gap-1 rounded-full bg-background/90 p-1 shadow-lg ring-1 ring-border backdrop-blur transition-shadow",
            dragging && "shadow-xl",
            className
          )}
        >
          <span aria-hidden className="flex h-8 w-5 items-center justify-center text-muted-foreground">
            <GripVerticalIcon className="size-4" />
          </span>
          {children}
        </motion.div>
      </motion.div>
    </div>
  )
}

