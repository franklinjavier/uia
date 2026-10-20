import type { UIMessage } from "ai"

export { createChat } from "@shadcn/helpers/ai-sdk"

/** Plain text of a message, joining its text parts. */
export function getMessageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
}
