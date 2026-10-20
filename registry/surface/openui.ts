import { z } from "zod"

import type { Catalog } from "@/components/surface/catalog"
import type { ComponentNode, SurfaceMessage } from "@/components/surface/types"

// OpenUI Lang as an input format (https://www.openui.com/docs/openui-lang):
// a line-oriented syntax that models write in far fewer tokens than JSON.
// This adapter turns it into A2UI messages for <Surface>, so the same
// catalog, rules and host contracts apply.
//
//   root = Section("Spend", null, [spent, meter])
//   spent = Stat("Spent", @Path("/spend/total"), "currency")
//   approve = Button("Approve", "primary", @Approve({id: "t289"}))
//
// Positional arguments follow the catalog entry's prop order (Zod key
// order), `null` skips one. uia conventions on top of the language:
//   @Path("/pointer")                  a binding into the data model (facts)
//   @Each("/items", rowRef, "id")      a template child list (path, row, key)
//   @SomeAction({…})                   a named event → `some_action` + context
//   @ToAssistant("text", {…})          event `to_assistant` with { message, … }
//   one extra trailing {span, fallback}  props every node may have
//
// Left out on purpose — they put logic in the model's hands: `$variables`,
// ternaries and operators, Query / Mutation, functions. A line that uses
// them is dropped and reported, the rest still renders.

export type OpenUIIssue = { line: number; code: string; message: string }

type Val =
  | { t: "lit"; v: unknown }
  | { t: "ref"; name: string }
  | { t: "call"; name: string; args: Val[] }
  | { t: "at"; name: string; args: Val[] }
  | { t: "arr"; items: Val[] }
  | { t: "obj"; entries: [string, Val][] }

class ParseError extends Error {}

function parseExpr(src: string): Val {
  let i = 0
  const ws = () => {
    while (i < src.length && /\s/.test(src[i])) i++
  }
  const peek = () => (ws(), src[i])
  const expect = (c: string) => {
    if (peek() !== c) throw new ParseError(`expected "${c}" at ${i}`)
    i++
  }
  const ident = () => {
    ws()
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))
    if (!m) throw new ParseError(`expected a name at ${i}`)
    i += m[0].length
    return m[0]
  }
  const list = (close: string): Val[] => {
    const out: Val[] = []
    if (peek() === close) {
      i++
      return out
    }
    for (;;) {
      out.push(value())
      if (peek() === ",") {
        i++
        continue
      }
      expect(close)
      return out
    }
  }
  const value = (): Val => {
    const c = peek()
    if (c === "$")
      throw new ParseError(
        "$variables aren't supported (state stays in the host)"
      )
    if (c === '"' || c === "'") {
      const q = src[i++]
      let s = ""
      while (i < src.length && src[i] !== q) {
        if (src[i] === "\\") {
          i++
          s += { n: "\n", t: "\t" }[src[i]] ?? src[i]
        } else s += src[i]
        i++
      }
      if (src[i] !== q) throw new ParseError("unterminated string")
      i++
      return { t: "lit", v: s }
    }
    if (c === "[") {
      i++
      return { t: "arr", items: list("]") }
    }
    if (c === "{") {
      i++
      const entries: [string, Val][] = []
      if (peek() === "}") {
        i++
        return { t: "obj", entries }
      }
      for (;;) {
        ws()
        const key =
          src[i] === '"' || src[i] === "'"
            ? String((value() as { v: string }).v)
            : ident()
        expect(":")
        entries.push([key, value()])
        if (peek() === ",") {
          i++
          continue
        }
        expect("}")
        return { t: "obj", entries }
      }
    }
    if (c === "@") {
      i++
      const name = ident()
      expect("(")
      return { t: "at", name, args: list(")") }
    }
    const num = /^-?\d+(\.\d+)?([eE][-+]?\d+)?/.exec(src.slice(i))
    if (num) {
      i += num[0].length
      return { t: "lit", v: Number(num[0]) }
    }
    const name = ident()
    if (name === "true" || name === "false")
      return { t: "lit", v: name === "true" }
    if (name === "null") return { t: "lit", v: null }
    if (name === "Query" || name === "Mutation")
      throw new ParseError(`${name} isn't supported (data comes from the host)`)
    if (peek() === "(") {
      i++
      return { t: "call", name, args: list(")") }
    }
    return { t: "ref", name }
  }
  const v = value()
  ws()
  if (i < src.length)
    throw new ParseError(
      `unexpected "${src.slice(i, i + 12)}" (operators and ternaries aren't supported)`
    )
  return v
}

const snake = (s: string) =>
  s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()

/**
 * Parse OpenUI Lang (whole or streaming: an unfinished last line waits) into
 * A2UI messages for `surfaceId`. Data still comes from the host through
 * `updateDataModel`.
 */
export function openUIToMessages(
  text: string,
  catalog: Catalog,
  {
    surfaceId = "surface",
    streaming = false,
  }: { surfaceId?: string; streaming?: boolean } = {}
): { messages: SurfaceMessage[]; issues: OpenUIIssue[] } {
  const issues: OpenUIIssue[] = []
  const lines = text.split("\n")
  if (streaming && !text.endsWith("\n")) lines.pop() // still arriving
  const stmts = new Map<string, { line: number; val: Val }>()
  lines.forEach((raw, n) => {
    const line = raw.trim()
    if (!line || line.startsWith("//") || line.startsWith("]]>openui:")) return
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/.exec(line)
    if (!m)
      return issues.push({
        line: n + 1,
        code: "parse-failed",
        message: `not a statement: ${line.slice(0, 40)}`,
      })
    try {
      stmts.set(m[1], { line: n + 1, val: parseExpr(m[2]) }) // last definition wins
    } catch (e) {
      issues.push({
        line: n + 1,
        code: "unsupported",
        message: `${m[1]}: ${(e as Error).message}`,
      })
    }
  })

  const nodes: ComponentNode[] = []
  const isComponent = (name: string) => stmts.get(name)?.val.t === "call"
  let synthetic = 0

  // A value as a prop: refs to components become ids, refs to values inline.
  const toProp = (v: Val, line: number, owner: string): unknown => {
    switch (v.t) {
      case "lit":
        return v.v
      case "arr":
        return v.items.map((x) => toProp(x, line, owner))
      case "obj":
        return Object.fromEntries(
          v.entries.map(([k, x]) => [k, toProp(x, line, owner)])
        )
      case "ref": {
        const s = stmts.get(v.name)
        // Not defined (yet): a forward reference. Streaming, it simply hasn't
        // arrived — the renderer shows a skeleton for that id. At the end it's
        // an issue, but the id is kept so the rest still renders.
        if (!s) {
          if (!streaming)
            issues.push({
              line,
              code: "unknown-ref",
              message: `"${v.name}" is never defined`,
            })
          return v.name
        }
        return isComponent(v.name) ? v.name : toProp(s.val, s.line, owner)
      }
      case "call": {
        const id = `${owner}__${++synthetic}`
        node(id, v, line)
        return id
      }
      case "at": {
        const args = v.args.map((x) => toProp(x, line, owner))
        if (v.name === "Path") return { path: String(args[0] ?? "/") }
        if (v.name === "Each")
          return {
            path: String(args[0] ?? "/"),
            componentId: String(args[1] ?? ""),
            ...(args[2] ? { key: String(args[2]) } : {}),
          }
        if (v.name === "ToAssistant")
          return {
            event: {
              name: "to_assistant",
              context: { message: args[0], ...((args[1] as object) ?? {}) },
            },
          }
        const ctx =
          args[0] && typeof args[0] === "object" && !Array.isArray(args[0])
            ? (args[0] as Record<string, unknown>)
            : undefined
        return {
          event: { name: snake(v.name), ...(ctx ? { context: ctx } : {}) },
        }
      }
    }
  }

  const node = (
    id: string,
    call: Extract<Val, { t: "call" }>,
    line: number
  ) => {
    let v = call
    const entry = catalog.components[v.name]
    const out: ComponentNode = { id, component: v.name }
    if (!entry) {
      issues.push({
        line,
        code: "unknown-component",
        message: `${v.name} is not in the catalog`,
      })
      nodes.push(out)
      return
    }
    const keys = Object.keys((entry.props as z.ZodObject).shape)
    // uia convention: one extra trailing object carries the props every
    // node may have, e.g. Section("Daily cost", null, [bars], null, {span: 2}).
    const last = v.args[keys.length]
    if (v.args.length === keys.length + 1 && last?.t === "obj") {
      for (const [k, x] of last.entries)
        if (k === "span" || k === "fallback") out[k] = toProp(x, line, id)
      v = { ...v, args: v.args.slice(0, keys.length) }
    }
    if (v.args.length > keys.length)
      issues.push({
        line,
        code: "excess-args",
        message: `${v.name} takes ${keys.length} arguments (${keys.join(", ")})`,
      })
    v.args.slice(0, keys.length).forEach((arg, k) => {
      if (arg.t === "lit" && arg.v === null) return // skipped
      const value = toProp(arg, line, id)
      if (value !== undefined) out[keys[k]] = value
    })
    nodes.push(out)
  }

  for (const [name, s] of stmts)
    if (s.val.t === "call") node(name, s.val, s.line)
  if (!stmts.has("root") && !streaming)
    issues.push({
      line: 0,
      code: "no-root",
      message: 'no statement named "root"',
    })

  return {
    messages: [
      { version: "v0.9", createSurface: { surfaceId, catalogId: catalog.id } },
      { version: "v0.9", updateComponents: { surfaceId, components: nodes } },
    ],
    issues,
  }
}

/* --------------------------- prompt for models -------------------------- */

function typeOf(s: z.ZodType): string {
  const d = (
    s as unknown as {
      def: {
        type: string
        innerType?: z.ZodType
        element?: z.ZodType
        entries?: Record<string, string>
        options?: z.ZodType[]
      }
    }
  ).def
  switch (d.type) {
    case "optional":
    case "default":
    case "nullable":
      return typeOf(d.innerType!)
    case "string":
      return "string"
    case "number":
      return "number"
    case "boolean":
      return "boolean"
    case "enum":
      return Object.values(d.entries ?? {})
        .map((e) => JSON.stringify(e))
        .join(" | ")
    case "array":
      return `${typeOf(d.element!)}[]`
    case "union":
      return (d.options ?? []).map(typeOf).join(" | ")
    case "object":
      return "{…}"
    default:
      return "any"
  }
}

/** The catalog as OpenUI Lang signatures, for a system prompt. */
export function catalogToOpenUIPrompt(catalog: Catalog) {
  const lines = [
    "Respond with UI in OpenUI Lang: one statement per line, `name = Component(args)`; the entry is `root`.",
    "Arguments are positional, in the order below; use null to skip an optional one. Refer to other statements by name.",
    'Facts (counts, money, rates, dates) come from data: write @Path("/pointer"), never the number. Lists over data: @Each("/items", rowName, "id").',
    "Actions: @ActionName({context}) with the host's action names (snake_case is applied). Destructive ones only inside Confirmation or DecisionCard.",
    "Not supported: $variables, ternaries, operators, Query, Mutation, functions. No styling: only the enums listed.",
    "",
  ]
  for (const e of Object.values(catalog.components)) {
    const shape = (e.props as z.ZodObject).shape as Record<string, z.ZodType>
    const args = Object.entries(shape)
      .map(
        ([k, s]) =>
          `${k}${s.safeParse(undefined).success ? "?" : ""}: ${e.facts?.includes(k) ? "@Path" : typeOf(s)}`
      )
      .join(", ")
    lines.push(`${e.name}(${args}) — ${e.description}`)
  }
  return lines.join("\n")
}
