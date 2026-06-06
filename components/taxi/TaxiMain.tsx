"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LeafletMap } from "@/components/map/LeafletMap";
import { LeafletTileLayer } from "@/components/map/LeafletTileLayer";
import { useMapTileProvider } from "@/hooks/useMapTileProvider";
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
  const handleMapClick = useCallback((lat: number, lng: number) => {
    clickHandlerRef.current?.(lat, lng);
  }, []);
  const registerMapClick = useCallback(
    (handler: ((lat: number, lng: number) => void) | null) => {
      clickHandlerRef.current = handler;
    },
    []
  );

  const exitToSelect = useCallback(() => setMode(null), []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-zinc-950">
      <LeafletMap
        className="h-full w-full"
        center={DEFAULT_PICKUP}
        zoom={13}
        onClick={handleMapClick}
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
      {mode === "driver" && <DriverFlow onExit={exitToSelect} />}
    </div>
  );
}
