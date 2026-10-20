import * as React from "react"

import {
  AgentRuntime,
  type AgentRuntimeAgent,
} from "@/components/widgets/agent-runtime"

// Example: the AgentRuntime widget with demo data. The widget is a pure view
// (components/widgets/agent-runtime); this file is the fixture plus a
// client-side simulation of the lifecycle: invoke → cold start → warm →
// idle countdown → scaled to zero, with background traffic that keeps some
// agents warm and now and then wakes a sleeping one.

export const IDLE = 12
/** How long a simulated cold start stays in "starting", in ms. */
const WARM_UP = 700

export const AGENTS: AgentRuntimeAgent[] = [
  {
    id: "planner",
    name: "planner",
    meta: "kestrel-agent · 512 MB · HTTP API",
    trigger: "api",
    slot: [20, 20],
    status: "running",
    idle: 10,
    coldStarts: 3,
    startMs: 127,
  },
  {
    id: "code",
    name: "code-exec",
    meta: "Python 3.12 · 1 GB · job queue",
    trigger: "queue",
    slot: [80, 20],
    status: "running",
    idle: 12,
    coldStarts: 2,
    startMs: 141,
  },
  {
    id: "browser",
    name: "browser",
    meta: "Chromium 131 · 2 GB · schedule",
    trigger: "cron",
    slot: [20, 80],
    status: "running",
    idle: 3,
    coldStarts: 5,
    startMs: 212,
  },
  {
    id: "evals",
    name: "evals",
    meta: "Node 22 · 256 MB · webhook",
    trigger: "hook",
    slot: [80, 80],
    status: "zero",
    idle: 0,
    coldStarts: 4,
    startMs: 158,
  },
]

export const REGIONS = ["fra1", "iad1", "sin1"] as const

type Sim = {
  agents: AgentRuntimeAgent[]
  requests: number
  cold: number
  samples: number[]
}

type Action =
  | { type: "tick"; hit: boolean; target: string; wake: boolean; ms: number }
  | { type: "invoke"; id: string; ms: number }
  | { type: "warm"; id: string }

const INITIAL: Sim = {
  agents: AGENTS,
  requests: 413,
  cold: 13,
  samples: [127, 141, 158, 170, 182, 212, 176],
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

const coldStartMs = () => 120 + Math.round(Math.random() * 100)

function update(
  s: Sim,
  id: string,
  fn: (a: AgentRuntimeAgent) => AgentRuntimeAgent
): Sim {
  return { ...s, agents: s.agents.map((a) => (a.id === id ? fn(a) : a)) }
}

function coldStart(s: Sim, id: string, ms: number): Sim {
  return update(
    { ...s, cold: s.cold + 1, samples: [...s.samples.slice(-20), ms] },
    id,
    (a) => ({
      ...a,
      status: "starting",
      coldStarts: a.coldStarts + 1,
      startMs: ms,
    })
  )
}

// Pure transitions; the randomness is rolled by the caller so React can
// replay the reducer (StrictMode) without double cold starts.
function reducer(s: Sim, action: Action): Sim {
  switch (action.type) {
    case "tick": {
      // Warm agents count down to zero.
      let next: Sim = {
        ...s,
        agents: s.agents.map((a) =>
          a.status !== "running"
            ? a
            : a.idle <= 1
              ? { ...a, status: "zero", idle: 0 }
              : { ...a, idle: a.idle - 1 }
        ),
      }
      if (!action.hit) return next
      next = { ...next, requests: next.requests + 1 }
      const a = next.agents.find((x) => x.id === action.target)
      if (!a) return next
      if (a.status === "zero")
        return action.wake ? coldStart(next, a.id, action.ms) : next
      if (a.status === "running")
        return update(next, a.id, (x) => ({ ...x, idle: IDLE }))
      return next
    }
    case "invoke": {
      const next = { ...s, requests: s.requests + 1 }
      const a = next.agents.find((x) => x.id === action.id)
      if (!a || a.status === "starting") return next
      if (a.status === "zero") return coldStart(next, a.id, action.ms)
      return update(next, a.id, (x) => ({ ...x, idle: IDLE }))
    }
    case "warm":
      return update(s, action.id, (a) =>
        a.status === "starting" ? { ...a, status: "running", idle: IDLE } : a
      )
  }
}

export function AgentRuntimeExample() {
  const [sim, dispatch] = React.useReducer(reducer, INITIAL)

  // Clock: one tick a second; most ticks carry a background request.
  React.useEffect(() => {
    const t = window.setInterval(() => {
      dispatch({
        type: "tick",
        hit: Math.random() < 0.8,
        target: AGENTS[Math.floor(Math.random() * AGENTS.length)].id,
        wake: Math.random() < 0.3,
        ms: coldStartMs(),
      })
    }, 1000)
    return () => window.clearInterval(t)
  }, [])

  // A starting agent warms up after WARM_UP ms; one timer per agent.
  const timers = React.useRef(new Map<string, number>())
  const starting = sim.agents
    .filter((a) => a.status === "starting")
    .map((a) => a.id)
    .join(",")
  React.useEffect(() => {
    const map = timers.current
    for (const id of starting ? starting.split(",") : []) {
      if (map.has(id)) continue
      map.set(
        id,
        window.setTimeout(() => {
          map.delete(id)
          dispatch({ type: "warm", id })
        }, WARM_UP)
      )
    }
  }, [starting])
  React.useEffect(() => {
    const map = timers.current
    return () => {
      map.forEach((t) => window.clearTimeout(t))
      map.clear()
    }
  }, [])

  return (
    <AgentRuntime
      agents={sim.agents}
      idleTimeout={IDLE}
      requests={sim.requests}
      coldStarts={sim.cold}
      coldStartP50={median(sim.samples)}
      regions={REGIONS}
      onInvoke={(id) => dispatch({ type: "invoke", id, ms: coldStartMs() })}
    />
  )
}
