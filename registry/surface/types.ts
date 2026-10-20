// A2UI v0.9 messages, as uia speaks them. An agent describes a *surface*
// (a screen, or a block inside a chat reply) with four kinds of message:
//
//   createSurface     a new surface, and which catalog it uses
//   updateComponents  components, as a flat list keyed by id; children are
//                     referenced by id ("root" is where rendering starts)
//   updateDataModel   the data, set at a JSON Pointer path
//   deleteSurface     remove it
//
// Props are either a literal or a binding into the data model:
// `{ "path": "/spend/total" }`. Actions are named events, never code:
// `{ "event": { "name": "raise_limit", "context": { "limit": 500 } } }`.
// Spec: https://a2ui.org/specification/v0.9-a2ui/

export type DataPath = { path: string }
export type Dynamic<T> = T | DataPath

export type ComponentNode = {
  id: string
  component: string
  [prop: string]: unknown
}

export type CreateSurface = {
  surfaceId: string
  catalogId: string
  theme?: Record<string, unknown>
}
export type UpdateComponents = {
  surfaceId: string
  components: ComponentNode[]
}
export type UpdateDataModel = {
  surfaceId: string
  path?: string
  value?: unknown
}
export type DeleteSurface = { surfaceId: string }

export type SurfaceMessage =
  | { version?: "v0.9"; createSurface: CreateSurface }
  | { version?: "v0.9"; updateComponents: UpdateComponents }
  | { version?: "v0.9"; updateDataModel: UpdateDataModel }
  | { version?: "v0.9"; deleteSurface: DeleteSurface }

/** An action as the agent writes it on a component. */
export type ActionSpec = {
  event: { name: string; context?: Record<string, unknown> }
}

/** What the host receives when the person triggers an action. */
export type SurfaceAction = {
  name: string
  surfaceId: string
  sourceComponentId: string
  /** The action's context with every binding resolved to its current value. */
  context: Record<string, unknown>
  timestamp: string
}

export type IssueCode =
  | "UNKNOWN_COMPONENT"
  | "VALIDATION_FAILED"
  | "LIMIT_EXCEEDED"
  /** A fact (count, rate, money) written as a literal instead of bound to data. */
  | "UNBOUND_FACT"
  /** An event the host didn't register. */
  | "UNKNOWN_ACTION"
  /** A destructive event on a plain control, outside a confirmation. */
  | "UNCONFIRMED_DESTRUCTIVE"
  /** A composition rule: one primary, one Note per Section, layout limits. */
  | "COMPOSITION"

/** A node the renderer couldn't draw, reported so the agent can fix it. */
export type SurfaceIssue = {
  surfaceId: string
  componentId: string
  code: IssueCode
  message: string
}

export type SurfaceState = {
  id: string
  catalogId: string
  components: Record<string, ComponentNode>
  data: unknown
}
