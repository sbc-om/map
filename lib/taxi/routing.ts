/**
 * Routing & geocoding helpers for the taxi module.
 *
 * Uses free, key-less public services:
 * - OSRM (router.project-osrm.org) for driving routes.
 * - Nominatim (nominatim.openstreetmap.org) for forward/reverse geocoding.
 */

import type { LatLng, RouteInfo, TaxiPlace } from "@/types/taxi";

const NOMINATIM = "https://nominatim.openstreetmap.org";
const OSRM = "https://router.project-osrm.org";
const USER_AGENT = "OmanTaxi/1.0 (https://map.sbc.om)";

/** Forward geocode a free-text query into ranked place suggestions. */
export async function geocode(
  query: string,
  limit = 5
): Promise<TaxiPlace[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url =
    `${NOMINATIM}/search?q=${encodeURIComponent(trimmed)}` +
    `&format=json&limit=${limit}&accept-language=en&countrycodes=om`;

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error("Address search failed");

  const data = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;

  return data.map((item) => ({
    address: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }));
}

/** Reverse geocode a coordinate into a human-readable address. */
export async function reverseGeocode(point: LatLng): Promise<string> {
  const url =
    `${NOMINATIM}/reverse?lat=${point.lat}&lon=${point.lng}` +
    `&format=json&accept-language=en`;

  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error("Reverse geocode failed");
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? formatLatLng(point);
  } catch {
    return formatLatLng(point);
  }
}

/** Compute a driving route between two points using OSRM. */
export async function getRoute(from: LatLng, to: LatLng): Promise<RouteInfo> {
  const url =
    `${OSRM}/route/v1/driving/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?geometries=geojson&overview=full`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Routing service unavailable");

  const data = (await res.json()) as {
    code: string;
    routes?: Array<{
      distance: number;
      duration: number;
      geometry: { coordinates: [number, number][] };
    }>;
  };

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error("No route found between these locations");
  }

  const route = data.routes[0];
  const coordinates: [number, number][] = route.geometry.coordinates.map(
    ([lng, lat]) => [lat, lng]
  );

  return {
    distance: route.distance,
    duration: route.duration,
    coordinates,
  };
}

/**
 * Resilient route lookup used for fare estimation. Tries the OSRM routing
 * service first; if it is unavailable (rate-limited, offline, CORS, etc.) it
 * falls back to a straight-line estimate so the fare can always be computed.
 */
export async function getRouteEstimate(
  from: LatLng,
  to: LatLng
): Promise<RouteInfo> {
  try {
    return await getRoute(from, to);
  } catch {
    return straightLineEstimate(from, to);
  }
}

/** Average urban driving speed (km/h) used for fallback duration estimates. */
const FALLBACK_SPEED_KMH = 38;
/** Multiplier to approximate real road distance from straight-line distance. */
const ROAD_FACTOR = 1.3;

/** No-network fallback: estimate distance/duration from a straight line. */
export function straightLineEstimate(from: LatLng, to: LatLng): RouteInfo {
  const straightKm = haversineKm(from, to);
  const distanceKm = straightKm * ROAD_FACTOR;
  const distance = distanceKm * 1000; // metres
  const duration = (distanceKm / FALLBACK_SPEED_KMH) * 3600; // seconds

  return {
    distance,
    duration,
    coordinates: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
  };
}

/** Great-circle distance between two points in kilometres (Haversine). */
function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}


/** Format a coordinate as a short fallback address. */
export function formatLatLng(point: LatLng): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}
