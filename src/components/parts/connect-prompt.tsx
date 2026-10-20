import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { enter } from "@/lib/motion"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

// ConnectPrompt: the agent needs access it doesn't have yet (Slack, a
// calendar, a repo). It docks right above the composer — where the person's
// hands are — instead of as a card mid-transcript, says what the access is
// for, and walks ask → connecting → connected in place. Once connected it
// says what happens next, then the host removes it.
//
//   <ConnectPrompt
//     app="Slack" icon={<SlackIcon />}
//     reason="Connect Slack to post the digest"
//     state={state}  // "ask" | "connecting" | "connected" | "failed"
//     done="Slack connected · first digest Monday 09:00"
//     onConnect={connect}
//   />

export type ConnectState = "ask" | "connecting" | "connected" | "failed"

function ConnectPrompt({
  app,
  icon,
  reason,
  state,
  done,
  onConnect,
  className,
}: {
  app: string
  icon?: React.ReactNode
  /** What the access is for, as one sentence. */
  reason: string
  state: ConnectState
  /** What happens now that it's connected. */
  done?: string
  onConnect: () => void
  className?: string
}) {
  const connected = state === "connected"
  return (
    <motion.div
      data-slot="connect-prompt"
      data-state={state}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={enter}
      className={cn(
        "flex min-h-11 items-center gap-2.5 rounded-2xl border px-3 py-1.5 text-sm shadow-xs transition-colors duration-300 [&_svg]:size-4 [&_svg]:shrink-0",
        connected ? "border-success/25 bg-success/10 text-success" : "border-border bg-card",
        className
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={connected ? "done" : "ask"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={enter}
          className="flex min-w-0 flex-1 items-center gap-2.5"
        >
          {connected ? <CheckIcon /> : icon}
          <span className="min-w-0 truncate">
            {connected
              ? done ?? `${app} connected`
              : state === "failed"
                ? `Couldn't connect ${app}. Try again?`
                : reason}
          </span>
        </motion.span>
      </AnimatePresence>
      {!connected && (
        <Button
          size="xs"
          className="shrink-0 rounded-full"
          disabled={state === "connecting"}
          onClick={onConnect}
        >
          {state === "connecting" ? (
            <>
              <Spinner className="size-3" />
              Connecting
            </>
          ) : state === "failed" ? (
            "Retry"
          ) : (
            "Connect"
          )}
        </Button>
      )}
    </motion.div>
  )
}

export { ConnectPrompt }
