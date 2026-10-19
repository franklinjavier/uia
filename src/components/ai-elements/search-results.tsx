import * as React from "react"

import { cn } from "@/lib/utils"
import { hostname } from "@/lib/url"

export type SearchResult = { title: string; url: string }

// Everything a search returned, as a compact list (title · domain). Meant to
// sit inside an expandable ToolLine; the SourcesGrid below an answer shows
// only what was cited.
export function SearchResults({
  query,
  results,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "results"> & { query?: string; results: SearchResult[] }) {
  return (
    <div data-slot="search-results" className={cn("flex flex-col gap-1.5", className)} {...props}>
      {query && <span className="eyebrow text-faint-foreground">“{query}”</span>}
      <ul className="flex flex-col gap-1">
        {results.map((r) => (
          <li key={r.url}>
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-baseline gap-2 rounded-md transition-colors hover:text-foreground"
            >
              <span className="truncate text-foreground/90">{r.title}</span>
              <span className="shrink-0 text-xs text-faint-foreground">{hostname(r.url)}</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
