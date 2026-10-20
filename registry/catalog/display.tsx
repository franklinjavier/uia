import { z } from "zod"

import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/ds/status"
import { Markdown } from "@/components/parts/markdown"
import { defineComponent, tone } from "@/components/surface/catalog"

// Display: words. Hierarchy by size and colour, never bold; one quiet line
// for a note, a badge only for state.

const BADGE_TONE = {
  neutral: "neutral",
  success: "success",
  warning: "warning",
  destructive: "destructive",
  attention: "attention",
  info: "info",
} as const

export const Text = defineComponent({
  name: "Text",
  kind: "display",
  description:
    "Words. title: a heading; body; muted: secondary; eyebrow: a mono label; markdown: rich prose.",
  props: z.object({
    text: z.string(),
    variant: z
      .enum(["title", "body", "muted", "eyebrow", "markdown"])
      .optional(),
  }),
  render: (p) =>
    p.variant === "markdown" ? (
      <Markdown>{p.text}</Markdown>
    ) : (
      <p
        className={cn(
          "text-pretty",
          p.variant === "title" && "text-base tracking-[-0.011em]",
          (!p.variant || p.variant === "body") && "text-sm",
          p.variant === "muted" && "text-sm text-muted-foreground",
          p.variant === "eyebrow" && "eyebrow text-muted-foreground"
        )}
      >
        {p.text}
      </p>
    ),
})

export const Badge = defineComponent({
  name: "Badge",
  kind: "display",
  description:
    "A state, in one or two words (Healthy, 86% used, Over budget). Colour comes from tone.",
  props: z.object({ label: z.string(), tone: tone.optional() }),
  render: (p) => (
    <StatusBadge tone={BADGE_TONE[p.tone ?? "neutral"]}>{p.label}</StatusBadge>
  ),
})

export const Note = defineComponent({
  name: "Note",
  kind: "display",
  description:
    "An alert line: a state badge plus one sentence with new information (when, how much, what happens next). Not advice.",
  props: z.object({ tone, badge: z.string(), text: z.string() }),
  render: (p) => (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
      <StatusBadge tone={BADGE_TONE[p.tone]}>{p.badge}</StatusBadge>
      <span className="text-muted-foreground">{p.text}</span>
    </div>
  ),
})

export const Empty = defineComponent({
  name: "Empty",
  kind: "display",
  description: "Nothing here, said plainly in one line (and why, if it helps).",
  props: z.object({ title: z.string(), description: z.string().optional() }),
  render: (p) => (
    <div className="flex flex-col items-center gap-1 py-6 text-center">
      <span className="text-sm">{p.title}</span>
      {p.description && (
        <span className="text-sm text-muted-foreground">{p.description}</span>
      )}
    </div>
  ),
})

export const display = [Text, Badge, Note, Empty]
