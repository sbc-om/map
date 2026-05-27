"use client";

import { memo, useState, useEffect } from "react";
import { useLeafletMap } from "@/hooks/useLeafletMap";
import type { LeafletMouseEvent } from "leaflet";

/** Format decimal degrees → degrees-minutes-seconds string */
function toDMS(val: number, axis: "lat" | "lng"): string {
  const abs = Math.abs(val);
  const deg = Math.floor(abs);
  const minFull = (abs - deg) * 60;
  const min = Math.floor(minFull);
  const sec = ((minFull - min) * 60).toFixed(1);
  const dir = axis === "lat" ? (val >= 0 ? "N" : "S") : val >= 0 ? "E" : "W";
  return `${deg}°${min}′${sec}″ ${dir}`;
}

/**
 * MapStatusBar — professional coordinate/zoom display at the very bottom.
 * Non-interactive (pointer-events-none), no layout impact on other controls.
 */
export const MapStatusBar = memo(function MapStatusBar() {
  const map = useLeafletMap();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    if (!map) return;
    setZoom(map.getZoom());

    const onMove  = (e: LeafletMouseEvent) => setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
    const onZoom  = () => setZoom(map.getZoom());
    const onLeave = () => setCoords(null);

    map.on("mousemove", onMove);
    map.on("zoomend",   onZoom);
    map.on("mouseout",  onLeave);

    return () => {
      map.off("mousemove", onMove);
      map.off("zoomend",   onZoom);
      map.off("mouseout",  onLeave);
    };
  }, [map]);

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[999] flex items-center justify-between px-3 py-1 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm border-t border-gray-200/50 dark:border-gray-800/60 pointer-events-none select-none"
      aria-hidden="true"
    >
      {/* Coordinates */}
      <div className="flex items-center gap-4 font-mono text-[11px] min-w-0 overflow-hidden">
        {coords ? (
          <>
            <span className="text-gray-500 dark:text-gray-400 truncate">
              <span className="text-gray-400 dark:text-gray-600">Lat </span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {toDMS(coords.lat, "lat")}
              </span>
            </span>
            <span className="hidden sm:inline text-gray-500 dark:text-gray-400 truncate">
              <span className="text-gray-400 dark:text-gray-600">Lon </span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {toDMS(coords.lng, "lng")}
              </span>
            </span>
          </>
        ) : (
          <span className="text-gray-400 dark:text-gray-600 text-[11px] italic hidden sm:block">
            Move cursor to show coordinates
          </span>
        )}
      </div>

      {/* Zoom + Attribution */}
      <div className="flex items-center gap-3 font-mono text-[11px] text-gray-400 dark:text-gray-600 flex-shrink-0 ml-2">
        {zoom !== null && (
          <span>
            <span className="text-gray-400 dark:text-gray-600">z</span>
            <span className="font-bold text-gray-600 dark:text-gray-400">{zoom}</span>
          </span>
        )}
        <span className="hidden md:block">© OpenStreetMap</span>
      </div>
    </div>
  );
});

MapStatusBar.displayName = "MapStatusBar";
