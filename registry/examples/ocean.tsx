import * as React from "react"

import { KoiPond } from "@/components/blocks/koi-pond"
import { Ocean } from "@/components/blocks/ocean"
import { Segmented, SegmentedItem } from "@/components/ds/segmented"

// Example: the ASCII water as a page's backdrop, koi, sharks or a piranha
// pack. A short line sits over the water, the switch picks what swims, and
// the corner counts what was eaten; switching starts a new count.

type Water = "koi" | "shark" | "piranha"

const WATERS: { value: Water; label: string; line: string; hint: string }[] = [
  { value: "koi", label: "Koi", line: "in a pond of patient things, cast a little food", hint: "Click anywhere to drop food. The koi turn for it." },
  { value: "shark", label: "Sharks", line: "the quiet ones circle the stragglers", hint: "Click anywhere to drop a school of fish." },
  { value: "piranha", label: "Piranhas", line: "nothing in the river stays whole for long", hint: "Click anywhere to put blood in the water." },
]

export function OceanExample({ predator: initial = "shark" }: { predator?: Water }) {
  const [water, setWater] = React.useState<Water>(initial)
  const [eaten, setEaten] = React.useState(0)
  const w = WATERS.find((x) => x.value === water)!

  const content = (
    <>
      <div className="pointer-events-none relative mx-auto flex h-full max-w-xl flex-col justify-center gap-6 px-6">
        <p className="font-mono text-sm text-muted-foreground">{w.line}</p>
        <p className="max-w-md text-sm text-foreground">{w.hint}</p>
        <div className="pointer-events-auto w-fit rounded-full bg-background/85 backdrop-blur-sm">
          <Segmented
            aria-label="What swims"
            value={water}
            onValueChange={(v) => {
              setWater(v as Water)
              setEaten(0)
            }}
          >
            {WATERS.map((x) => (
              <SegmentedItem key={x.value} value={x.value}>
                {x.label}
              </SegmentedItem>
            ))}
          </Segmented>
        </div>
      </div>
      <span className="pointer-events-none absolute top-5 right-6 eyebrow text-muted-foreground tabular-nums">
        {eaten} {water === "koi" ? "fed" : "eaten"}
      </span>
    </>
  )

  return water === "koi" ? (
    <KoiPond key="koi" className="h-svh w-full cursor-crosshair" onFeed={setEaten}>
      {content}
    </KoiPond>
  ) : (
    <Ocean key={water} predator={water} className="h-svh w-full cursor-crosshair" onEat={setEaten}>
      {content}
    </Ocean>
  )
}
