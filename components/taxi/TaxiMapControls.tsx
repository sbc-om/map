"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Layers, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { TILE_PROVIDERS } from "@/constants/tile-providers";

/** Emoji + gradient swatch per provider, so the picker stays light-weight. */
const SWATCH: Record<string, { gradient: string; emoji: string }> = {
  osm: { gradient: "from-emerald-300 to-sky-400", emoji: "🗺️" },
  satellite: { gradient: "from-slate-700 to-emerald-900", emoji: "🛰️" },
  dark: { gradient: "from-zinc-800 to-zinc-950", emoji: "🌙" },
  light: { gradient: "from-slate-100 to-slate-300", emoji: "☀️" },
  terrain: { gradient: "from-lime-300 to-amber-400", emoji: "⛰️" },
  streets: { gradient: "from-violet-400 to-blue-500", emoji: "🏙️" },
};

interface TaxiMapControlsProps {
  currentProviderId: string;
  onProviderChange: (id: string) => void;
}

/**
 * Compact, mobile-first map controls for the taxi experience: a theme toggle
 * (light/dark) and a map-style picker. Styled to match the dark/amber taxi UI.
 * Anchored bottom-right so it never collides with the top panels or status pill.
 */
export function TaxiMapControls({
  currentProviderId,
  onProviderChange,
}: TaxiMapControlsProps) {
  const { theme, toggleTheme, mounted } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close the style picker on outside tap (mobile-friendly).
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  const handleSelect = (id: string) => {
    onProviderChange(id);
    setOpen(false);
  };

  return (
    <div
      ref={wrapperRef}
      className="pointer-events-auto absolute bottom-5 right-3 z-[1000] flex flex-col items-end gap-2 safe-bottom"
    >
      {/* ── Style picker popover ── */}
      <div
        className={`origin-bottom-right transition-all duration-200 ease-out ${
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-2 scale-95 opacity-0"
        }`}
      >
        <div className="w-[200px] rounded-2xl border border-white/10 bg-zinc-900/90 p-3 shadow-2xl backdrop-blur-xl">
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
            Map style
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TILE_PROVIDERS.map((provider) => {
              const selected = provider.id === currentProviderId;
              const sw = SWATCH[provider.id];
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handleSelect(provider.id)}
                  className={`group relative flex flex-col items-center gap-1.5 rounded-xl p-1.5 transition-all ${
                    selected
                      ? "bg-amber-500/15 ring-2 ring-amber-400"
                      : "hover:bg-white/5 active:scale-95"
                  }`}
                >
                  <div
                    className={`flex h-10 w-full items-center justify-center rounded-lg bg-gradient-to-br ${
                      sw?.gradient ?? "from-zinc-700 to-zinc-800"
                    } text-lg`}
                  >
                    {sw?.emoji ?? "🗺️"}
                  </div>
                  {selected && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 shadow">
                      <Check className="h-2.5 w-2.5 text-black" strokeWidth={3} />
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-semibold leading-none ${
                      selected ? "text-amber-300" : "text-white/55"
                    }`}
                  >
                    {provider.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Button stack ── */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Change map style"
          aria-expanded={open}
          className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-lg backdrop-blur-xl transition-all active:scale-95 ${
            open
              ? "border-amber-400/60 bg-amber-500/20 text-amber-300"
              : "border-white/10 bg-zinc-900/80 text-white/80 hover:bg-zinc-800/90"
          }`}
        >
          <Layers className="h-[18px] w-[18px]" />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          disabled={!mounted}
          aria-label={
            theme === "dark" ? "Switch to light map" : "Switch to dark map"
          }
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-zinc-900/80 text-white/80 shadow-lg backdrop-blur-xl transition-all hover:bg-zinc-800/90 active:scale-95"
        >
          {mounted && theme === "dark" ? (
            <Sun className="h-[18px] w-[18px] text-amber-300" />
          ) : (
            <Moon className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>
    </div>
  );
}
