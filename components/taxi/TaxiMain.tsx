"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LeafletMap } from "@/components/map/LeafletMap";
import { LeafletTileLayer } from "@/components/map/LeafletTileLayer";
import { useMapTileProvider } from "@/hooks/useMapTileProvider";
import { useLeafletMap } from "@/hooks/useLeafletMap";
import { useRealtimeStatus } from "@/hooks/useTaxiStore";
import { initRealtime } from "@/lib/taxi/realtime";
import { TaxiModeSelect } from "./TaxiModeSelect";
import { PassengerFlow } from "./PassengerFlow";
import { DriverFlow } from "./DriverFlow";
import { DEFAULT_PICKUP } from "@/constants/taxi-config";
import type { TaxiMode } from "@/types/taxi";

interface TaxiMainProps {
  initialMode?: TaxiMode | null;
}

/** Read a preselected mode from the URL query (`?mode=passenger|driver`). */
function readModeFromUrl(): TaxiMode | null {
  if (typeof window === "undefined") return null;
  const mode = new URLSearchParams(window.location.search).get("mode");
  return mode === "passenger" || mode === "driver" ? mode : null;
}

/**
 * Root of the taxi dispatch experience. Renders the shared Leaflet map and
 * overlays either the mode selector, the passenger flow, or the driver flow.
 */
export function TaxiMain({ initialMode = null }: TaxiMainProps) {
  const [mode, setMode] = useState<TaxiMode | null>(initialMode);
  const [picking, setPicking] = useState(false);
  const { tileProvider } = useMapTileProvider();
  const map = useLeafletMap();
  const realtimeStatus = useRealtimeStatus();

  // Connect the cross-device realtime transport (Ably) once on mount. No-op
  // when NEXT_PUBLIC_ABLY_KEY is unset (falls back to same-browser sync).
  useEffect(() => {
    void initRealtime();
  }, []);

  // Preselect the role from the URL after mount (avoids hydration mismatch
  // since the page is statically prerendered with no mode).
  const appliedUrlModeRef = useRef(false);
  useEffect(() => {
    if (appliedUrlModeRef.current) return;
    appliedUrlModeRef.current = true;
    const urlMode = readModeFromUrl();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync role from URL after mount
    if (urlMode) setMode(urlMode);
  }, []);

  // Allow the active flow to subscribe to map clicks (for "pick on map").
  const clickHandlerRef = useRef<((lat: number, lng: number) => void) | null>(
    null
  );
  const registerMapClick = useCallback(
    (handler: ((lat: number, lng: number) => void) | null) => {
      clickHandlerRef.current = handler;
    },
    []
  );

  // Bind the click listener directly to the map instance once it is ready.
  // (LeafletMap initialises asynchronously, so attaching via its onClick prop
  // can miss the map; binding here re-runs reliably when `map` becomes available.)
  useEffect(() => {
    if (!map) return;
    const handler = (e: { latlng: { lat: number; lng: number } }) => {
      clickHandlerRef.current?.(e.latlng.lat, e.latlng.lng);
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [map]);

  const exitToSelect = useCallback(() => setMode(null), []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-zinc-950">
      <LeafletMap
        className="h-full w-full"
        center={DEFAULT_PICKUP}
        zoom={13}
        cursorStyle={picking ? "crosshair" : "grab"}
      >
        <LeafletTileLayer
          url={tileProvider.url}
          attribution={tileProvider.attribution}
          maxZoom={tileProvider.maxZoom}
        />
      </LeafletMap>

      {mode === null && <TaxiModeSelect onSelect={setMode} />}
      {mode === "passenger" && (
        <PassengerFlow
          onExit={exitToSelect}
          registerMapClick={registerMapClick}
          onPickModeChange={setPicking}
        />
      )}
      {mode === "driver" && (
        <DriverFlow
          onExit={exitToSelect}
          registerMapClick={registerMapClick}
          onPickModeChange={setPicking}
        />
      )}

      {mode !== null && realtimeStatus !== "disabled" && (
        <div className="pointer-events-none absolute right-3 top-3 z-[1000]">
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur ${
              realtimeStatus === "connected"
                ? "bg-emerald-500/15 text-emerald-300"
                : realtimeStatus === "failed"
                  ? "bg-red-500/15 text-red-300"
                  : "bg-amber-500/15 text-amber-300"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                realtimeStatus === "connected"
                  ? "bg-emerald-400"
                  : realtimeStatus === "failed"
                    ? "bg-red-400"
                    : "animate-pulse bg-amber-400"
              }`}
            />
            {realtimeStatus === "connected"
              ? "Live"
              : realtimeStatus === "failed"
                ? "Offline"
                : "Connecting…"}
          </span>
        </div>
      )}
    </div>
  );
}
