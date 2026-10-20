/**
 * Composition evals for agent-built surfaces.
 *
 *   bun scripts/eval-surfaces.ts            # checks evals/surfaces/outputs/*.json
 *
 * Each output is an agent's A2UI messages for a case (<case>.<run>.json).
 * Checks: the runtime's own rules (validateSurface: unbound facts, unknown
 * or unconfirmed actions, composition limits), no numbers written in prose,
 * and the case's expectations (who reaches the inbox, resolved items, what
 * must be confirmed). `.bad.json` runs are expected to fail.
 */
import { readdirSync, readFileSync } from "node:fs"

import { uiaCatalog } from "../registry/catalog/index"
import { surfaceFromMessages } from "../registry/surface/store"
import { validateSurface } from "../registry/surface/validate"
import type { ComponentNode } from "../registry/surface/types"
import { CASES, factoryActions } from "../evals/surfaces/cases"

const DIR = "evals/surfaces/outputs"
const ASKS = new Set(["DecisionCard", "Confirmation", "Confirm"])
const PROSE = ["context", "consequence", "description", "note", "why", "summary", "text", "title", "label"]

/** A fact-looking number in literal prose: ids (T-583), versions (v42) and hashes don't count. */
function factInProse(text: string) {
  const t = text.replace(/\b[A-Za-z]+-\d+\b/g, "").replace(/\bv\d+(\.\d+)*\b/gi, "").replace(/\b[0-9a-f]{6,}\b/g, "")
  return /\d/.test(t)
}

function actionNames(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => actionNames(x, out))
  else if (v && typeof v === "object") {
    const ev = (v as { event?: { name?: unknown } }).event
    if (ev && typeof ev.name === "string") out.push(ev.name)
    else Object.values(v).forEach((x) => actionNames(x, out))
  }
  return out
}

let failedUnexpectedly = 0
for (const file of readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  const [caseId, run] = file.replace(/\.json$/, "").split(".")
  const c = CASES.find((x) => x.id === caseId)
  if (!c) continue
  const messages = JSON.parse(readFileSync(`${DIR}/${file}`, "utf8"))
  const surface = surfaceFromMessages(messages)
  const problems: string[] = []
  if (!surface) problems.push("no surface")
  else {
    const nodes = Object.values(surface.components) as ComponentNode[]
    for (const i of validateSurface(surface, uiaCatalog, { actions: factoryActions, layout: c.layout ?? "page" }).filter((x) => x.code !== "AUTOFIXED"))
      problems.push(`${i.code} ${i.componentId}: ${i.message}`)
    for (const n of nodes)
      for (const k of PROSE)
        if (typeof n[k] === "string" && factInProse(n[k] as string))
          problems.push(`NUMBER_IN_PROSE ${n.id}.${k}: "${n[k]}" — bind facts instead`)
    const asking = nodes.filter((n) => ASKS.has(n.component)).map((n) => n.id)
    if (c.ownerDecisions) {
      const extra = asking.filter((id) => !c.ownerDecisions!.includes(id))
      const missing = c.ownerDecisions.filter((id) => !asking.includes(id))
      if (extra.length) problems.push(`ROUTING asks the owner about ${extra.join(", ")} (not their call)`)
      if (missing.length) problems.push(`ROUTING doesn't ask about ${missing.join(", ")}`)
    }
    for (const id of c.resolved ?? []) {
      if (asking.includes(id)) problems.push(`RESOLVED ${id} is asked as a question`)
      if (!surface.components[id]) problems.push(`RESOLVED ${id} isn't shown at all`)
    }
    for (const name of c.mustConfirm ?? []) {
      const holders = nodes.filter((n) => actionNames({ ...n, children: undefined }).includes(name))
      if (!holders.length) problems.push(`CONFIRM "${name}" is not offered`)
    }
  }
  const expectedFail = run === "bad"
  const ok = problems.length === 0
  if (ok === expectedFail) failedUnexpectedly++
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.id}.${run}${expectedFail ? " (expected to fail)" : ""}`)
  for (const p of problems) console.log(`      ${p}`)
}
console.log(failedUnexpectedly ? `\n${failedUnexpectedly} unexpected result(s)` : "\nall results as expected")
process.exit(failedUnexpectedly ? 1 : 0)
