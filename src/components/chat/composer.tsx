import * as React from "react"
import { ArrowUpIcon, MicIcon, PlusIcon, SquareIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// The prompt box, as parts:
//
//   <Composer onSubmit={send}>
//     <ComposerInput placeholder="Ask anything…" />
//     <ComposerToolbar>
//       <ComposerAttach />
//       <ComposerModelSelect models={…} value={…} onValueChange={…} />
//       <ComposerMic className="ml-auto" />
//       <ComposerSubmit busy={busy} disabled={!canSend} onStop={stop} />
//     </ComposerToolbar>
//   </Composer>
//
// Enter submits, Shift+Enter breaks the line, IME composition is respected.

const ComposerContext = React.createContext<{ submit: () => void }>({ submit: () => {} })

function Composer({
  onSubmit,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & { onSubmit: () => void }) {
  return (
    <ComposerContext.Provider value={{ submit: onSubmit }}>
      <form
        data-slot="composer"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        className={className}
        {...props}
      >
        <InputGroup className="rounded-2xl border-0 bg-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-0">
          {children}
        </InputGroup>
      </form>
    </ComposerContext.Provider>
  )
}

function ComposerInput({
  className,
  onKeyDown,
  ...props
}: React.ComponentProps<typeof InputGroupTextarea>) {
  const { submit } = React.useContext(ComposerContext)
  return (
    <InputGroupTextarea
      data-slot="composer-input"
      className={cn("min-h-14 px-4 pt-3.5 text-sm", className)}
      onKeyDown={(e) => {
        onKeyDown?.(e)
        if (e.defaultPrevented) return
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault()
          submit()
        }
      }}
      {...props}
    />
  )
}

function ComposerToolbar({ className, ...props }: React.ComponentProps<typeof InputGroupAddon>) {
  return (
    <InputGroupAddon
      data-slot="composer-toolbar"
      align="block-end"
      className={cn("gap-1.5 px-3 pb-3", className)}
      {...props}
    />
  )
}

function ComposerButton({ className, ...props }: React.ComponentProps<typeof InputGroupButton>) {
  return (
    <InputGroupButton
      type="button"
      size="icon-sm"
      className={cn("rounded-full", className)}
      {...props}
    />
  )
}

function ComposerAttach(props: React.ComponentProps<typeof InputGroupButton>) {
  return (
    <ComposerButton data-slot="composer-attach" variant="outline" aria-label="Add files" {...props}>
      <PlusIcon />
    </ComposerButton>
  )
}

function ComposerMic({ className, ...props }: React.ComponentProps<typeof InputGroupButton>) {
  return (
    <ComposerButton
      data-slot="composer-mic"
      variant="ghost"
      aria-label="Dictate"
      className={cn("text-muted-foreground", className)}
      {...props}
    >
      <MicIcon />
    </ComposerButton>
  )
}

/** Send, or Stop while a reply streams. */
function ComposerSubmit({
  busy = false,
  onStop,
  disabled,
  className,
}: {
  busy?: boolean
  onStop?: () => void
  disabled?: boolean
  className?: string
}) {
  if (busy) {
    return (
      <ComposerButton
        data-slot="composer-stop"
        variant="default"
        aria-label="Stop generating"
        className={cn("relative", className)}
        onClick={onStop}
      >
        <span className="absolute -inset-1 animate-spin-slow rounded-full border border-dashed border-brand" />
        <SquareIcon className="size-3 fill-current" />
      </ComposerButton>
    )
  }
  return (
    <ComposerButton
      data-slot="composer-submit"
      type="submit"
      variant="default"
      aria-label="Send message"
      disabled={disabled}
      className={className}
    >
      <ArrowUpIcon />
    </ComposerButton>
  )
}

export type ComposerModel = { name: string; provider?: string; icon?: React.ReactNode }

/** Model picker: icon + name in the trigger, provider in mono on each option. */
function ComposerModelSelect<K extends string>({
  models,
  value,
  onValueChange,
  className,
}: {
  models: Record<K, ComposerModel>
  value: K
  onValueChange: (value: K) => void
  className?: string
}) {
  const keys = Object.keys(models) as K[]
  return (
    <Select value={value} onValueChange={(v) => v && onValueChange(v as K)}>
      <SelectTrigger
        data-slot="composer-model"
        aria-label="Model"
        className={cn("rounded-full shadow-none", className)}
      >
        <SelectValue>
          {(v: K) => (
            <>
              {models[v]?.icon}
              {models[v]?.name}
            </>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} className="min-w-48">
        {keys.map((key) => (
          <SelectItem key={key} value={key}>
            {models[key].icon}
            <span className="flex-1">{models[key].name}</span>
            {models[key].provider && (
              <span className="eyebrow text-faint-foreground">{models[key].provider}</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export {
  Composer,
  ComposerAttach,
  ComposerButton,
  ComposerInput,
  ComposerMic,
  ComposerModelSelect,
  ComposerSubmit,
  ComposerToolbar,
}
