// Numbers are formatted by the renderer, never by the agent: a component
// takes the raw value and a `format`, the surface supplies locale and
// currency. "1287.4" + "currency" → "$1,287" (en-US) or "R$ 1.287" (pt-BR).

export type ValueFormat =
  | "number"
  | "integer"
  | "currency"
  | "percent"
  | "compact"
  | "duration"
  | "date"
  | "text"

export type FormatOptions = { locale?: string; currency?: string }

export function formatValue(
  value: unknown,
  format: ValueFormat = "text",
  { locale = "en-US", currency = "USD" }: FormatOptions = {}
): string {
  if (value == null) return ""
  if (format === "text" || (typeof value === "string" && format !== "date"))
    return String(value)
  if (format === "date") {
    const d = new Date(value as string | number)
    return Number.isNaN(d.getTime())
      ? String(value)
      : d.toLocaleDateString(locale, { month: "short", day: "numeric" })
  }
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  switch (format) {
    case "integer":
      return Math.round(n).toLocaleString(locale)
    case "currency":
      return n.toLocaleString(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0,
      })
    case "percent":
      return n.toLocaleString(locale, {
        style: "percent",
        maximumFractionDigits: 1,
      })
    case "compact":
      return n.toLocaleString(locale, {
        notation: "compact",
        maximumFractionDigits: 1,
      })
    case "duration": {
      if (n < 60) return `${Math.round(n)} s`
      if (n < 3600) return `${Math.round(n / 60)} min`
      return `${(n / 3600).toFixed(1)} h`
    }
    default:
      return n.toLocaleString(locale, { maximumFractionDigits: 2 })
  }
}
