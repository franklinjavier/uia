import * as React from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { easeOut } from "@/lib/motion"
import { hostname } from "@/lib/url"

export type SourceItem = { url: string; title?: string }

const TONES = [
  "bg-chart-1/10 text-chart-1",
  "bg-chart-2/10 text-chart-2",
  "bg-chart-5/10 text-chart-5",
  "bg-chart-3/10 text-chart-3",
]


// Sources as a 2-up grid of cards: initials tile, title, domain, index.
export function SourcesGrid({
  sources,
  className,
  ...props
}: React.ComponentProps<"div"> & { sources: SourceItem[] }) {
  if (!sources.length) return null

  return (
    <div
      data-slot="sources-grid"
      className={cn("not-typeset grid grid-cols-2 gap-1.5", className)}
      {...props}
    >
      {sources.map((source, i) => {
        const host = hostname(source.url)
        return (
          <motion.a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...easeOut, delay: i * 0.05 }}
            className="flex min-w-0 items-center gap-2.5 rounded-xl bg-card px-2.5 py-2 border border-border transition-colors hover:bg-muted"
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-medium uppercase",
                TONES[i % TONES.length]
              )}
            >
              {host.slice(0, 2)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] leading-5">{source.title ?? host}</span>
              <span className="truncate text-xs text-muted-foreground">{host}</span>
            </span>
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{i + 1}</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </motion.a>
        )
      })}
    </div>
  )
}
