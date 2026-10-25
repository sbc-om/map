/**
 * Motion helpers for MapLibre markers.
 *
 * Positions are interpolated in geographic space with requestAnimationFrame,
 * so animated markers stay glued to their coordinates while the map pans or
 * zooms. Positions use the app's `[lat, lng]` order.
 */

import type { Marker } from "maplibre-gl";

/** Moves farther than this (degrees, ~3 km) jump instead of gliding across the map. */
const MAX_GLIDE_DEGREES = 0.03;

type Glide = { frame: number; to: [number, number] };

const activeGlides = new WeakMap<Marker, Glide>();
const dragging = new WeakSet<Marker>();
const tracked = new WeakSet<Marker>();

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/** Never fight the user's finger: glides are skipped while a marker is dragged. */
function trackDragging(marker: Marker) {
  if (tracked.has(marker)) return;
  tracked.add(marker);
  marker.on("dragstart", () => {
    stopGlide(marker);
    dragging.add(marker);
  });
  marker.on("dragend", () => dragging.delete(marker));
}

/**
 * Smoothly move a marker to `to` (`[lat, lng]`). A new call cancels the glide
 * in progress and continues from wherever the marker currently is, so frequent
 * GPS updates blend into one continuous motion. Use `linear` easing for live
 * tracking (constant speed between updates) and the default ease for one-off
 * moves.
 */
export function glideMarker(
  marker: Marker,
  to: [number, number],
  { durationMs = 900, easing = "ease" }: { durationMs?: number; easing?: "ease" | "linear" } = {}
) {
  trackDragging(marker);
  const pending = activeGlides.get(marker);
  // Already heading there: restarting would only slow the car down
  if (pending && pending.to[0] === to[0] && pending.to[1] === to[1]) return;
  if (pending) cancelAnimationFrame(pending.frame);

  const from = marker.getLngLat();
  const dLat = to[0] - from.lat;
  const dLng = to[1] - from.lng;
  const tooFar = Math.abs(dLat) > MAX_GLIDE_DEGREES || Math.abs(dLng) > MAX_GLIDE_DEGREES;

  if (dragging.has(marker)) return;
  if (tooFar || prefersReducedMotion()) {
    activeGlides.delete(marker);
    marker.setLngLat([to[1], to[0]]);
    return;
  }

  const ease = easing === "linear" ? (t: number) => t : easeInOutSine;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    const k = ease(t);
    marker.setLngLat([from.lng + dLng * k, from.lat + dLat * k]);
    if (t < 1) {
      activeGlides.set(marker, { frame: requestAnimationFrame(step), to });
    } else {
      activeGlides.delete(marker);
    }
  };
  activeGlides.set(marker, { frame: requestAnimationFrame(step), to });
}

/** Stop any glide in progress (call before removing a marker). */
export function stopGlide(marker: Marker) {
  const pending = activeGlides.get(marker);
  if (pending) cancelAnimationFrame(pending.frame);
  activeGlides.delete(marker);
}
