import * as React from "react"

import { cn } from "@/lib/utils"
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
// suggestions to start from.
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
        <EmptyContent className="flex-row flex-wrap justify-center gap-2">{children}</EmptyContent>
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
      variant="outline"
      size="sm"
      className={cn("font-normal [&>svg:first-child]:text-muted-foreground", className)}
      {...props}
    >
      {icon}
      {children}
    </Button>
  )
}

export { ChatEmpty, ChatSuggestion }
