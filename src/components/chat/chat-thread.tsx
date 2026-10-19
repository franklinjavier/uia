import * as React from "react"
import type { UIMessage } from "ai"

import { cn } from "@/lib/utils"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"

// The scrolling transcript: follows the stream while you are at the bottom,
// anchors each new user turn near the top, offers "jump to latest".
//
//   <ChatThread busy={busy}>
//     {messages.map((m, i) => (
//       <ChatThreadItem key={i} message={m}><ChatTurn … /></ChatThreadItem>
//     ))}
//   </ChatThread>

function ChatThread({
  busy,
  className,
  children,
  ...props
}: React.ComponentProps<typeof MessageScrollerContent> & { busy?: boolean }) {
  return (
    <MessageScrollerProvider autoScroll>
      <MessageScroller data-slot="chat-thread">
        <MessageScrollerViewport>
          <MessageScrollerContent
            aria-busy={busy}
            className={cn("gap-7 px-5 py-6", className)}
            {...props}
          >
            {children}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

function ChatThreadItem({
  message,
  ...props
}: Omit<React.ComponentProps<typeof MessageScrollerItem>, "messageId"> & {
  message: UIMessage
}) {
  return (
    <MessageScrollerItem
      data-slot="chat-thread-item"
      messageId={message.id}
      scrollAnchor={message.role === "user"}
      {...props}
    />
  )
}

export { ChatThread, ChatThreadItem }
