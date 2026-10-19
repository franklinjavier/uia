import { cn } from "cn"

// uia: thin arc instead of lucide's loader. Inherits colour (currentColor).
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      viewBox="0 0 16 16"
      fill="none"
      className={cn("size-4 shrink-0 animate-spin", className)}
      {...props}
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
      <path d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export { Spinner }
