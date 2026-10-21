import * as React from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { enter } from "@/lib/motion"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { AgentOrb } from "@/components/ds/agent-orb"

// The first screen of a conversation: the resting orb, a greeting, and
// suggestions to start from — a short list of rows, one task per row, that
// arrives one row after another.
//
//   <ChatEmpty title="Good evening" description="What are we working on?">
//     <ChatSuggestion icon={<GlobeIcon />} onClick={…}>What shipped?</ChatSuggestion>
//   </ChatEmpty>

function ChatEmpty({
  title,
  description,
  size = "default",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Empty>, "title"> & {
  title: React.ReactNode
  description?: React.ReactNode
  size?: "default" | "lg"
}) {
  const reduced = useReducedMotion()
  return (
    <Empty data-slot="chat-empty" className={cn("h-full gap-6 p-6", className)} {...props}>
      <EmptyHeader>
        <EmptyMedia>
          <AgentOrb size={64} phase="idle" />
        </EmptyMedia>
        <EmptyTitle
          className={cn("font-normal tracking-[-0.01em]", size === "lg" ? "text-2xl" : "text-xl")}
        >
          {title}
        </EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {children && (
        <EmptyContent className="max-w-md gap-0 divide-y divide-border/60">
          {React.Children.map(children, (child, i) =>
            child ? (
              <motion.div
                className="w-full"
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...enter, delay: 0.2 + i * 0.045 }}
              >
                {child}
              </motion.div>
            ) : null
          )}
        </EmptyContent>
      )}
    </Empty>
  )
}

function ChatSuggestion({
  icon,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { icon?: React.ReactNode }) {
  return (
    <Button
      data-slot="chat-suggestion"
      variant="ghost"
      className={cn(
        "h-11 w-full justify-start gap-3 rounded-none px-1 text-left font-normal hover:bg-transparent hover:text-foreground [&>svg:first-child]:text-muted-foreground",
        "text-foreground/80",
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </Button>
  )
}

export { ChatEmpty, ChatSuggestion }
