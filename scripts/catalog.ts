/**
 * Publishes the uia catalog for agents: the JSON Schema of every entry
 * (public/catalog/v1.json, served at the catalog's id) and the prompt text
 * (public/catalog/v1.txt). Both come from the Zod schemas in
 * registry/catalog, the same ones the renderer validates with.
 *
 *   bun scripts/catalog.ts
 */
import { mkdirSync, writeFileSync } from "node:fs"

import { uiaCatalog } from "../registry/catalog/index"
import {
  catalogToJSONSchema,
  catalogToPrompt,
} from "../registry/surface/catalog"

mkdirSync("public/catalog", { recursive: true })
writeFileSync(
  "public/catalog/v1.json",
  JSON.stringify(catalogToJSONSchema(uiaCatalog), null, 2) + "\n"
)
writeFileSync("public/catalog/v1.txt", catalogToPrompt(uiaCatalog) + "\n")
console.log(
  `catalog: ${Object.keys(uiaCatalog.components).length} components → public/catalog/v1.{json,txt}`
)
