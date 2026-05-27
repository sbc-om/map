"use client";

import { useState, useCallback, useRef } from "react";
import { useLeafletMap } from "./useLeafletMap";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GeocodedPlace {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
}

export interface DirectionStep {
  name: string;
  distance: number; // metres
  duration: number; // seconds
  type: string;
  modifier?: string;
}

export interface DirectionResult {
  from: GeocodedPlace;
  to: GeocodedPlace;
  distance: number; // metres
  duration: number; // seconds
  steps: DirectionStep[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function geocodeQuery(query: string): Promise<GeocodedPlace> {
  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=en`;

  const res = await fetch(url, {
    headers: { "User-Agent": "SBCMap/1.0 (https://map.sbc.om)" },
  });
  const data = await res.json();

  if (!data?.length) throw new Error(`Could not find "${query}"`);

  return {
    name: data[0].name || data[0].display_name.split(",")[0].trim(),
    displayName: data[0].display_name,
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
  };
}

export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useDirections — route from A → B using OSRM (free, no API key)
 *
 * Draws a styled polyline + start/end markers on the Leaflet map.
 */
export function useDirections() {
  const map = useLeafletMap();
  const [result, setResult] = useState<DirectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const layerRef = useRef<unknown>(null);

  const getRoute = useCallback(
    async (fromQuery: string, toQuery: string) => {
      if (!map) return;
      setIsLoading(true);
      setError(null);

      try {
        // 1. Geocode both endpoints in parallel
        const [from, to] = await Promise.all([
          geocodeQuery(fromQuery),
          geocodeQuery(toQuery),
        ]);

        // 2. Fetch route via OSRM public API
        const routeUrl =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${from.lng},${from.lat};${to.lng},${to.lat}` +
          `?geometries=geojson&overview=full&steps=true`;

        const res = await fetch(routeUrl);
        const data = await res.json();

        if (data.code !== "Ok" || !data.routes?.length) {
          throw new Error("No route found between these locations.");
        }

        const route = data.routes[0];

        // 3. Convert coordinates [lng, lat] → [lat, lng] for Leaflet
        const latlngs: [number, number][] = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng]
        );

        const L = await import("leaflet");

        // Remove previous route layer
        if (layerRef.current) {
          map.removeLayer(layerRef.current as L.Layer);
        }

        // 4. Draw route: white outline + blue line
        const outline = L.polyline(latlngs, {
          color: "#ffffff",
          weight: 8,
          opacity: 0.9,
        });
        const line = L.polyline(latlngs, {
          color: "#2563eb",
          weight: 5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        });

        const makePin = (color: string) =>
          L.divIcon({
            className: "",
            html: `<div style="
              width:16px;height:16px;
              background:${color};
              border:3px solid white;
              border-radius:50%;
              box-shadow:0 2px 8px rgba(0,0,0,0.4);
            "></div>`,
            iconAnchor: [8, 8],
          });

        const startPin = L.marker([from.lat, from.lng], {
          icon: makePin("#22c55e"),
          zIndexOffset: 1000,
        });
        const endPin = L.marker([to.lat, to.lng], {
          icon: makePin("#ef4444"),
          zIndexOffset: 1000,
        });

        const group = L.layerGroup([outline, line, startPin, endPin]);
        group.addTo(map);
        layerRef.current = group;

        // 5. Fit map to route
        map.fitBounds(line.getBounds(), { padding: [60, 60], animate: true });

        // 6. Parse steps
        const steps: DirectionStep[] = route.legs[0].steps.map(
          (s: {
            name: string;
            distance: number;
            duration: number;
            maneuver: { type: string; modifier?: string };
          }) => ({
            name: s.name,
            distance: s.distance,
            duration: s.duration,
            type: s.maneuver.type,
            modifier: s.maneuver.modifier,
          })
        );

        setResult({
          from,
          to,
          distance: route.distance,
          duration: route.duration,
          steps,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to get directions."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [map]
  );

  const clearRoute = useCallback(async () => {
    if (layerRef.current && map) {
      const L = await import("leaflet");
      map.removeLayer(layerRef.current as L.Layer);
      layerRef.current = null;
    }
    setResult(null);
    setError(null);
  }, [map]);

  return { result, isLoading, error, getRoute, clearRoute };
}
