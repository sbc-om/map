"use client";

import { useEffect, useRef, useMemo } from "react";
import type { TileLayer } from "leaflet";
import { useLeafletMap } from "@/hooks/useLeafletMap";
import type { LeafletTileLayerProps } from "@/types/components";

// Default subdomains - defined outside component to maintain referential stability
const DEFAULT_SUBDOMAINS = ["a", "b", "c"];
const NO_FALLBACKS: string[] = [];

/** Highest zoom the layer will display; beyond the provider's native zoom tiles are upscaled. */
const OVERZOOM_MAX = 20;
/** Switch servers if no tile has loaded this long after (re)starting a source. */
const FIRST_TILE_TIMEOUT_MS = 7000;
/** Errors tolerated before a source that has never loaded a tile is abandoned. */
const ERRORS_BEFORE_FIRST_TILE = 4;

/**
 * LeafletTileLayer component - Manages tile layer rendering
 *
 * This component adds a tile layer to the Leaflet map. It handles
 * tile layer updates when the URL changes and cleanup on unmount.
 *
 * Features:
 * - Adds tile layer to map on mount, removes it on unmount
 * - Automatic failover: when the active server is blocked, rate-limited or
 *   silent, the layer switches to the next of `fallbackUrls` in place
 * - Loads tiles while panning and keeps a wide buffer, so dragging never
 *   reveals empty grey squares
 * - Upscales the provider's deepest tiles instead of going blank past its
 *   native max zoom
 *
 * @example
 * ```tsx
 * <LeafletTileLayer
 *   url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
 *   fallbackUrls={["https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"]}
 *   attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
 *   maxZoom={19}
 * />
 * ```
 */
export function LeafletTileLayer({
  url,
  fallbackUrls = NO_FALLBACKS,
  className = "",
  attribution = "",
  maxZoom = 19,
  subdomains = DEFAULT_SUBDOMAINS,
  tileSize = 256,
  zoomOffset = 0,
  detectRetina = false,
}: LeafletTileLayerProps) {
  const map = useLeafletMap();
  const tileLayerRef = useRef<TileLayer | null>(null);

  // Join arrays into keys so new array references don't re-create the layer
  const subdomainsKey = useMemo(() => subdomains.join(","), [subdomains]);
  const fallbackKey = useMemo(() => fallbackUrls.join("|"), [fallbackUrls]);

  useEffect(() => {
    // Wait for map to be ready
    if (!map) {
      return;
    }

    // Validate tile URL
    if (!url || typeof url !== "string") {
      console.error("Invalid tile layer URL:", url);
      return;
    }

    let isMounted = true;
    let watchdog: ReturnType<typeof setTimeout> | undefined;

    const setupTileLayer = async () => {
      try {
        // Dynamically import Leaflet
        const L = await import("leaflet");

        if (!isMounted || !map) {
          return;
        }

        // Remove existing tile layer if it exists
        if (tileLayerRef.current) {
          try {
            tileLayerRef.current.remove();
          } catch {
            // Ignore removal errors
          }
          tileLayerRef.current = null;
        }

        const sources = [url, ...(fallbackKey ? fallbackKey.split("|") : [])];
        let sourceIndex = 0;
        let loaded = 0;
        let errors = 0;

        const tileLayer = L.tileLayer(url, {
          attribution,
          className,
          maxNativeZoom: maxZoom,
          maxZoom: Math.max(maxZoom, OVERZOOM_MAX),
          subdomains: subdomainsKey.split(","),
          tileSize,
          zoomOffset,
          detectRetina,
          // Fetch tiles during the pan, not only after it ends
          updateWhenIdle: false,
          updateWhenZooming: false,
          updateInterval: 100,
          keepBuffer: 6,
        });

        const armWatchdog = () => {
          clearTimeout(watchdog);
          watchdog = setTimeout(() => {
            if (loaded === 0) switchSource("no tiles received");
          }, FIRST_TILE_TIMEOUT_MS);
        };

        const switchSource = (reason: string) => {
          if (!isMounted || sourceIndex >= sources.length - 1) return;
          sourceIndex += 1;
          loaded = 0;
          errors = 0;
          console.warn(
            `Tile server failed (${reason}); switching to ${sources[sourceIndex]}`
          );
          tileLayer.setUrl(sources[sourceIndex]);
          armWatchdog();
        };

        tileLayer.on("tileload", () => {
          loaded += 1;
          if (loaded === 1) clearTimeout(watchdog);
        });

        tileLayer.on("tileerror", () => {
          errors += 1;
          const neverLoaded = loaded === 0 && errors >= ERRORS_BEFORE_FIRST_TILE;
          const mostlyFailing = errors > 12 && errors > loaded * 2;
          if (neverLoaded || mostlyFailing) switchSource(`${errors} tile errors`);
        });

        tileLayer.addTo(map);
        tileLayerRef.current = tileLayer;
        armWatchdog();
      } catch (error) {
        if (isMounted) {
          console.error("Failed to add tile layer:", error);
        }
      }
    };

    setupTileLayer();

    // Cleanup function
    return () => {
      isMounted = false;
      clearTimeout(watchdog);
      if (tileLayerRef.current) {
        try {
          tileLayerRef.current.remove();
          tileLayerRef.current = null;
        } catch (error) {
          console.error("Error removing tile layer:", error);
        }
      }
    };
  }, [
    map,
    url,
    fallbackKey,
    className,
    attribution,
    maxZoom,
    subdomainsKey,
    tileSize,
    zoomOffset,
    detectRetina,
  ]);

  // This component doesn't render anything visible
  return null;
}
