"use client";

import { useState, useEffect, useRef } from "react";
import { Layers, Check } from "lucide-react";
import { TILE_PROVIDERS } from "@/constants/tile-providers";

// ─── Assets ───────────────────────────────────────────────────────────────────

/** PNG preview screenshots for tile providers that have them */
const PREVIEW: Record<string, string> = {
  osm:       "/map-basic.png",
  satellite: "/map-satellite.png",
  dark:      "/map-dark.png",
};

/** Fallback gradient + emoji for providers without screenshots */
const FALLBACK: Record<string, { gradient: string; emoji: string }> = {
  light:   { gradient: "from-slate-50 to-gray-200",    emoji: "☀️" },
  terrain: { gradient: "from-green-200 to-amber-300",  emoji: "⛰️" },
  streets: { gradient: "from-violet-300 to-blue-400",  emoji: "🏙️" },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface MapTileSwitcherProps {
  selectedProviderId: string;
  onProviderChange: (id: string) => void;
}

/**
 * MapTileSwitcher — compact pill trigger + floating 2-column style picker.
 *
 * - Click to open / click-outside to close (mobile-friendly)
 * - 2-column grid: preview image or gradient + name
 * - Check mark on selected tile
 */
export function MapTileSwitcher({
  selectedProviderId,
  onProviderChange,
}: MapTileSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const current =
    TILE_PROVIDERS.find((p) => p.id === selectedProviderId) ?? TILE_PROVIDERS[0];

  // Close on outside click / touch
  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [isOpen]);

  const handleSelect = (id: string) => {
    onProviderChange(id);
    setIsOpen(false);
  };

  return (
    <div
      ref={wrapperRef}
      className="absolute bottom-6 left-4 z-[1000]"
    >
      {/* ── Floating panel ── */}
      <div
        className={`absolute bottom-full left-0 mb-2.5 transition-all duration-200 ease-out ${
          isOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 p-3 w-[178px]">
          {/* Header */}
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500 mb-2.5">
            Map Style
          </p>

          {/* 2-column grid */}
          <div className="grid grid-cols-2 gap-2">
            {TILE_PROVIDERS.map((provider) => {
              const isSelected = provider.id === selectedProviderId;
              const preview = PREVIEW[provider.id];
              const fb = FALLBACK[provider.id];

              return (
                <button
                  key={provider.id}
                  onClick={() => handleSelect(provider.id)}
                  className={`relative flex flex-col items-center gap-1.5 p-1.5 rounded-xl transition-all duration-150 ${
                    isSelected
                      ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95"
                  }`}
                >
                  {/* Tile preview */}
                  <div className="relative w-full h-11 rounded-lg overflow-hidden flex-shrink-0">
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={preview}
                        alt={provider.name}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : fb ? (
                      <div
                        className={`w-full h-full bg-gradient-to-br ${fb.gradient} flex items-center justify-center text-xl`}
                      >
                        {fb.emoji}
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gray-200 dark:bg-gray-700" />
                    )}

                    {/* Selected indicator */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 shadow-md">
                          <Check className="h-3 w-3 text-white" strokeWidth={3} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`text-[10px] font-semibold leading-none ${
                      isSelected
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-400"
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

      {/* ── Pill trigger button ── */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={`flex h-9 items-center gap-2 rounded-full border px-3 shadow-md transition-all duration-150 backdrop-blur-sm ${
          isOpen
            ? "border-blue-500 bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20 shadow-lg"
            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg"
        }`}
        aria-label="Change map style"
        aria-expanded={isOpen}
      >
        <Layers className="h-[15px] w-[15px] flex-shrink-0" />
        <span className="text-[13px] font-medium">{current.name}</span>
      </button>
    </div>
  );
}
