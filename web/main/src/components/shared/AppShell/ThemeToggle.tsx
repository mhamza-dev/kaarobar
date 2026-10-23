"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/**
 * Light/dark switch for the header. Both icons render and CSS shows the
 * right one, so the button never flashes the wrong icon before next-themes
 * has read the stored choice.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="text-muted-foreground hover:text-foreground"
    >
      <Moon className="size-[1.125rem] dark:hidden" />
      <Sun className="hidden size-[1.125rem] dark:block" />
    </Button>
  );
}
