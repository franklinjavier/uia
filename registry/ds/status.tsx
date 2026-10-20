import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

// Colour is reserved for state. A tone names the state, never a hue.
const toneText = {
  neutral: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  destructive: "text-destructive",
  brand: "text-brand",
  attention: "text-attention",
} as const

type Tone = keyof typeof toneText

function StatusDot({
  tone = "neutral",
  pulse = false,
  className,
  ...props
}: React.ComponentProps<"span"> & { tone?: Tone; pulse?: boolean }) {
  return (
    <span
      data-slot="status-dot"
      className={cn(
        "relative inline-flex size-1.5 shrink-0 rounded-full bg-current",
        toneText[tone],
        className
      )}
      {...props}
    >
      {pulse && (
        <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60" />
      )}
    </span>
  )
}

// StatusBadge is the shadcn Badge (outline) with a tone layer on top: an
// eyebrow label, a hairline in the tone and a 10% wash. `statusBadgeVariants`
// is that tone layer, merged over `badgeVariants` by Badge's own `cn`.
const statusBadgeVariants = cva(
  // Badge ships text-xs/font-medium, a transparent 1px border and gap-1; the
  // eyebrow is 11px/16px regular, so restate those (cn can't see inside the
  // custom `eyebrow` utility) and take the border out of the padding.
  "gap-1.5 rounded-full px-1.75 eyebrow text-[11px]/4 font-normal",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        success: "border-success/20 bg-success/10 text-success",
        warning: "border-warning/25 bg-warning/10 text-warning",
        info: "border-info/20 bg-info/10 text-info",
        destructive: "border-destructive/20 bg-destructive/10 text-destructive",
        brand: "border-brand/25 bg-brand/10 text-brand",
        attention: "border-attention/25 bg-attention/10 text-attention",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
)

function StatusBadge({
  tone = "neutral",
  dot = true,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Badge> &
  VariantProps<typeof statusBadgeVariants> & { dot?: boolean }) {
  return (
    <Badge
      data-slot="status-badge"
      variant="outline"
      className={cn(statusBadgeVariants({ tone }), className)}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </Badge>
  )
}

export { StatusBadge, StatusDot, statusBadgeVariants, type Tone }
