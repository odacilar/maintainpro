"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type Theme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

const CYCLE: Theme[] = ["light", "dark", "system"];

const labels: Record<Theme, string> = {
  light: "Açık tema",
  dark: "Koyu tema",
  system: "Sistem teması",
};

const icons: Record<Theme, React.ElementType> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  function cycleTheme() {
    const currentIndex = CYCLE.indexOf(theme);
    const nextIndex = (currentIndex + 1) % CYCLE.length;
    setTheme(CYCLE[nextIndex]);
  }

  const Icon = icons[theme];
  const label = labels[theme];

  return (
    <button
      onClick={cycleTheme}
      title={label}
      aria-label={label}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted transition-colors",
        className
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
