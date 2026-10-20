import * as React from "react"
import { motion } from "motion/react"
import { CircleAlertIcon, RotateCcwIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { enter } from "@/lib/motion"
import { Button } from "@/components/ui/button"

// ChatError: a turn that didn't happen. One quiet line where the answer
// would have been: what went wrong in the person's words, what it cost
// ("Nothing was sent"), and the one way forward. `retryLabel` can name a
// different route ("Retry with Nova Fast") when the same one would fail
// again. No red box, no stack trace.
//
//   {chat.error && (
//     <ChatError message="The model is over capacity right now. Nothing was sent."
//                onRetry={() => chat.regenerate()} />
//   )}

function ChatError({
  message,
  onRetry,
  retryLabel = "Retry",
  className,
}: {
  message: React.ReactNode
  onRetry?: () => void
  retryLabel?: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      data-slot="chat-error"
      role="alert"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={enter}
      className={cn(
        "flex min-h-10 items-center gap-2.5 rounded-xl bg-destructive/[0.06] py-1.5 pr-1.5 pl-3 text-sm text-destructive",
        className
      )}
    >
      <CircleAlertIcon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 text-pretty">{message}</span>
      {onRetry && (
        <Button
          size="xs"
          variant="ghost"
          className="shrink-0 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onRetry}
        >
          <RotateCcwIcon />
          {retryLabel}
        </Button>
      )}
    </motion.div>
  )
}

export { ChatError }
