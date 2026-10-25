/**
 * Map utility functions for bounds calculation and map operations
 * Validates: Requirements 12.1
 *
 * NOTE: This module is SSR-safe. It only imports MapLibre types; anything
 * that needs the runtime library goes through `maplibre()` (lib/map/maplibre).
 * Coordinates are `[lat, lng]` here, as everywhere else in the app.
 */

import type {
  FitBoundsOptions,
  LngLatBounds,
  LngLatBoundsLike,
  Map as MapLibreMap,
  Marker,
} from 'maplibre-gl';
import { distanceMeters, toLngLat } from '@/lib/map/geo';

/**
 * Raw bounds data that can be used without MapLibre
 */
export interface RawBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Calculates raw bounding box from an array of coordinates (SSR-safe)
 * @param coordinates - Array of [latitude, longitude] tuples
 * @returns Raw bounds object or null if array is empty
 */
export function calculateRawBounds(
  coordinates: [number, number][]
): RawBounds | null {
  if (coordinates.length === 0) {
    return null;
  }

  if (coordinates.length === 1) {
    const [lat, lng] = coordinates[0];
    const offset = 0.001;
    return {
      minLat: lat - offset,
      maxLat: lat + offset,
      minLng: lng - offset,
      maxLng: lng + offset,
    };
  }

  let minLat = coordinates[0][0];
  let maxLat = coordinates[0][0];
  let minLng = coordinates[0][1];
  let maxLng = coordinates[0][1];

  for (const [lat, lng] of coordinates) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Calculates bounding box from an array of coordinates
 * @param coordinates - Array of [latitude, longitude] tuples
 * @returns `[[west, south], [east, north]]` for `map.fitBounds`, or null if empty
 */
export function calculateBounds(
  coordinates: [number, number][]
): [[number, number], [number, number]] | null {
  const raw = calculateRawBounds(coordinates);
  if (!raw) return null;
  return [
    [raw.minLng, raw.minLat],
    [raw.maxLng, raw.maxLat],
  ];
}

/**
 * Expands raw bounds by a percentage
 * @param bounds - Original bounds
 * @param percentage - Percentage to expand (e.g., 0.1 for 10%)
 * @returns Expanded bounds
 */
export function expandBounds(bounds: RawBounds, percentage: number = 0.1): RawBounds {
  const latDiff = (bounds.maxLat - bounds.minLat) * percentage;
  const lngDiff = (bounds.maxLng - bounds.minLng) * percentage;

  return {
    minLat: bounds.minLat - latDiff,
    maxLat: bounds.maxLat + latDiff,
    minLng: bounds.minLng - lngDiff,
    maxLng: bounds.maxLng + lngDiff,
  };
}

/**
 * Checks if a coordinate is within bounds
 * @param coord - [latitude, longitude] tuple
 * @param bounds - MapLibre LngLatBounds object
 * @returns True if coordinate is within bounds
 */
export function isCoordinateInBounds(
  coord: [number, number],
  bounds: LngLatBounds
): boolean {
  return bounds.contains(toLngLat(coord));
}

/**
 * Gets the center point of bounds
 * @param bounds - MapLibre LngLatBounds object
 * @returns Center coordinate as [latitude, longitude]
 */
export function getBoundsCenter(bounds: LngLatBounds): [number, number] {
  const center = bounds.getCenter();
  return [center.lat, center.lng];
}

/**
 * Calculates the area of bounds in square meters
 * @param bounds - MapLibre LngLatBounds object
 * @returns Area in square meters (approximate)
 */
export function calculateBoundsArea(bounds: LngLatBounds): number {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();

  // Width and height using the great-circle distance
  const width = distanceMeters(sw, { lat: sw.lat, lng: ne.lng });
  const height = distanceMeters(sw, { lat: ne.lat, lng: sw.lng });

  return width * height;
}

/**
 * DOM helpers for HTML markers and popups
 */

/** Escape text before interpolating it into marker/popup HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build a marker/popup element from trusted HTML (escape user text first).
 * @param html - Inner HTML
 * @param className - Optional class for the wrapper element
 */
export function htmlElement(html: string, className = ''): HTMLDivElement {
  const el = document.createElement('div');
  if (className) el.className = className;
  el.innerHTML = html.trim();
  return el;
}

/**
 * Safe MapLibre access helpers
 * Validates: Requirements 12.4
 */

/**
 * Safely gets the current zoom level from a map instance
 * @param map - MapLibre map instance
 * @param defaultZoom - Default value if map is null/undefined
 * @returns Current zoom level or default
 */
export function safeGetZoom(map: MapLibreMap | null | undefined, defaultZoom: number = 13): number {
  try {
    return map?.getZoom() ?? defaultZoom;
  } catch {
    return defaultZoom;
  }
}

/**
 * Safely gets the current center from a map instance
 * @param map - MapLibre map instance
 * @param defaultCenter - Default value if map is null/undefined
 * @returns Current center as [lat, lng] or default
 */
export function safeGetCenter(
  map: MapLibreMap | null | undefined,
  defaultCenter: [number, number] = [51.505, -0.09]
): [number, number] {
  try {
    const center = map?.getCenter();
    if (center) {
      return [center.lat, center.lng];
    }
    return defaultCenter;
  } catch {
    return defaultCenter;
  }
}

/**
 * Safely gets the current bounds from a map instance
 * @param map - MapLibre map instance
 * @returns Current bounds or null
 */
export function safeGetBounds(map: MapLibreMap | null | undefined) {
  try {
    return map?.getBounds() ?? null;
  } catch {
    return null;
  }
}

/**
 * Safely jumps (no animation) to a view on a map instance
 * @param map - MapLibre map instance
 * @param center - Center coordinate [lat, lng]
 * @param zoom - Zoom level
 * @returns True if successful
 */
export function safeSetView(
  map: MapLibreMap | null | undefined,
  center: [number, number],
  zoom: number
): boolean {
  try {
    if (!map) return false;
    map.jumpTo({ center: toLngLat(center), zoom });
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely flies to a location on a map instance
 * @param map - MapLibre map instance
 * @param center - Center coordinate [lat, lng]
 * @param zoom - Zoom level
 * @returns True if successful
 */
export function safeFlyTo(
  map: MapLibreMap | null | undefined,
  center: [number, number],
  zoom: number
): boolean {
  try {
    if (!map) return false;
    map.flyTo({ center: toLngLat(center), zoom, essential: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely zooms in on a map instance
 * @param map - MapLibre map instance
 * @param delta - Zoom delta (default: 1)
 * @returns True if successful
 */
export function safeZoomIn(
  map: MapLibreMap | null | undefined,
  delta: number = 1
): boolean {
  try {
    if (!map) return false;
    map.zoomTo(map.getZoom() + delta);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely zooms out on a map instance
 * @param map - MapLibre map instance
 * @param delta - Zoom delta (default: 1)
 * @returns True if successful
 */
export function safeZoomOut(
  map: MapLibreMap | null | undefined,
  delta: number = 1
): boolean {
  try {
    if (!map) return false;
    map.zoomTo(map.getZoom() - delta);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely gets the position of a marker
 * @param marker - MapLibre marker instance
 * @param defaultPosition - Default position if marker is null/undefined
 * @returns Marker position as [lat, lng] or default
 */
export function safeGetMarkerPosition(
  marker: Marker | null | undefined,
  defaultPosition: [number, number] = [0, 0]
): [number, number] {
  try {
    const lngLat = marker?.getLngLat();
    if (lngLat) {
      return [lngLat.lat, lngLat.lng];
    }
    return defaultPosition;
  } catch {
    return defaultPosition;
  }
}

/**
 * Safely sets the position of a marker
 * @param marker - MapLibre marker instance
 * @param position - New position [lat, lng]
 * @returns True if successful
 */
export function safeSetMarkerPosition(
  marker: Marker | null | undefined,
  position: [number, number]
): boolean {
  try {
    if (!marker) return false;
    marker.setLngLat(toLngLat(position));
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely removes a marker from its map
 * @param marker - Marker to remove
 * @returns True if successful
 */
export function safeRemoveMarker(marker: Marker | null | undefined): boolean {
  try {
    if (!marker) return false;
    marker.remove();
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely adds a marker to a map
 * @param map - MapLibre map instance
 * @param marker - Marker to add
 * @returns True if successful
 */
export function safeAddMarker(
  map: MapLibreMap | null | undefined,
  marker: Marker | null | undefined
): boolean {
  try {
    if (!map || !marker) return false;
    marker.addTo(map);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely resizes the map canvas (useful after container resize)
 * @param map - MapLibre map instance
 * @returns True if successful
 */
export function safeResize(map: MapLibreMap | null | undefined): boolean {
  try {
    if (!map) return false;
    map.resize();
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely fits the map to bounds
 * @param map - MapLibre map instance
 * @param bounds - Bounds to fit (`[[west, south], [east, north]]` or LngLatBounds)
 * @param options - fitBounds options (padding, maxZoom, ...)
 * @returns True if successful
 */
export function safeFitBounds(
  map: MapLibreMap | null | undefined,
  bounds: LngLatBoundsLike | null | undefined,
  options?: FitBoundsOptions
): boolean {
  try {
    if (!map || !bounds) return false;
    map.fitBounds(bounds, options);
    return true;
  } catch {
    return false;
  }
}
