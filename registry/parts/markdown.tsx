import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"
import { MarkdownPre } from "@/components/markdown-code"

// Assistant prose. Typeset owns the rhythm; fenced code goes to Code Block.
export function Markdown({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <div data-slot="markdown" className={cn("typeset typeset-chat", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: MarkdownPre }}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
