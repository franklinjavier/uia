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

// Turns that mount after the thread has settled are new (you just sent it,
// the agent just answered): they animate in. The history a thread opens
// with just appears, unless it is only the first exchange. Outside a
// ChatThread, turns always animate.
const ThreadSettled = React.createContext<{ current: boolean }>({ current: true })

/** Whether this turn arrived live and should play its entrance. */
function useTurnEnters() {
  const settled = React.useContext(ThreadSettled)
  return React.useState(() => settled.current)[0]
}

function ChatThread({
  busy,
  className,
  children,
  ...props
}: React.ComponentProps<typeof MessageScrollerContent> & { busy?: boolean }) {
  // A thread that opens on the first exchange (empty state → first send)
  // is live from the start; one that opens on a longer history is not.
  const settled = React.useRef(React.Children.count(children) <= 2)
  React.useEffect(() => {
    settled.current = true
  }, [])
  return (
    <ThreadSettled.Provider value={settled}>
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
          {/* Phones: bottom-right, so it never sits on a card's buttons. */}
          <MessageScrollerButton className="shadow-sm max-sm:inset-s-auto max-sm:right-3 max-sm:translate-x-0" />
        </MessageScroller>
      </MessageScrollerProvider>
    </ThreadSettled.Provider>
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

export { ChatThread, ChatThreadItem, useTurnEnters }
