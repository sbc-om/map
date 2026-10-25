"use client";

/**
 * Imperative helpers for drawing taxi-specific layers on the shared Leaflet
 * map: pickup/destination markers, the route polyline, and live driver pins.
 *
 * Leaflet is imported dynamically (SSR-safe) and all layers are tracked in refs
 * so they can be updated or removed without recreating the map.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import type {
  LayerGroup,
  Map as LeafletMap,
  Marker,
  Polyline,
} from "leaflet";
import { useLeafletMap } from "./useLeafletMap";
import { animatePolylineDraw, glideMarker, stopGlide } from "@/lib/utils/map-motion";
import type { LatLng, VehicleType } from "@/types/taxi";

type LType = typeof import("leaflet");

type MarkerMotion = {
  location: LatLng;
  /** Geographic bearing of travel (north = 0, clockwise) */
  heading: number;
  /** Accumulated CSS rotation, so turns always take the short way round */
  rotation: number;
  /** When the location last changed, to pace the glide to the update rate */
  movedAt: number;
};

type CarOptions = { vehicle: VehicleType; self?: boolean; offline?: boolean };

/**
 * Fit padding that keeps framed content clear of the taxi UI: the side panel
 * on desktop, the bottom sheet on mobile.
 */
export function overlayPadding(): {
  paddingTopLeft: [number, number];
  paddingBottomRight: [number, number];
} {
  if (typeof window === "undefined" || window.innerWidth < 640) {
    const sheet = typeof window === "undefined" ? 300 : Math.round(window.innerHeight * 0.45);
    return { paddingTopLeft: [40, 80], paddingBottomRight: [40, sheet] };
  }
  return { paddingTopLeft: [440, 70], paddingBottomRight: [70, 70] };
}

/** Map centre that puts `point` in the middle of the area not covered by the UI. */
function visibleCenterFor(map: LeafletMap, point: LatLng, zoom: number) {
  const {
    paddingTopLeft: [left, top],
    paddingBottomRight: [right, bottom],
  } = overlayPadding();
  const projected = map
    .project([point.lat, point.lng], zoom)
    .subtract([(left - right) / 2, (top - bottom) / 2]);
  return map.unproject(projected, zoom);
}

/** True when `point` sits comfortably inside the area not covered by the UI. */
function inComfortZone(map: LeafletMap, point: LatLng) {
  const {
    paddingTopLeft: [left, top],
    paddingBottomRight: [right, bottom],
  } = overlayPadding();
  const size = map.getSize();
  const p = map.latLngToContainerPoint([point.lat, point.lng]);
  const marginX = (size.x - left - right) * 0.2;
  const marginY = (size.y - top - bottom) * 0.2;
  return (
    p.x >= left + marginX &&
    p.x <= size.x - right - marginX &&
    p.y >= top + marginY &&
    p.y <= size.y - bottom - marginY
  );
}

/** Glide pacing bounds: match the update interval so motion is continuous. */
const MIN_GLIDE_MS = 300;
const MAX_GLIDE_MS = 5200;

function calculateBearing(from: LatLng, to: LatLng) {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const deltaLng = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function hasMoved(previous: MarkerMotion | undefined, next: LatLng) {
  if (!previous) return false;
  // Ignore GPS noise / tiny simulation jitter to keep the car stable.
  return (
    Math.abs(next.lat - previous.location.lat) >= 0.00001 ||
    Math.abs(next.lng - previous.location.lng) >= 0.00001
  );
}

/** Next motion state for a car moving to `next`. */
function nextMotion(previous: MarkerMotion | undefined, next: LatLng): MarkerMotion {
  const now = Date.now();
  if (!previous) return { location: next, heading: 0, rotation: 0, movedAt: now };
  if (!hasMoved(previous, next)) return previous;

  const heading = calculateBearing(previous.location, next);
  const delta = ((heading - previous.heading + 540) % 360) - 180;
  return {
    location: next,
    heading,
    rotation: previous.rotation + delta,
    movedAt: now,
  };
}

function glideDuration(previous: MarkerMotion | undefined) {
  if (!previous) return MIN_GLIDE_MS;
  return Math.min(MAX_GLIDE_MS, Math.max(MIN_GLIDE_MS, Date.now() - previous.movedAt));
}

function applyMarkerRotation(marker: Marker, rotation: number) {
  const body = marker
    .getElement()
    ?.querySelector<HTMLElement>(".taxi-car-marker__body");
  // The car is drawn top-down facing north, so the bearing is the rotation.
  if (body) body.style.transform = `rotate(${rotation}deg)`;
}

const VEHICLE_STYLE: Record<
  VehicleType,
  { body: string; roof: string; width: number; length: number }
> = {
  taxi: { body: "#facc15", roof: "#eab308", width: 25, length: 46 },
  economy: { body: "#f8fafc", roof: "#cbd5e1", width: 25, length: 46 },
  comfort: { body: "#1e293b", roof: "#334155", width: 26, length: 48 },
  xl: { body: "#e2e8f0", roof: "#94a3b8", width: 27, length: 52 },
  bike: { body: "#f97316", roof: "#1f2937", width: 13, length: 33 },
};

/** Top-down vehicle drawing, nose pointing up (north). */
function vehicleSvg(vehicle: VehicleType) {
  const { body, roof, width: w, length: l } = VEHICLE_STYLE[vehicle];
  const outline = 'stroke="rgba(15,23,42,0.55)" stroke-width="1"';

  if (vehicle === "bike") {
    return `<svg width="${w}" height="${l}" viewBox="0 0 ${w} ${l}" aria-hidden="true">
      <rect x="4" y="0.5" width="4" height="7" rx="2" fill="#111827"/>
      <rect x="4" y="${l - 7.5}" width="4" height="7" rx="2" fill="#111827"/>
      <rect x="1.5" y="5" width="${w - 3}" height="${l - 10}" rx="${(w - 3) / 2}" fill="${body}" ${outline}/>
      <circle cx="${w / 2}" cy="${l * 0.55}" r="4.2" fill="${roof}" stroke="#fff" stroke-width="1"/>
      <rect x="0" y="${l * 0.3}" width="${w}" height="1.8" rx="0.9" fill="#111827"/>
    </svg>`;
  }

  const sign =
    vehicle === "taxi"
      ? `<rect x="${w * 0.3}" y="${l * 0.5}" width="${w * 0.4}" height="${l * 0.09}" rx="1" fill="#111827"/>
         <rect x="${w * 0.36}" y="${l * 0.52}" width="${w * 0.28}" height="${l * 0.05}" rx="0.5" fill="#fde047"/>`
      : "";

  return `<svg width="${w}" height="${l}" viewBox="0 0 ${w} ${l}" aria-hidden="true">
    <rect x="0.5" y="0.5" width="${w - 1}" height="${l - 1}" rx="${w * 0.36}" fill="${body}" ${outline}/>
    <rect x="${w * 0.14}" y="${l * 0.21}" width="${w * 0.72}" height="${l * 0.16}" rx="2.5" fill="#0f172a" opacity="0.82"/>
    <rect x="${w * 0.2}" y="${l * 0.39}" width="${w * 0.6}" height="${l * 0.33}" rx="3" fill="${roof}"/>
    <rect x="${w * 0.17}" y="${l * 0.74}" width="${w * 0.66}" height="${l * 0.1}" rx="2" fill="#0f172a" opacity="0.72"/>
    <rect x="${w * 0.12}" y="1.6" width="${w * 0.24}" height="2.4" rx="1.2" fill="#fef9c3"/>
    <rect x="${w * 0.64}" y="1.6" width="${w * 0.24}" height="2.4" rx="1.2" fill="#fef9c3"/>
    <rect x="${w * 0.12}" y="${l - 3.8}" width="${w * 0.24}" height="2.2" rx="1.1" fill="#ef4444"/>
    <rect x="${w * 0.64}" y="${l - 3.8}" width="${w * 0.24}" height="2.2" rx="1.1" fill="#ef4444"/>
    ${sign}
  </svg>`;
}

function carIcon(L: LType, { vehicle, self, offline }: CarOptions) {
  const classes = [
    "taxi-car-marker",
    self ? "taxi-car-marker--self" : "",
    offline ? "taxi-car-marker--offline" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return L.divIcon({
    className: classes,
    html: `<div class="taxi-car-marker__halo"></div>
      <div class="taxi-car-marker__body">${vehicleSvg(vehicle)}</div>`,
    iconSize: [60, 60],
    iconAnchor: [30, 30],
  });
}

function carKey({ vehicle, self, offline }: CarOptions) {
  return `${vehicle}:${self ? 1 : 0}:${offline ? 1 : 0}`;
}

/** True when a pin is new or moved, so re-renders of the same pin don't replay the drop. */
function pinMoved(previous: Marker | null, point: LatLng) {
  if (!previous) return true;
  const ll = previous.getLatLng();
  return Math.abs(ll.lat - point.lat) > 1e-6 || Math.abs(ll.lng - point.lng) > 1e-6;
}

function pinIcon(L: LType, color: string, glyph: string, animate = true) {
  return L.divIcon({
    className: animate ? "map-pin-drop" : "",
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:34px;height:34px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      background:${color};
      border:2px solid white;
      box-shadow:0 3px 10px rgba(0,0,0,0.4);
    "><span style="transform:rotate(45deg);font-size:15px;line-height:1;">${glyph}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}

export function useTaxiMap() {
  const map = useLeafletMap();
  const lRef = useRef<LType | null>(null);

  const pickupRef = useRef<Marker | null>(null);
  const destRef = useRef<Marker | null>(null);
  const routeRef = useRef<LayerGroup | null>(null);
  const driversRef = useRef<Map<string, Marker>>(new Map());
  const driverMotionRef = useRef<Map<string, MarkerMotion>>(new Map());
  const markerKeyRef = useRef<Map<string, string>>(new Map());
  const selfRef = useRef<Marker | null>(null);
  const selfMotionRef = useRef<MarkerMotion | null>(null);
  const selfKeyRef = useRef<string | null>(null);
  const selfDragEndRef = useRef<(() => void) | null>(null);

  const ensureL = useCallback(async (): Promise<LType | null> => {
    if (lRef.current) return lRef.current;
    if (typeof window === "undefined") return null;
    lRef.current = await import("leaflet");
    return lRef.current;
  }, []);

  const flyTo = useCallback(
    (point: LatLng, zoom = 15) => {
      if (!map) return;
      map.flyTo(visibleCenterFor(map, point, zoom), zoom, {
        duration: 1.1,
        easeLinearity: 0.2,
      });
    },
    [map]
  );

  const setPickup = useCallback(
    async (
      point: LatLng | null,
      opts?: {
        draggable?: boolean;
        onDragEnd?: (p: LatLng) => void;
        /**
         * Once the passenger is on board, drop the person glyph but keep the
         * pickup pin so the origin stays marked on the map.
         */
        boarded?: boolean;
      }
    ) => {
      const L = await ensureL();
      if (!map || !L) return;
      const animate = point ? pinMoved(pickupRef.current, point) : false;
      pickupRef.current?.remove();
      pickupRef.current = null;
      if (!point) return;

      const marker = L.marker([point.lat, point.lng], {
        icon: pinIcon(L, "#22c55e", opts?.boarded ? "" : "🧍", animate),
        draggable: opts?.draggable ?? false,
        zIndexOffset: 800,
      }).addTo(map);

      if (opts?.draggable && opts.onDragEnd) {
        marker.on("dragend", () => {
          const ll = marker.getLatLng();
          opts.onDragEnd?.({ lat: ll.lat, lng: ll.lng });
        });
      }
      pickupRef.current = marker;
    },
    [ensureL, map]
  );

  const setDestination = useCallback(
    async (
      point: LatLng | null,
      opts?: { draggable?: boolean; onDragEnd?: (p: LatLng) => void }
    ) => {
      const L = await ensureL();
      if (!map || !L) return;
      const animate = point ? pinMoved(destRef.current, point) : false;
      destRef.current?.remove();
      destRef.current = null;
      if (!point) return;

      const marker = L.marker([point.lat, point.lng], {
        icon: pinIcon(L, "#ef4444", "🏁", animate),
        draggable: opts?.draggable ?? false,
        zIndexOffset: 800,
      }).addTo(map);

      if (opts?.draggable && opts.onDragEnd) {
        marker.on("dragend", () => {
          const ll = marker.getLatLng();
          opts.onDragEnd?.({ lat: ll.lat, lng: ll.lng });
        });
      }
      destRef.current = marker;
    },
    [ensureL, map]
  );

  const drawRoute = useCallback(
    async (coordinates: [number, number][] | null, fit = true) => {
      const L = await ensureL();
      if (!map || !L) return;
      routeRef.current?.remove();
      routeRef.current = null;
      if (!coordinates || coordinates.length < 2) return;

      const outline = L.polyline(coordinates, {
        color: "#ffffff",
        weight: 8,
        opacity: 0.9,
      });
      const line: Polyline = L.polyline(coordinates, {
        color: "#fbbf24",
        weight: 5,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      });
      const group = L.layerGroup([outline, line]).addTo(map);
      routeRef.current = group;

      const reveal = () => {
        if (routeRef.current !== group) return;
        animatePolylineDraw(map, [outline, line]);
      };

      if (fit) {
        // Draw the route once the camera has settled on it; a zoom mid-draw
        // would change the path length and cut the animation short.
        group.eachLayer((l) => (l as Polyline).setStyle({ opacity: 0 }));
        map.flyToBounds(line.getBounds(), { ...overlayPadding(), duration: 0.9 });
        map.once("moveend", () => {
          outline.setStyle({ opacity: 0.9 });
          line.setStyle({ opacity: 0.95 });
          reveal();
        });
      } else {
        reveal();
      }
    },
    [ensureL, map]
  );

  /** Render/update a set of driver cars keyed by driver id. */
  const setDrivers = useCallback(
    async (
      drivers: Array<{ id: string; location: LatLng; vehicle?: VehicleType }>
    ) => {
      const L = await ensureL();
      if (!map || !L) return;

      const next = new Set(drivers.map((d) => d.id));
      // Remove stale markers
      for (const [driverId, marker] of driversRef.current) {
        if (!next.has(driverId)) {
          stopGlide(marker);
          marker.remove();
          driversRef.current.delete(driverId);
          driverMotionRef.current.delete(driverId);
          markerKeyRef.current.delete(driverId);
        }
      }
      // Add or move current markers
      for (const d of drivers) {
        const car: CarOptions = { vehicle: d.vehicle ?? "taxi" };
        const key = carKey(car);
        const previous = driverMotionRef.current.get(d.id);
        const motion = nextMotion(previous, d.location);
        const existing = driversRef.current.get(d.id);

        if (existing) {
          if (motion !== previous) {
            glideMarker(existing, [d.location.lat, d.location.lng], {
              durationMs: glideDuration(previous),
              easing: "linear",
            });
          }
          // Keep the icon in sync with the driver's chosen vehicle type.
          if (markerKeyRef.current.get(d.id) !== key) {
            existing.setIcon(carIcon(L, car));
            markerKeyRef.current.set(d.id, key);
          }
          applyMarkerRotation(existing, motion.rotation);
        } else {
          const marker = L.marker([d.location.lat, d.location.lng], {
            icon: carIcon(L, car),
            zIndexOffset: 600,
            keyboard: false,
          }).addTo(map);
          markerKeyRef.current.set(d.id, key);
          applyMarkerRotation(marker, motion.rotation);
          driversRef.current.set(d.id, marker);
        }

        driverMotionRef.current.set(d.id, motion);
      }
    },
    [ensureL, map]
  );

  /**
   * The driver's own car. Optionally draggable so the driver can set or
   * fine-tune their position by hand; updates in place to keep movement
   * smooth. With `follow`, the camera pans to keep the car in view.
   */
  const setSelfDriver = useCallback(
    async (
      point: LatLng | null,
      opts?: {
        draggable?: boolean;
        onDragEnd?: (p: LatLng) => void;
        vehicle?: VehicleType;
        offline?: boolean;
        follow?: boolean;
      }
    ) => {
      const L = await ensureL();
      if (!map || !L) return;
      if (!point) {
        if (selfRef.current) stopGlide(selfRef.current);
        selfRef.current?.remove();
        selfRef.current = null;
        selfMotionRef.current = null;
        selfKeyRef.current = null;
        return;
      }

      const car: CarOptions = {
        vehicle: opts?.vehicle ?? "taxi",
        self: true,
        offline: opts?.offline,
      };
      const key = carKey(car);
      const previous = selfMotionRef.current ?? undefined;
      const motion = nextMotion(previous, point);

      let marker = selfRef.current;
      if (marker) {
        if (motion !== previous) {
          glideMarker(marker, [point.lat, point.lng], {
            durationMs: glideDuration(previous),
            easing: "linear",
          });
        }
        if (selfKeyRef.current !== key) {
          marker.setIcon(carIcon(L, car));
          selfKeyRef.current = key;
        }
        if (opts?.draggable) marker.dragging?.enable();
        else marker.dragging?.disable();
      } else {
        marker = L.marker([point.lat, point.lng], {
          icon: carIcon(L, car),
          draggable: opts?.draggable ?? false,
          zIndexOffset: 1000,
          keyboard: false,
        }).addTo(map);
        selfRef.current = marker;
        selfKeyRef.current = key;
      }
      applyMarkerRotation(marker, motion.rotation);
      selfMotionRef.current = motion;

      // Rebind so the latest callback is used, not the one from creation time.
      if (selfDragEndRef.current) marker.off("dragend", selfDragEndRef.current);
      selfDragEndRef.current = null;
      if (opts?.onDragEnd) {
        const target = marker;
        const onDragEnd = opts.onDragEnd;
        const handler = () => {
          const ll = target.getLatLng();
          onDragEnd({ lat: ll.lat, lng: ll.lng });
        };
        marker.on("dragend", handler);
        selfDragEndRef.current = handler;
      }

      if (opts?.follow && !inComfortZone(map, point)) {
        map.panTo(visibleCenterFor(map, point, map.getZoom()), {
          animate: true,
          duration: 0.8,
          easeLinearity: 0.25,
        });
      }
    },
    [ensureL, map]
  );

  const clearAll = useCallback(() => {
    pickupRef.current?.remove();
    destRef.current?.remove();
    routeRef.current?.remove();
    pickupRef.current = null;
    destRef.current = null;
    routeRef.current = null;
    if (selfRef.current) stopGlide(selfRef.current);
    selfRef.current?.remove();
    selfRef.current = null;
    selfMotionRef.current = null;
    selfKeyRef.current = null;
    selfDragEndRef.current = null;
    driversRef.current.forEach((m) => {
      stopGlide(m);
      m.remove();
    });
    driversRef.current.clear();
    driverMotionRef.current.clear();
    markerKeyRef.current.clear();
  }, []);

  // Clean up all layers on unmount.
  useEffect(() => clearAll, [clearAll]);

  // Memoise the returned API so consumers get a stable reference. Without this,
  // a fresh object each render would re-trigger effects that depend on it
  // (e.g. the route/fare calculation), causing repeated OSRM requests.
  return useMemo(
    () => ({
      map: map as LeafletMap | null,
      flyTo,
      setPickup,
      setDestination,
      drawRoute,
      setDrivers,
      setSelfDriver,
      clearAll,
    }),
    [map, flyTo, setPickup, setDestination, drawRoute, setDrivers, setSelfDriver, clearAll]
  );
}
