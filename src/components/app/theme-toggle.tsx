import { MoonIcon, SunIcon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"

// ThemeToggle: every app carries its own (foot of the side nav, header on
// phones). A ghost icon button: sun in dark, moon in light.
function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      className={className ?? "text-muted-foreground"}
      aria-label={dark ? "Light theme" : "Dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}

export { ThemeToggle }
