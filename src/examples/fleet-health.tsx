import * as React from "react"

import {
  FleetHealth,
  type FleetCluster,
  type FleetGpu,
  type FleetNode,
} from "@/components/widgets/fleet-health"

// Example: the FleetHealth widget with a simulated fleet. The widget is a
// pure view (components/widgets/fleet-health); this file is the fixture:
// seeded clusters, a random walk ticking every 1.6 s and a fake Rebalance
// that evens the load out after a second.

export const TICK = 1600
export const POWER_CAP = 52

/** Simulated GPU: `heat` is extra degrees over what the load explains. */
type SimGpu = FleetGpu & { heat?: number }
type SimNode = Omit<FleetNode, "kind" | "gpus"> & {
  kind: "H100" | "B200"
  gpus: SimGpu[]
}

const tempFor = (g: Pick<SimGpu, "util" | "heat">) =>
  44 + g.util * 40 + (g.heat ?? 0)

const JOBS = [
  "lumen-70b-instruct · TP4",
  "quill-embed-v2",
  "atlas-8b · batch",
  "lumen-70b-instruct · TP4",
  "rerank-xl",
]

export const CLUSTERS: (FleetCluster & { seed: number })[] = [
  { id: "kestrel-iad-3", location: "Ashburn", seed: 1 },
  { id: "kestrel-fra-1", location: "Frankfurt", seed: 2 },
  { id: "kestrel-sin-2", location: "Singapore", seed: 3 },
]

function rand(seed: number) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

export function makeFleet(seed: number): SimNode[] {
  const r = rand(seed)
  const base = [0.79, 0.75, 0.89, 0.62, 0.69, 0.84, 0.8, 0.58]
  return base
    .map((b, n) => {
      const kind: SimNode["kind"] = n < 5 ? "H100" : "B200"
      const memTotal = kind === "H100" ? 80 : 192
      const gpus: SimGpu[] = Array.from({ length: 8 }, () => {
        const util = Math.min(0.99, Math.max(0.3, b + (r() - 0.5) * 0.2))
        return {
          util,
          mem: memTotal * Math.min(0.97, util * (0.7 + r() * 0.35)),
          temp: 44 + util * 40 + r() * 2,
          watts: 180 + util * 480,
          job: JOBS[Math.floor(r() * JOBS.length)],
          state: "busy",
        }
      })
      return {
        id: `ks-${n < 5 ? "a" : "b"}0${n < 5 ? n + 1 : n - 4}`,
        kind,
        memTotal,
        gpus,
      }
    })
    .map((node, n) => {
      // A few fixed situations so every state is on screen.
      if (n === 2)
        node.gpus[7] = {
          ...node.gpus[7],
          util: 0.95,
          heat: 7,
          temp: tempFor({ util: 0.95, heat: 7 }),
          watts: 690,
        }
      if (n === 3) {
        node.gpus[6] = {
          ...node.gpus[6],
          util: 0,
          mem: 0,
          temp: 31,
          watts: 60,
          job: "Draining",
          state: "draining",
        }
        node.gpus[7] = {
          ...node.gpus[7],
          util: 0.02,
          mem: 0.8,
          temp: 35,
          watts: 99,
          job: "Idle · warm spare",
          state: "idle",
        }
      }
      if (n === 7)
        node.gpus[7] = {
          ...node.gpus[7],
          util: 0.02,
          mem: 0.6,
          temp: 34,
          watts: 95,
          job: "Idle · warm spare",
          state: "idle",
        }
      return node
    })
}

const avg = (xs: number[]) =>
  xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
const jitter = (v: number, amount: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v + (Math.random() - 0.5) * amount))

function useFleet(seed: number) {
  const [nodes, setNodes] = React.useState(() => makeFleet(seed))
  const [tokens, setTokens] = React.useState(() =>
    Array.from(
      { length: 40 },
      (_, i) => 1_850_000 + Math.sin(i / 4) * 30_000 + i * 900
    )
  )
  const [queue, setQueue] = React.useState(91)

  React.useEffect(() => {
    const t = window.setInterval(() => {
      setNodes((list) =>
        list.map((node) => ({
          ...node,
          gpus: node.gpus.map((g) => {
            if (g.state !== "busy") return g
            const util = jitter(g.util, 0.06, 0.25, 0.99)
            return {
              ...g,
              util,
              temp: jitter(tempFor({ util, heat: g.heat }), 1.5, 30, 95),
              watts: 180 + util * 480,
              mem: jitter(g.mem, node.memTotal * 0.03, 0, node.memTotal * 0.97),
            }
          }),
        }))
      )
      setTokens((xs) => [
        ...xs.slice(1),
        jitter(xs.at(-1)!, 60_000, 1_780_000, 1_960_000),
      ])
      setQueue((q) => Math.round(jitter(q, 10, 40, 160)))
    }, TICK)
    return () => window.clearInterval(t)
  }, [])

  return { nodes, setNodes, tokens, queue }
}

export function FleetHealthExample() {
  const [cluster, setCluster] = React.useState(CLUSTERS[0].id)
  const { nodes, setNodes, tokens, queue } = useFleet(CLUSTERS[0].seed)

  // The fake rebalance resolves after a second; drop it on unmount.
  const pending = React.useRef<number | undefined>(undefined)
  React.useEffect(() => () => window.clearTimeout(pending.current), [])

  function rebalance() {
    const target = avg(
      nodes.flatMap((n) =>
        n.gpus.filter((g) => g.state === "busy").map((g) => g.util)
      )
    )
    return new Promise<void>((resolve) => {
      pending.current = window.setTimeout(() => {
        setNodes((list) =>
          list.map((node) => ({
            ...node,
            gpus: node.gpus.map((g) =>
              g.state !== "busy"
                ? g
                : {
                    ...g,
                    util: jitter(target, 0.04, 0.3, 0.95),
                    temp: tempFor({ util: target, heat: g.heat }),
                    watts: 180 + target * 480,
                  }
            ),
          }))
        )
        resolve()
      }, 1100)
    })
  }

  return (
    <FleetHealth
      nodes={nodes}
      tokens={tokens}
      queue={queue}
      powerCap={POWER_CAP}
      interval={TICK}
      tokensMeta="TTFT p50 218 ms · 5 models"
      clusters={CLUSTERS}
      cluster={cluster}
      onClusterChange={(id) => {
        setCluster(id)
        setNodes(makeFleet(CLUSTERS.find((c) => c.id === id)!.seed))
      }}
      onRebalance={rebalance}
    />
  )
}
