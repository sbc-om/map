"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Wifi, WifiOff } from "lucide-react";
import { LeafletMap } from "@/components/map/LeafletMap";
import { LeafletTileLayer } from "@/components/map/LeafletTileLayer";
import { useMapTileProvider } from "@/hooks/useMapTileProvider";
import { useLeafletMap } from "@/hooks/useLeafletMap";
import { useRealtimeStatus } from "@/hooks/useTaxiStore";
import { initRealtime } from "@/lib/taxi/realtime";
import { TaxiModeSelect } from "./TaxiModeSelect";
import { PassengerFlow } from "./PassengerFlow";
import { DriverFlow } from "./DriverFlow";
import { TaxiMapControls } from "./TaxiMapControls";
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
    <div className="relative h-dvh-screen w-full overflow-hidden bg-zinc-950">
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
          tileSize={tileProvider.tileSize}
          zoomOffset={tileProvider.zoomOffset}
          detectRetina={tileProvider.detectRetina}
        />
      </LeafletMap>

      {mode !== null && (
        <TaxiMapControls />
      )}

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
        <div className="pointer-events-none absolute right-20 top-[max(0.75rem,env(safe-area-inset-top))] z-[1000] sm:right-16">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-[0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur-2xl ${
              realtimeStatus === "connected"
                ? "border-emerald-400/20 bg-zinc-900/55 text-emerald-300"
                : realtimeStatus === "failed"
                  ? "border-red-400/20 bg-zinc-900/55 text-red-300"
                  : "border-amber-400/20 bg-zinc-900/55 text-amber-300"
            }`}
            aria-label={
              realtimeStatus === "connected"
                ? "Realtime connected"
                : realtimeStatus === "failed"
                  ? "Realtime offline"
                  : "Realtime connecting"
            }
            title={
              realtimeStatus === "connected"
                ? "Realtime connected"
                : realtimeStatus === "failed"
                  ? "Realtime offline"
                  : "Realtime connecting"
            }
          >
              {realtimeStatus === "connected" ? (
              <Wifi className="h-4 w-4 text-emerald-300" />
              ) : realtimeStatus === "failed" ? (
              <WifiOff className="h-4 w-4 text-red-300" />
              ) : (
              <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
              )}
          </span>
        </div>
      )}
    </div>
  );
}
