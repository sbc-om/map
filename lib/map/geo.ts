/**
 * Coordinate helpers. The app stores positions as `{ lat, lng }` or
 * `[lat, lng]` tuples; MapLibre expects `[lng, lat]`. Convert only here.
 */

import type { LngLatBoundsLike } from "maplibre-gl";

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export type LatLngTuple = [number, number];

export function toLngLat(p: LatLngLiteral | LatLngTuple): [number, number] {
  return Array.isArray(p) ? [p[1], p[0]] : [p.lng, p.lat];
}

/** `[lat, lng]` path → GeoJSON `[lng, lat]` coordinates. */
export function toLngLatPath(path: Array<LatLngLiteral | LatLngTuple>): [number, number][] {
  return path.map(toLngLat);
}

/** Bounding box of a set of points, ready for `map.fitBounds`. */
export function boundsOf(points: Array<LatLngLiteral | LatLngTuple>): LngLatBoundsLike | null {
  if (points.length === 0) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const p of points) {
    const [lng, lat] = toLngLat(p);
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}

/** Great-circle distance in metres. */
export function distanceMeters(a: LatLngLiteral, b: LatLngLiteral): number {
  const R = 6371008.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
