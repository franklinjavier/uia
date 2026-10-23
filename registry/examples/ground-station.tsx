import * as React from "react"

import {
  GroundStation,
  look,
  type GroundSatellite,
  type GroundStationSite,
} from "@/components/blocks/ground-station"

// Example: the GroundStation widget over a simulated sky. The widget is a
// pure view; this file is the fixture: three stations, three satellites on
// real circular orbits, time running at ×60 from 06:08:57 UTC, data piling
// up onboard between passes and draining while one is in view, and a fake
// Book that takes a moment.

export const STATIONS: GroundStationSite[] = [
  { id: "vela", name: "Vela Point", lat: 64.2, lon: 12.4 },
  { id: "kestrel", name: "Kestrel Ridge", lat: 12.6, lon: -16.8 },
  { id: "halcyon", name: "Halcyon Bay", lat: -36.4, lon: 152.0 },
]

const SATELLITES: GroundSatellite[] = [
  { id: "LARK-1", label: "SSO · 548 km", orbit: { inc: 97.6, raan: 270, alt: 548, phase: 152 }, onboard: 6.9, capacity: 16 },
  { id: "WREN-2", label: "LEO 58° · 612 km", orbit: { inc: 58, raan: 50, alt: 612, phase: 345 }, onboard: 3.2, capacity: 16 },
  { id: "SWIFT-3", label: "LEO 70° · 744 km", orbit: { inc: 70, raan: 10, alt: 744, phase: 260 }, onboard: 9.8, capacity: 16 },
]

const START = 6 * 3600 + 8 * 60 + 57
const SPEED = 60
const TICK = 250 // ms
const MASK = 10
/** GB gathered per simulated second while out of contact. */
const GATHER = 0.0004

export function GroundStationExample() {
  const [stationId, setStationId] = React.useState(STATIONS[0].id)
  const [selectedId, setSelectedId] = React.useState(SATELLITES[0].id)
  const [sim, setSim] = React.useState({ time: START, sats: SATELLITES })

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setSim(({ time, sats }) => {
        const dt = (TICK / 1000) * SPEED
        const site = STATIONS.find((s) => s.id === stationId)!
        return {
          time: time + dt,
          sats: sats.map((s) => {
            const { el } = look(site, s.orbit, time)
            // In view: downlink at a rate that rises with elevation (Mbps → GB).
            const drain = el > MASK ? ((40 + 110 * Math.sin((el * Math.PI) / 180)) * dt) / 8000 : 0
            const onboard = Math.min(s.capacity, Math.max(0.2, s.onboard + GATHER * dt - drain))
            return { ...s, onboard }
          }),
        }
      })
    }, TICK)
    return () => window.clearInterval(id)
  }, [stationId])

  return (
    <GroundStation
      stations={STATIONS}
      stationId={stationId}
      onStationChange={setStationId}
      satellites={sim.sats}
      selectedId={selectedId}
      onSelect={setSelectedId}
      time={sim.time}
      speed={SPEED}
      mask={MASK}
      onBook={() => new Promise((r) => window.setTimeout(r, 900))}
    />
  )
}
