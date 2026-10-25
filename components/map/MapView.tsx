"use client";

import { useContext, useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MapContext } from "@/contexts/MapContext";
import { DEFAULT_MAP_CONFIG } from "@/constants/map-config";
import { loadMapLibre } from "@/lib/map/maplibre";
import { toLngLat } from "@/lib/map/geo";
import type { MapViewProps } from "@/types/components";

/**
 * MapView - the single MapLibre GL map shared through MapContext.
 *
 * Vector tiles are rendered on the GPU, so zooming is continuous and labels
 * stay crisp; there are no raster squares filling in one by one. The map is
 * created once; later `mapStyle` changes swap the basemap in place (overlays
 * re-attach themselves, see lib/map/overlays.ts) and `center`/`zoom` changes
 * fly the camera instead of recreating the map.
 *
 * @example
 * ```tsx
 * <MapProvider>
 *   <MapView mapStyle={mapStyle.style} center={[23.58, 58.38]} zoom={12} />
 * </MapProvider>
 * ```
 */
export function MapView({
  mapStyle,
  center = DEFAULT_MAP_CONFIG.defaultCenter,
  zoom = DEFAULT_MAP_CONFIG.defaultZoom,
  minZoom = DEFAULT_MAP_CONFIG.minZoom,
  maxZoom = DEFAULT_MAP_CONFIG.maxZoom,
  className = "",
  children,
  onClick,
  onMouseMove,
  cursorStyle,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const appliedStyleRef = useRef(mapStyle);

  // Initial values only; later changes are applied by the effects below
  const initialRef = useRef({ center, zoom, minZoom, maxZoom, mapStyle });

  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error("MapView must be used within a MapProvider");
  }
  const { setMap, setMapError, startInitializing } = context;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    startInitializing();

    loadMapLibre()
      .then((maplibregl) => {
        if (cancelled) return;
        const init = initialRef.current;
        const map = new maplibregl.Map({
          container,
          style: init.mapStyle,
          center: toLngLat(init.center),
          zoom: init.zoom,
          minZoom: init.minZoom,
          maxZoom: init.maxZoom,
          attributionControl: { compact: true },
          // North stays up: vehicle headings and UI assume an unrotated map
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          // Keep already-loaded tiles while new ones stream in (no blank gaps)
          fadeDuration: 150,
          maxTileCacheZoomLevels: 6,
          cancelPendingTileRequestsWhileZooming: false,
        });
        map.touchZoomRotate.disableRotation();
        map.keyboard.disableRotation();
        mapRef.current = map;
        appliedStyleRef.current = init.mapStyle;

        let loadedOnce = false;
        map.once("load", () => {
          loadedOnce = true;
          if (!cancelled) setMap(map);
        });
        map.on("error", (e) => {
          // Tile errors carry a sourceId and are retried by MapLibre; only a
          // style that fails before the first load leaves the map unusable.
          const fromSource = "sourceId" in e && Boolean(e.sourceId);
          if (!loadedOnce && !fromSource && !cancelled && e.error) {
            setMapError(e.error);
          }
        });

        // Fit the canvas to its container whenever the layout changes
        // (dvh units, panels, orientation), not only on window resize.
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => map.resize());
          resizeObserver.observe(container);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMapError(error instanceof Error ? error : new Error(String(error)));
        }
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, [setMap, setMapError, startInitializing]);

  // Basemap / theme switch without recreating the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedStyleRef.current === mapStyle) return;
    appliedStyleRef.current = mapStyle;
    map.setStyle(mapStyle);
  }, [mapStyle]);

  useEffect(() => {
    mapRef.current?.setMinZoom(minZoom);
  }, [minZoom]);

  useEffect(() => {
    mapRef.current?.setMaxZoom(maxZoom);
  }, [maxZoom]);

  // Fly to a new center/zoom passed by the parent
  const [lat, lng] = center;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = map.getCenter();
    if (current.lat === lat && current.lng === lng && map.getZoom() === zoom) return;
    map.flyTo({ center: [lng, lat], zoom, duration: 900, essential: true });
  }, [lat, lng, zoom]);

  useEffect(() => {
    const map = context.map;
    if (!map || !onClick) return;
    const handler = (e: { lngLat: { lat: number; lng: number } }) =>
      onClick(e.lngLat.lat, e.lngLat.lng);
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [context.map, onClick]);

  useEffect(() => {
    const map = context.map;
    if (!map || !onMouseMove) return;
    const handler = (e: { lngLat: { lat: number; lng: number } }) =>
      onMouseMove(e.lngLat.lat, e.lngLat.lng);
    map.on("mousemove", handler);
    return () => {
      map.off("mousemove", handler);
    };
  }, [context.map, onMouseMove]);

  useEffect(() => {
    const map = context.map;
    if (!map) return;
    map.getCanvas().style.cursor = cursorStyle ?? "";
  }, [context.map, cursorStyle]);

  return (
    <>
      <div
        ref={containerRef}
        className={`map-view h-full w-full ${className}`}
        data-testid="map-container"
      />
      {children}
    </>
  );
}
