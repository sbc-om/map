/**
 * Motion helpers for Leaflet layers.
 *
 * Positions are interpolated in geographic space with requestAnimationFrame,
 * so animated markers stay glued to their coordinates while the map pans or
 * zooms (CSS transitions on Leaflet's transforms cannot guarantee that).
 */

import type { Map as LeafletMap, Marker, Polyline } from "leaflet";

/** Moves farther than this (degrees, ~3 km) jump instead of gliding across the map. */
const MAX_GLIDE_DEGREES = 0.03;

type Glide = { frame: number; to: [number, number] };

const activeGlides = new WeakMap<Marker, Glide>();

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/**
 * Smoothly move a marker to `to`. A new call cancels the glide in progress
 * and continues from wherever the marker currently is, so frequent GPS
 * updates blend into one continuous motion. Use `linear` easing for live
 * tracking (constant speed between updates) and the default ease for
 * one-off moves.
 */
export function glideMarker(
  marker: Marker,
  to: [number, number],
  { durationMs = 900, easing = "ease" }: { durationMs?: number; easing?: "ease" | "linear" } = {}
) {
  const pending = activeGlides.get(marker);
  // Already heading there: restarting would only slow the car down
  if (pending && pending.to[0] === to[0] && pending.to[1] === to[1]) return;
  if (pending) cancelAnimationFrame(pending.frame);

  const from = marker.getLatLng();
  const dLat = to[0] - from.lat;
  const dLng = to[1] - from.lng;
  const tooFar = Math.abs(dLat) > MAX_GLIDE_DEGREES || Math.abs(dLng) > MAX_GLIDE_DEGREES;
  const isDragging =
    marker.getElement()?.classList.contains("leaflet-drag-target") ?? false;

  if (tooFar || isDragging || prefersReducedMotion()) {
    activeGlides.delete(marker);
    marker.setLatLng(to);
    return;
  }

  const ease = easing === "linear" ? (t: number) => t : easeInOutSine;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    const k = ease(t);
    marker.setLatLng([from.lat + dLat * k, from.lng + dLng * k]);
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

/**
 * Animate SVG polylines so they draw themselves from start to end. Must be
 * called after the lines are added to `map`. The dash styles are removed
 * when the animation ends (or a zoom re-renders the path) so later redraws
 * are unaffected.
 */
export function animatePolylineDraw(map: LeafletMap, lines: Polyline[], durationMs = 1100) {
  if (prefersReducedMotion()) return;

  for (const line of lines) {
    const path = line.getElement() as SVGPathElement | undefined;
    if (!path || typeof path.getTotalLength !== "function") continue;

    const length = path.getTotalLength();
    if (!length) continue;

    const reset = () => {
      clearTimeout(timer);
      map.off("zoomstart", reset);
      path.style.transition = "";
      path.style.strokeDasharray = "";
      path.style.strokeDashoffset = "";
    };

    path.style.transition = "none";
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    // Force a style flush so the transition starts from the hidden state
    path.getBoundingClientRect();
    path.style.transition = `stroke-dashoffset ${durationMs}ms cubic-bezier(0.65, 0, 0.35, 1)`;
    path.style.strokeDashoffset = "0";

    const timer = setTimeout(reset, durationMs + 50);
    // A zoom changes the path length mid-animation; finish instantly instead
    map.on("zoomstart", reset);
    line.once("remove", reset);
  }
}
