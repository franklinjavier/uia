import * as React from "react"
import { Volume2Icon, VolumeXIcon } from "lucide-react"

import { Fireflies } from "@/components/blocks/fireflies"
import { KoiPond } from "@/components/blocks/koi-pond"
import { Murmuration } from "@/components/blocks/murmuration"
import { Ocean } from "@/components/blocks/ocean"
import { Segmented, SegmentedItem } from "@/components/ds/segmented"
import { Button } from "@/components/ui/button"
import { useSoundscape } from "@/hooks/use-soundscape"

// Example: the ASCII backdrops behind one switch: koi, sharks, a piranha
// pack, a starling flock, fireflies. The switch at the top picks the scene,
// a short line sits over it, and the corner counts what happened; switching
// starts a new count.
// Sound starts off; the speaker beside the switch plays each scene's loop,
// with a sound for each click and each catch.

type Water = "koi" | "shark" | "piranha" | "starling" | "firefly"

const WATERS: { value: Water; label: string; line: string; hint: string }[] = [
  { value: "koi", label: "Koi", line: "in a pond of patient things, cast a little food", hint: "Click anywhere to drop food. The koi turn for it." },
  { value: "shark", label: "Sharks", line: "the quiet ones circle the stragglers", hint: "Click anywhere to drop a school of fish." },
  { value: "piranha", label: "Piranhas", line: "nothing in the river stays whole for long", hint: "Click anywhere to put blood in the water." },
  { value: "starling", label: "Starlings", line: "a thousand birds, one mind, and something watching", hint: "Click anywhere to send a hawk through." },
  { value: "firefly", label: "Fireflies", line: "a field at dusk, every light keeping its own time", hint: "Click anywhere to flash. They lose the beat, then find each other again." },
]

const SCENE = "h-svh w-full cursor-crosshair"

export function OceanExample({
  predator: initial = "shark",
  onPredatorChange,
}: {
  predator?: Water
  /** Called when the switch changes, e.g. to keep the URL in step. */
  onPredatorChange?: (water: Water) => void
}) {
  const [water, setWater] = React.useState<Water>(initial)
  const [eaten, setEaten] = React.useState(0)
  const [sound, setSound] = React.useState(false)
  const cue = useSoundscape(water, sound)
  const w = WATERS.find((x) => x.value === water)!
  const strip = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    strip.current?.querySelector("[data-pressed]")?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [water])
  const count = (n: number) => {
    setEaten(n)
    cue("event")
  }

  const content = (
    <>
      {/* The switch sits at the top, where a longer line below can't push it. */}
      <div className="pointer-events-none absolute inset-x-0 top-4 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
        <div className="pointer-events-auto flex max-w-full min-w-0 items-center gap-1 rounded-full bg-background/85 backdrop-blur-sm">
          {/* On a phone the switch scrolls; the speaker stays in view beside it. */}
          <div ref={strip} className="min-w-0 overflow-x-auto rounded-full [scrollbar-width:none]">
            <Segmented
              aria-label="Backdrop"
              value={water}
              onValueChange={(v) => {
                setWater(v as Water)
                setEaten(0)
                onPredatorChange?.(v as Water)
              }}
            >
              {WATERS.map((x) => (
                <SegmentedItem key={x.value} value={x.value}>
                  {x.label}
                </SegmentedItem>
              ))}
            </Segmented>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 rounded-full text-muted-foreground"
            aria-label="Sound"
            aria-pressed={sound}
            onClick={() => setSound((on) => !on)}
          >
            {sound ? <Volume2Icon /> : <VolumeXIcon />}
          </Button>
        </div>
        <span className="eyebrow text-muted-foreground tabular-nums">
          {water === "firefly"
            ? `${eaten}% in step`
            : `${eaten} ${water === "koi" ? "fed" : water === "starling" ? (eaten === 1 ? "hawk" : "hawks") : "eaten"}`}
        </span>
      </div>
      <div className="pointer-events-none relative mx-auto flex h-full max-w-xl flex-col justify-center gap-6 px-6">
        <p className="font-mono text-sm text-muted-foreground">{w.line}</p>
        <p className="max-w-md text-sm text-foreground">{w.hint}</p>
      </div>
    </>
  )

  return (
    <div
      className="contents"
      // A click on the water, not on the controls, gets its own sound.
      onPointerDownCapture={(e) => {
        if (!(e.target as HTMLElement).closest("a,button,input,select,textarea,[role=button]")) cue("click")
      }}
    >
      {water === "firefly" ? (
        <Fireflies key="firefly" className={SCENE} onSync={setEaten}>
          {content}
        </Fireflies>
      ) : water === "starling" ? (
        <Murmuration key="starling" className={SCENE} onHawk={count}>
          {content}
        </Murmuration>
      ) : water === "koi" ? (
        <KoiPond key="koi" className={SCENE} onFeed={count}>
          {content}
        </KoiPond>
      ) : (
        <Ocean key={water} predator={water} className={SCENE} onEat={count}>
          {content}
        </Ocean>
      )}
    </div>
  )
}
