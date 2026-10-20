import * as React from "react"
import { SparklesIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentTitle,
} from "@/components/ui/attachment"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

// Attachments: files the person hands the agent.
//
//   <AttachmentChip name="q3-board-deck.pdf" />                 on a sent message
//   <AttachmentChip name="…" onRemove={…} />                    in the composer
//   <AttachmentChip name="…" state="uploading" />               idle · uploading · processing · error · done
//   <AttachmentPreview file={{ name, meta: "PDF · 4.2 MB · 24 pages", summary }}>
//     <AttachmentChip name="…" />
//   </AttachmentPreview>                                        hover for the gist
//
// The type badge is the only colour: a small square with the extension, so
// a PDF, a sheet and an image read apart at a glance.

const KIND: Record<string, string> = {
  pdf: "bg-destructive text-background",
  doc: "bg-chart-1 text-background",
  docx: "bg-chart-1 text-background",
  csv: "bg-success text-background",
  xlsx: "bg-success text-background",
  png: "bg-foreground/70 text-background",
  jpg: "bg-foreground/70 text-background",
}

function ext(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? ""
}

function FileBadge({ name, className }: { name: string; className?: string }) {
  const e = ext(name)
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-4 min-w-4 shrink-0 items-center justify-center rounded-[5px] px-0.5 font-mono text-[8px] leading-none font-medium uppercase",
        KIND[e] ?? "bg-muted-foreground text-background",
        className
      )}
    >
      {e.slice(0, 3)}
    </span>
  )
}

function AttachmentChip({
  name,
  onRemove,
  state = "done",
  className,
  ...props
}: Omit<React.ComponentProps<typeof Attachment>, "size" | "orientation"> & {
  name: string
  onRemove?: () => void
}) {
  // shadcn's Attachment, pressed into a pill: one line, type badge + name.
  // `state` drives it: idle is dashed, uploading/processing shimmer the
  // name, error turns the border destructive.
  return (
    <Attachment
      data-slot="attachment-chip"
      state={state}
      size="xs"
      className={cn(
        "inline-flex h-7 max-w-full min-w-0 shrink flex-nowrap items-center gap-1.5 rounded-full border-border pr-2.5 pl-1.5 shadow-xs focus-within:ring-0",
        onRemove && "pr-1",
        className
      )}
      {...props}
    >
      <FileBadge name={name} />
      <AttachmentTitle className="font-normal">{name}</AttachmentTitle>
      {onRemove && (
        <AttachmentActions>
          <AttachmentAction
            type="button"
            aria-label={`Remove ${name}`}
            onClick={onRemove}
            className="size-5 rounded-full text-muted-foreground focus-visible:border-transparent active:not-aria-[haspopup]:translate-y-0 dark:hover:bg-muted"
          >
            <XIcon className="size-3" />
          </AttachmentAction>
        </AttachmentActions>
      )}
    </Attachment>
  )
}

export type AttachmentFile = {
  name: string
  /** One eyebrow line: type, size, length. "PDF · 4.2 MB · 24 pages". */
  meta?: string
  /** What's in it, in two or three lines, written by the agent. */
  summary?: string
}

/** Hover a chip (tap on touch) to see what the file is and what's in it. */
function AttachmentPreview({
  file,
  children,
}: {
  file: AttachmentFile
  children: React.ReactElement
}) {
  // Hover opens it on a mouse; a tap opens and closes it on touch (a
  // preview card alone never opens there), and tapping outside dismisses.
  const [open, setOpen] = React.useState(false)
  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger
        delay={250}
        onClick={(e) => {
          e.preventDefault()
          // A mouse already opened it on hover; clicking shouldn't close it.
          if ((e.nativeEvent as PointerEvent).pointerType === "mouse")
            return setOpen(true)
          setOpen((o) => !o)
        }}
        render={
          <span
            tabIndex={0}
            role="button"
            aria-expanded={open}
            className="inline-flex max-w-full cursor-pointer rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        }
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="end"
        sideOffset={6}
        alignOffset={0}
        data-slot="attachment-preview"
        className="rounded-2xl border border-border p-3 ring-0 transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 dark:ring-0 data-open:animate-none data-closed:animate-none"
      >
        <div className="flex items-center gap-2">
          <FileBadge name={file.name} />
          <span className="min-w-0 truncate font-medium">{file.name}</span>
        </div>
        {file.meta && (
          <div className="mt-1 eyebrow text-muted-foreground">{file.meta}</div>
        )}
        {file.summary && (
          <div className="mt-2.5 rounded-xl bg-muted/50 p-2.5">
            <div className="flex items-center gap-1.5 eyebrow text-muted-foreground">
              <SparklesIcon className="size-3" />
              Summary
            </div>
            <p className="mt-1 text-xs leading-relaxed text-pretty text-muted-foreground">
              {file.summary}
            </p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}

export { AttachmentChip, AttachmentPreview, FileBadge }
