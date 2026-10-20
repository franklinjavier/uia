import * as React from "react"
import { motion } from "motion/react"
import { CircleAlertIcon, RotateCcwIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { enter } from "@/lib/motion"
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert"
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

// The shadcn Alert (destructive), restyled to one quiet line: no border, a
// 6% wash, the message at full strength and the retry inline at the end
// instead of pinned to the corner.
const MotionAlert = motion.create(Alert)

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
    <MotionAlert
      data-slot="chat-error"
      variant="destructive"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={enter}
      className={cn(
        "flex min-h-10 items-center gap-2.5 rounded-xl border-0 bg-destructive/[0.06] py-1.5 pr-1.5 pl-3 has-data-[slot=alert-action]:pr-1.5 *:data-[slot=alert-description]:text-current *:[svg]:translate-y-0",
        className
      )}
    >
      <CircleAlertIcon className="size-4 shrink-0" />
      <AlertDescription className="min-w-0 flex-1 text-pretty">
        {message}
      </AlertDescription>
      {onRetry && (
        <AlertAction className="static shrink-0">
          <Button
            size="xs"
            variant="ghost"
            className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onRetry}
          >
            <RotateCcwIcon />
            {retryLabel}
          </Button>
        </AlertAction>
      )}
    </MotionAlert>
  )
}

export { ChatError }
