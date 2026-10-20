import type { Transition } from "motion/react"

// Shared motion vocabulary. Every animated element picks one of these;
// nothing defines its own timing inline.

/** Indicators, pills and anything that slides between positions. */
export const springSnappy: Transition = {
  type: "spring",
  duration: 0.4,
  bounce: 0.15,
}

/** Bars, meters and values that settle into a new size. */
export const springSoft: Transition = {
  type: "spring",
  duration: 0.7,
  bounce: 0,
}

/** Fades and colour changes. */
export const easeOut: Transition = {
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1],
}

/** Things appearing in place (cards, events): short fade + tiny lift. */
export const enter: Transition = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1],
}
