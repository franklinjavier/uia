import * as React from "react"
import { CheckIcon, CopyIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MessageFooter } from "@/components/ui/message"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// The quiet row under a finished assistant turn. Use <TurnActions> for the
// default set (copy, good, bad) or compose your own row from <TurnAction>.

function TurnAction({
  label,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            data-slot="turn-action"
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            className={cn("text-muted-foreground aria-pressed:text-foreground", className)}
            {...props}
          />
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function TurnActionsRow({ className, ...props }: React.ComponentProps<typeof MessageFooter>) {
  return (
    <MessageFooter
      data-slot="turn-actions"
      className={cn("-ml-1.5 gap-0.5 px-0", className)}
      {...props}
    />
  )
}

function TurnActions({
  text,
  onVote,
  children,
  className,
}: {
  /** What Copy puts on the clipboard. */
  text: string
  onVote?: (vote: "up" | "down" | null) => void
  /** Extra actions appended after the defaults. */
  children?: React.ReactNode
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)
  const [vote, setVote] = React.useState<"up" | "down" | null>(null)

  React.useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(t)
  }, [copied])

  const cast = (v: "up" | "down") => {
    const next = vote === v ? null : v
    setVote(next)
    onVote?.(next)
  }

  return (
    <TurnActionsRow className={className}>
      <TurnAction
        label={copied ? "Copied" : "Copy"}
        onClick={() =>
          navigator.clipboard
            ?.writeText(text)
            .then(() => setCopied(true))
            .catch(() => {})
        }
      >
        {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
      </TurnAction>
      <TurnAction label="Good response" aria-pressed={vote === "up"} onClick={() => cast("up")}>
        <ThumbsUpIcon />
      </TurnAction>
      <TurnAction label="Bad response" aria-pressed={vote === "down"} onClick={() => cast("down")}>
        <ThumbsDownIcon />
      </TurnAction>
      {children}
    </TurnActionsRow>
  )
}

export { TurnAction, TurnActions, TurnActionsRow }
