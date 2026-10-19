import * as React from "react"
import { AnimatePresence, motion } from "motion/react"

import { springSoft } from "@/lib/motion"

// PartTransition: how a human-in-the-loop part closes after the person
// acts (question → answered, draft → sent, approval → done).
//
// The outgoing state fades out with a slight shrink and blur while the
// incoming one fades in, and the wrapper's height eases from one to the
// other so the transcript below glides instead of jumping. Change `state`
// to trigger it; the first render never animates (the parts have their
// own entrance).
//
// Local height animation only — no layout projection, which would drag
// the part around while the transcript streams under it.
export function PartTransition({
  state,
  children,
}: {
  state: string
  children: React.ReactNode
}) {
  const inner = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState<number | "auto">("auto")

  React.useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setHeight(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <motion.div
      data-slot="part-transition"
      initial={false}
      animate={{ height }}
      transition={springSoft}
      // -mb-1/pb-1 keeps the cards' small shadow from being clipped.
      className="relative -mb-1 overflow-hidden"
    >
      <div ref={inner} className="pb-1">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={state}
            initial={{ opacity: 0, filter: "blur(2px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.98, filter: "blur(2px)" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top center" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
