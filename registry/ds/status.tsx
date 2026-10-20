import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

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

const statusBadgeVariants = cva(
  "eyebrow inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 whitespace-nowrap ring-1 ring-inset",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground ring-border",
        success: "bg-success/10 text-success ring-success/20",
        warning: "bg-warning/10 text-warning ring-warning/25",
        info: "bg-info/10 text-info ring-info/20",
        destructive: "bg-destructive/10 text-destructive ring-destructive/20",
        brand: "bg-brand/10 text-brand ring-brand/25",
        attention: "bg-attention/10 text-attention ring-attention/25",
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
}: React.ComponentProps<"span"> &
  VariantProps<typeof statusBadgeVariants> & { dot?: boolean }) {
  return (
    <span
      data-slot="status-badge"
      className={cn(statusBadgeVariants({ tone }), className)}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export { StatusBadge, StatusDot, statusBadgeVariants, type Tone }
