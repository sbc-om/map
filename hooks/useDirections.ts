"use client";

import { useState, useCallback, useRef } from "react";
import type { Marker } from "maplibre-gl";
import { useMap } from "./useMap";
import { nominatimSearch, osrmDrivingRoute } from "@/lib/geo-services";
import { maplibre } from "@/lib/map/maplibre";
import { boundsOf } from "@/lib/map/geo";
import { animateLineOverlay, removeOverlay } from "@/lib/map/overlays";

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

// ─── Route drawing ───────────────────────────────────────────────────────────

const ROUTE_OVERLAY_ID = "directions-route";

/** White casing under a blue line. */
const ROUTE_LAYERS = [
  {
    id: "outline",
    type: "line" as const,
    layout: { "line-cap": "round" as const, "line-join": "round" as const },
    paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.9 },
  },
  {
    id: "line",
    type: "line" as const,
    layout: { "line-cap": "round" as const, "line-join": "round" as const },
    paint: { "line-color": "#2563eb", "line-width": 5, "line-opacity": 0.95 },
  },
];

function makePin(color: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `
    width:16px;height:16px;
    background:${color};
    border:3px solid white;
    border-radius:50%;
    box-shadow:0 2px 8px rgba(0,0,0,0.4);`;
  // Above the POI and preview pins, like zIndexOffset: 1000 before
  el.style.zIndex = "1000";
  return el;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function geocodeQuery(query: string): Promise<GeocodedPlace> {
  const data = await nominatimSearch<
    Array<{ name?: string; display_name: string; lat: string; lon: string }>
  >(`q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=en`);

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
 * useDirections - route from A → B using OSRM (free, no API key)
 *
 * Draws a styled route line + start/end markers on the map.
 */
export function useDirections() {
  const map = useMap();
  const [result, setResult] = useState<DirectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pinsRef = useRef<Marker[]>([]);
  // Bumped per route so a late camera move never draws a replaced route
  const routeIdRef = useRef(0);

  const removeRoute = useCallback(() => {
    routeIdRef.current++;
    pinsRef.current.forEach((pin) => pin.remove());
    pinsRef.current = [];
    if (map) removeOverlay(map, ROUTE_OVERLAY_ID);
  }, [map]);

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

        // 2. Fetch route via OSRM public API (with a backup server)
        const data = await osrmDrivingRoute<{
          code: string;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          routes?: any[];
        }>(
          `${from.lng},${from.lat};${to.lng},${to.lat}` +
            `?geometries=geojson&overview=full&steps=true`
        ).catch(() => {
          throw new Error("No route found between these locations.");
        });

        if (!data.routes?.length) {
          throw new Error("No route found between these locations.");
        }

        const route = data.routes[0];

        // 3. OSRM geometry is already GeoJSON [lng, lat]
        const coordinates: [number, number][] = route.geometry.coordinates;

        // Remove previous route
        removeRoute();
        const routeId = routeIdRef.current;

        // 4. Start/end pins
        const { Marker } = maplibre();
        pinsRef.current = [
          new Marker({ element: makePin("#22c55e"), anchor: "center" })
            .setLngLat([from.lng, from.lat])
            .addTo(map),
          new Marker({ element: makePin("#ef4444"), anchor: "center" })
            .setLngLat([to.lng, to.lat])
            .addTo(map),
        ];

        // 5. Fly to the route, then draw it in once the camera settles
        const bounds = boundsOf(coordinates.map(([lng, lat]) => ({ lat, lng })));
        if (bounds) {
          map.fitBounds(bounds, {
            padding: { top: 60, bottom: 60, left: 60, right: 60 },
            duration: 900,
          });
        }
        const draw = () => {
          if (routeIdRef.current !== routeId) return;
          routeIdRef.current++; // draw once (moveend or the fallback below)
          animateLineOverlay(map, ROUTE_OVERLAY_ID, coordinates, ROUTE_LAYERS);
        };
        map.once("moveend", draw);
        // The camera may already frame the route, or the user may grab it
        setTimeout(draw, 1400);

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
    [map, removeRoute]
  );

  const clearRoute = useCallback(() => {
    removeRoute();
    setResult(null);
    setError(null);
  }, [removeRoute]);

  return { result, isLoading, error, getRoute, clearRoute };
}
