import * as React from "react"

import { Ocean } from "@/components/blocks/ocean"
import { Segmented, SegmentedItem } from "@/components/ds/segmented"

// Example: the ocean as a page's backdrop, sharks or a piranha pack. A short
// line sits over the water and the corner counts what was eaten; switching
// predator starts a new count.

const PREDATORS = [
  { value: "shark", label: "Sharks" },
  { value: "piranha", label: "Piranhas" },
] as const

export function OceanExample({ predator: initial = "shark" }: { predator?: "shark" | "piranha" }) {
  const [predator, setPredator] = React.useState<"shark" | "piranha">(initial)
  const [eaten, setEaten] = React.useState(0)

  return (
    <Ocean key={predator} predator={predator} className="h-svh w-full cursor-crosshair" onEat={setEaten}>
      <div className="pointer-events-none relative mx-auto flex h-full max-w-xl flex-col justify-center gap-6 px-6">
        <p className="font-mono text-sm text-muted-foreground">
          {predator === "shark" ? "the quiet ones circle the stragglers" : "nothing in the river stays whole for long"}
        </p>
        <p className="max-w-md text-sm text-foreground">
          {predator === "shark" ? "Click anywhere to drop a school of fish." : "Click anywhere to put blood in the water."}
        </p>
        <div className="pointer-events-auto w-fit rounded-full bg-background/85 backdrop-blur-sm">
          <Segmented
            aria-label="Predator"
            value={predator}
            onValueChange={(v) => {
              setPredator(v as "shark" | "piranha")
              setEaten(0)
            }}
          >
            {PREDATORS.map((p) => (
              <SegmentedItem key={p.value} value={p.value}>
                {p.label}
              </SegmentedItem>
            ))}
          </Segmented>
        </div>
      </div>
      <span className="pointer-events-none absolute top-5 right-6 eyebrow text-muted-foreground tabular-nums">
        {eaten} eaten
      </span>
    </Ocean>
  )
}
