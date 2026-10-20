import * as React from "react"

import type { SurfaceMessage, SurfaceState } from "@/components/surface/types"

// Surface state: apply A2UI messages, read values by JSON Pointer.
//
//   const store = createSurfaceStore()
//   store.process(messages)                 // as they arrive (stream them)
//   const surface = useSurface(store, "spend")
//
// Inside a chat reply you usually have the whole (or partial, streaming)
// message list in a tool part: `surfaceFromMessages(part.input.messages)`.

/* ---------------------------- JSON Pointer ---------------------------- */

function tokens(pointer: string): string[] {
  if (pointer === "" || pointer === "/") return []
  return pointer
    .replace(/^\//, "")
    .split("/")
    .map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"))
}

/** Join a relative path ("name") onto a base ("/models/2"). Absolute paths win. */
export function joinPath(base: string | undefined, path: string): string {
  if (path.startsWith("/") || !base)
    return path.startsWith("/") ? path : `/${path}`
  return `${base.replace(/\/$/, "")}/${path}`
}

export function getAt(data: unknown, pointer: string): unknown {
  let cur: unknown = data
  for (const t of tokens(pointer)) {
    if (cur == null || typeof cur !== "object") return undefined
    cur = (cur as Record<string, unknown>)[t]
  }
  return cur
}

/** Immutable set; `value === undefined` deletes the key. */
export function setAt(data: unknown, pointer: string, value: unknown): unknown {
  const ts = tokens(pointer)
  if (ts.length === 0) return value
  const [head, ...rest] = ts
  const base: Record<string, unknown> | unknown[] = Array.isArray(data)
    ? [...data]
    : data && typeof data === "object"
      ? { ...(data as Record<string, unknown>) }
      : /^\d+$/.test(head)
        ? []
        : {}
  const next = rest.length
    ? setAt(
        (base as Record<string, unknown>)[head],
        `/${rest.join("/")}`,
        value
      )
    : value
  if (next === undefined && !rest.length) {
    if (Array.isArray(base)) base.splice(Number(head), 1)
    else delete (base as Record<string, unknown>)[head]
  } else {
    ;(base as Record<string, unknown>)[head] = next
  }
  return base
}

/* ------------------------------- reduce ------------------------------- */

export function applyMessage(
  surfaces: Map<string, SurfaceState>,
  message: SurfaceMessage
) {
  if ("createSurface" in message && message.createSurface) {
    const { surfaceId, catalogId } = message.createSurface
    const prev = surfaces.get(surfaceId)
    surfaces.set(surfaceId, {
      id: surfaceId,
      catalogId,
      components: prev?.components ?? {},
      data: prev?.data ?? {},
    })
  } else if ("updateComponents" in message && message.updateComponents) {
    const { surfaceId, components } = message.updateComponents
    const prev = surfaces.get(surfaceId) ?? {
      id: surfaceId,
      catalogId: "",
      components: {},
      data: {},
    }
    const next = { ...prev.components }
    for (const c of components ?? [])
      if (c && typeof c.id === "string" && typeof c.component === "string")
        next[c.id] = c
    surfaces.set(surfaceId, { ...prev, components: next })
  } else if ("updateDataModel" in message && message.updateDataModel) {
    const { surfaceId, path = "/", value } = message.updateDataModel
    const prev = surfaces.get(surfaceId) ?? {
      id: surfaceId,
      catalogId: "",
      components: {},
      data: {},
    }
    surfaces.set(surfaceId, { ...prev, data: setAt(prev.data, path, value) })
  } else if ("deleteSurface" in message && message.deleteSurface) {
    surfaces.delete(message.deleteSurface.surfaceId)
  }
}

/** Build surfaces from a message list (whole or partial, e.g. a streaming tool input). */
export function surfacesFromMessages(messages: readonly unknown[] | undefined) {
  const surfaces = new Map<string, SurfaceState>()
  for (const m of messages ?? [])
    if (m && typeof m === "object") applyMessage(surfaces, m as SurfaceMessage)
  return surfaces
}

/** The first (usually only) surface in a message list. */
export function surfaceFromMessages(
  messages: readonly unknown[] | undefined
): SurfaceState | undefined {
  return surfacesFromMessages(messages).values().next().value
}

/* -------------------------------- store ------------------------------- */

export type SurfaceStore = ReturnType<typeof createSurfaceStore>

export function createSurfaceStore(initial?: readonly SurfaceMessage[]) {
  let surfaces = surfacesFromMessages(initial)
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())
  return {
    process(messages: SurfaceMessage | readonly SurfaceMessage[]) {
      const next = new Map(surfaces)
      for (const m of Array.isArray(messages) ? messages : [messages])
        applyMessage(next, m as SurfaceMessage)
      surfaces = next
      emit()
    },
    /** Two-way bindings (inputs) write here. */
    setData(surfaceId: string, path: string, value: unknown) {
      const s = surfaces.get(surfaceId)
      if (!s) return
      const next = new Map(surfaces)
      next.set(surfaceId, { ...s, data: setAt(s.data, path, value) })
      surfaces = next
      emit()
    },
    get: (id: string) => surfaces.get(id),
    all: () => surfaces,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function useSurface(store: SurfaceStore, surfaceId: string) {
  return React.useSyncExternalStore(store.subscribe, () => store.get(surfaceId))
}
