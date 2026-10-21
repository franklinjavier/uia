import * as React from "react"
import { AnimatePresence, motion, useMotionValue, useReducedMotion } from "motion/react"
import { GripVerticalIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { springSoft } from "@/lib/motion"

// The playground's own chrome: a small pill floating over the examples,
// draggable from anywhere on it so it can be moved off whatever it covers
// (the composer of a full-page chat, say). The grip only says it moves. It
// drifts a few pixels sideways until it's been moved once, as a hint, and
// remembers where it was left. A drag never counts as a click: the click
// that ends a drag is swallowed, so the menu doesn't open.
//
// The menu isn't a popover: the pill itself spreads upward into it (same
// corner radius all the way, like liquid), the items arriving once it has
// room, and folds back down when closed.

const KEY = "uia-dock"
const SPREAD = { type: "spring", bounce: 0.18, duration: 0.5 } as const

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
  menu,
  open = false,
  onOpenChange,
  children,
}: {
  className?: string
  /** Close anything a press opened (a select opens on pointer down). */
  onDragStart?: () => void
  /** What the pill spreads into when `open`. */
  menu?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
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
  const shell = React.useRef<HTMLDivElement>(null)

  // Close on Escape or a press anywhere else.
  React.useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange?.(false)
    const press = (e: PointerEvent) => {
      if (!shell.current?.contains(e.target as Node)) onOpenChange?.(false)
    }
    window.addEventListener("keydown", key)
    window.addEventListener("pointerdown", press)
    return () => {
      window.removeEventListener("keydown", key)
      window.removeEventListener("pointerdown", press)
    }
  }, [open, onOpenChange])

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
          ref={shell}
          layout
          animate={moved || reduced || open ? { x: 0 } : { x: [0, 6, 0, -3, 0] }}
          transition={{
            layout: SPREAD,
            x: moved || reduced || open ? springSoft : { duration: 3.2, ease: "easeInOut", repeat: Infinity, repeatDelay: 1.2 },
          }}
          // In style so motion keeps the corners round while it spreads.
          style={{ borderRadius: 20 }}
          className={cn(
            "flex flex-col overflow-hidden bg-background/90 p-1 shadow-[0_10px_36px_-14px_rgb(0_0_0/0.22)] ring-1 ring-border backdrop-blur transition-shadow dark:shadow-[0_10px_36px_-14px_rgb(0_0_0/0.6)]",
            dragging && "shadow-xl",
            className
          )}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {open && menu && (
              <motion.div
                key="menu"
                layout="position"
                initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.24, delay: 0.12 } }}
                exit={{ opacity: 0, y: 4, filter: "blur(3px)", transition: { duration: 0.12 } }}
                className="min-w-60"
              >
                {menu}
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div layout="position" className="flex items-center gap-1">
            <span aria-hidden className="flex h-8 w-5 items-center justify-center text-muted-foreground">
              <GripVerticalIcon className="size-4" />
            </span>
            {children}
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  )
}

