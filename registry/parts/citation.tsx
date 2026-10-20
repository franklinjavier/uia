import * as React from "react"
import { motion } from "motion/react"
import { ArrowUpRightIcon } from "lucide-react"

import { enter } from "@/lib/motion"
import { cn } from "@/lib/utils"

// Citation: the evidence behind a claim — the passage itself, where it
// came from, and where in it, so the person can check without opening
// anything. The source's host is the eyebrow (what kind of place said
// it), the reference ("P. 12", "L. 40", "03:12") sits right in mono, the
// quote is the body, and the source's name links out at the foot. Use one
// per claim the answer leans on; for a list of links, use Sources.
//
//   <Citation source="Q3 board deck" url="https://drive.example.com/q3.pdf" ref="P. 12"
//     quote="Two enterprise renewals slipped to Q4 pending security review." />

/** The host of an http(s) URL, without "www."; undefined for anything else. */
function hostOf(url: string | undefined) {
  if (!url) return undefined
  try {
    const u = new URL(url)
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined
    return u.hostname.replace(/^www\./, "")
  } catch {
    return undefined
  }
}

function Citation({
  source,
  url,
  quote,
  reference,
  className,
}: {
  /** The source's name ("Q3 board deck", "RFC 9110"). */
  source: React.ReactNode
  /** http(s) only; anything else isn't linked. */
  url?: string
  quote: React.ReactNode
  /** Where in the source: page, line, timestamp. */
  reference?: string
  className?: string
}) {
  const host = hostOf(url)
  return (
    <motion.figure
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={enter}
      data-slot="citation"
      className={cn(
        "not-typeset flex flex-col gap-2 rounded-2xl border border-border/80 bg-card p-4 text-sm shadow-xs",
        className
      )}
    >
      <div className="flex items-baseline gap-3">
        <span className="min-w-0 truncate eyebrow text-muted-foreground">
          {host ?? source}
        </span>
        {reference && (
          <span className="ml-auto shrink-0 eyebrow text-faint-foreground tabular-nums">
            {reference}
          </span>
        )}
      </div>
      <blockquote className="text-pretty">“{quote}”</blockquote>
      {host && (
        <figcaption>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="group/cite flex w-fit max-w-full items-center gap-1 text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
          >
            <span className="truncate">{source}</span>
            <ArrowUpRightIcon className="size-3.5 shrink-0" />
          </a>
        </figcaption>
      )}
    </motion.figure>
  )
}

export { Citation }
