"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

/**
 * Compact, mobile-first map controls for the taxi experience: a theme toggle
 * only. Styled to match the dark/amber taxi UI.
 * It stays at the top so it does not conflict with the taxi bottom sheet.
 */
export function TaxiMapControls() {
  const { theme, toggleTheme, mounted } = useTheme();

  return (
    <div className="pointer-events-auto absolute right-8 top-[max(0.75rem,env(safe-area-inset-top))] z-[1000] sm:right-3 safe-bottom">
      <button
        type="button"
        onClick={toggleTheme}
        disabled={!mounted}
        aria-label={
          theme === "dark" ? "Switch to light map" : "Switch to dark map"
        }
        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-zinc-900/55 text-white/80 shadow-[0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur-2xl transition-all hover:bg-zinc-800/65 active:scale-95"
      >
        {mounted && theme === "dark" ? (
          <Sun className="h-4 w-4 text-amber-300" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
