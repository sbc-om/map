"use client";

import { memo, useState, useEffect, useCallback } from "react";
import { Plus, Minus, Maximize2, Minimize2, Share2, Check, Compass } from "lucide-react";
import { useMapControls } from "@/hooks/useMapControls";
import { useGeolocation } from "@/hooks/useGeolocation";
import { toast } from "sonner";

/**
 * MapControls - right-side control dock.
 *
 * Layout (bottom → top):
 *   Fullscreen · Share · Compass · [Zoom+/−] · Locate
 *
 * Spacing accounts for MapStatusBar at the very bottom (~28px).
 */
export const MapControls = memo(function MapControls() {
  const { map, zoomIn, zoomOut, toggleFullscreen, resetView } = useMapControls();
  const { locateUser, isLocating, isAvailable } = useGeolocation();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const handleShare = useCallback(async () => {
    if (!map) return;
    const c = map.getCenter();
    const params = new URLSearchParams({
      lat: c.lat.toFixed(6),
      lng: c.lng.toFixed(6),
      zoom: String(map.getZoom()),
    });
    const url = `${window.location.origin}/map?${params}`;
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      toast.success("Map link copied!", { duration: 2000 });
      setTimeout(() => setShared(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  }, [map]);

  return (
    <div className="absolute bottom-6 right-4 flex flex-col items-center gap-2 z-[1000]">
      {/* Locate */}
      <Btn onClick={locateUser} disabled={!isAvailable || isLocating} title="My location">
        <svg
          className={`h-[17px] w-[17px] ${isLocating ? "text-blue-500 animate-pulse" : "text-gray-600 dark:text-gray-200"}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4m0 12v4m10-10h-4M6 12H2" />
        </svg>
      </Btn>

      {/* Zoom group */}
      <div className="flex flex-col overflow-hidden rounded-xl bg-white dark:bg-gray-900 shadow-md border border-gray-100 dark:border-gray-800">
        <button
          onClick={zoomIn} disabled={!map}
          title="Zoom in" aria-label="Zoom in"
          className="flex h-9 w-9 items-center justify-center border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
        >
          <Plus className="h-4 w-4 text-gray-700 dark:text-gray-200" />
        </button>
        <button
          onClick={zoomOut} disabled={!map}
          title="Zoom out" aria-label="Zoom out"
          className="flex h-9 w-9 items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
        >
          <Minus className="h-4 w-4 text-gray-700 dark:text-gray-200" />
        </button>
      </div>

      {/* Compass / Reset view */}
      <Btn onClick={resetView} disabled={!map} title="Reset to Oman">
        <Compass className="h-[17px] w-[17px] text-gray-600 dark:text-gray-200" />
      </Btn>

      {/* Share */}
      <Btn onClick={handleShare} disabled={!map} title="Share map view"
           className={shared ? "!border-green-400 !text-green-600" : ""}>
        {shared
          ? <Check className="h-[17px] w-[17px] text-green-500" />
          : <Share2 className="h-[17px] w-[17px] text-gray-600 dark:text-gray-200" />
        }
      </Btn>

      {/* Fullscreen */}
      <Btn onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
        {isFullscreen
          ? <Minimize2 className="h-[17px] w-[17px] text-gray-600 dark:text-gray-200" />
          : <Maximize2 className="h-[17px] w-[17px] text-gray-600 dark:text-gray-200" />
        }
      </Btn>
    </div>
  );
});

MapControls.displayName = "MapControls";

// ─── Shared button ────────────────────────────────────────────────────────────

function Btn({
  onClick, disabled, title, className = "", children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-gray-900 shadow-md border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 hover:shadow-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 active:scale-95 ${className}`}
    >
      {children}
    </button>
  );
}
