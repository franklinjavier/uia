import { defineCatalog } from "@/components/surface/catalog"
import { patterns } from "@/components/catalog/patterns"
import { data } from "@/components/catalog/data"
import { display } from "@/components/catalog/display"
import { input } from "@/components/catalog/input"
import { layout } from "@/components/catalog/layout"

// The uia catalog: what an agent may compose a surface from. Its id is the
// URL where its JSON Schema is published; agents name it in createSurface.
//
// Install only the groups you need, and add your own entries with
// `extendCatalog(uiaCatalog, [MyWidget])`.

export const UIA_CATALOG_ID =
  "https://uia.imfrank.dev/catalog/v1.json"

export const uiaCatalog = defineCatalog(UIA_CATALOG_ID, [
  ...layout,
  ...display,
  ...data,
  ...input,
  ...patterns,
])
