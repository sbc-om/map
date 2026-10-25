"use client";

import { useEffect, useId, useMemo } from "react";
import { useMap } from "@/hooks/useMap";
import { setOverlay, removeOverlay } from "@/lib/map/overlays";

interface GeoJSONStyle {
  fillColor?: string;
  fillOpacity?: number;
  color?: string;
  weight?: number;
}

interface MapGeoJSONProps {
  data: GeoJSON.Feature | null;
  style?: GeoJSONStyle;
}

// Default style values
const DEFAULT_STYLE: Required<GeoJSONStyle> = {
  fillColor: "#3b82f6",
  fillOpacity: 0.2,
  color: "#2563eb",
  weight: 2,
};

/** `[[west, south], [east, north]]` of every position in a geometry. */
function geometryBounds(
  geometry: GeoJSON.Geometry | null
): [[number, number], [number, number]] | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  const visit = (coords: unknown): void => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number") {
      const [lng, lat] = coords as number[];
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
      return;
    }
    coords.forEach(visit);
  };

  const walk = (g: GeoJSON.Geometry | null) => {
    if (!g) return;
    if (g.type === "GeometryCollection") g.geometries.forEach(walk);
    else visit(g.coordinates);
  };
  walk(geometry);

  if (!isFinite(west) || !isFinite(south)) return null;
  return [
    [west, south],
    [east, north],
  ];
}

/**
 * MapGeoJSON component - Renders a GeoJSON feature (e.g. a country outline)
 *
 * Features:
 * - Renders GeoJSON polygons/multipolygons as a fill + outline overlay
 * - Customizable styling with memoized style object
 * - Survives basemap/theme switches (lib/map/overlays re-adds it)
 * - Automatic cleanup on unmount
 * - Flies to the feature's bounds
 */
export function MapGeoJSON({ data, style }: MapGeoJSONProps) {
  const map = useMap();
  const overlayId = `geojson-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  // Memoize style to prevent unnecessary effect triggers
  // Only re-compute when actual style values change
  const memoizedStyle = useMemo(
    () => ({
      fillColor: style?.fillColor ?? DEFAULT_STYLE.fillColor,
      fillOpacity: style?.fillOpacity ?? DEFAULT_STYLE.fillOpacity,
      color: style?.color ?? DEFAULT_STYLE.color,
      weight: style?.weight ?? DEFAULT_STYLE.weight,
    }),
    [style?.fillColor, style?.fillOpacity, style?.color, style?.weight]
  );

  useEffect(() => {
    if (!map || !data) return;

    try {
      setOverlay(map, overlayId, data, [
        {
          id: "fill",
          type: "fill",
          paint: {
            "fill-color": memoizedStyle.fillColor,
            "fill-opacity": memoizedStyle.fillOpacity,
          },
        },
        {
          id: "outline",
          type: "line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": memoizedStyle.color,
            "line-width": memoizedStyle.weight,
          },
        },
      ]);

      // Fit bounds to feature with padding
      const bounds = geometryBounds(data.geometry);
      if (bounds) {
        map.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          duration: 1500,
          essential: true,
        });
      }
    } catch (error) {
      console.error("Failed to render GeoJSON:", error);
    }

    // Cleanup
    return () => {
      removeOverlay(map, overlayId);
    };
  }, [map, data, memoizedStyle, overlayId]);

  return null;
}
