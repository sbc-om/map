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
import type { LatLng } from "@/types/taxi";

type LType = typeof import("leaflet");

function pinIcon(L: LType, color: string, glyph: string) {
  return L.divIcon({
    className: "",
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

function carIcon(L: LType) {
  return L.divIcon({
    className: "taxi-car-marker",
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:44px;height:44px;
      font-size:34px;line-height:1;
      filter:drop-shadow(0 2px 4px rgba(0,0,0,0.55));
    ">🚕</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

export function useTaxiMap() {
  const map = useLeafletMap();
  const lRef = useRef<LType | null>(null);

  const pickupRef = useRef<Marker | null>(null);
  const destRef = useRef<Marker | null>(null);
  const routeRef = useRef<LayerGroup | null>(null);
  const driversRef = useRef<Map<string, Marker>>(new Map());
  const selfRef = useRef<Marker | null>(null);

  const ensureL = useCallback(async (): Promise<LType | null> => {
    if (lRef.current) return lRef.current;
    if (typeof window === "undefined") return null;
    lRef.current = await import("leaflet");
    return lRef.current;
  }, []);

  const flyTo = useCallback(
    (point: LatLng, zoom = 15) => {
      map?.flyTo([point.lat, point.lng], zoom, { animate: true, duration: 1 });
    },
    [map]
  );

  const setPickup = useCallback(
    async (
      point: LatLng | null,
      opts?: { draggable?: boolean; onDragEnd?: (p: LatLng) => void }
    ) => {
      const L = await ensureL();
      if (!map || !L) return;
      pickupRef.current?.remove();
      pickupRef.current = null;
      if (!point) return;

      const marker = L.marker([point.lat, point.lng], {
        icon: pinIcon(L, "#22c55e", "🧍"),
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
      destRef.current?.remove();
      destRef.current = null;
      if (!point) return;

      const marker = L.marker([point.lat, point.lng], {
        icon: pinIcon(L, "#ef4444", "🏁"),
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

      if (fit) {
        map.fitBounds(line.getBounds(), { padding: [70, 70], animate: true });
      }
    },
    [ensureL, map]
  );

  /** Render/update a set of driver pins keyed by driver id. */
  const setDrivers = useCallback(
    async (drivers: Array<{ id: string; location: LatLng }>) => {
      const L = await ensureL();
      if (!map || !L) return;

      const next = new Set(drivers.map((d) => d.id));
      // Remove stale markers
      for (const [driverId, marker] of driversRef.current) {
        if (!next.has(driverId)) {
          marker.remove();
          driversRef.current.delete(driverId);
        }
      }
      // Add or move current markers
      for (const d of drivers) {
        const existing = driversRef.current.get(d.id);
        if (existing) {
          existing.setLatLng([d.location.lat, d.location.lng]);
        } else {
          const marker = L.marker([d.location.lat, d.location.lng], {
            icon: carIcon(L),
            zIndexOffset: 600,
          }).addTo(map);
          driversRef.current.set(d.id, marker);
        }
      }
    },
    [ensureL, map]
  );

  /**
   * The driver's own car marker. Optionally draggable so the driver can set or
   * fine-tune their position by hand; updates in place to keep movement smooth.
   */
  const setSelfDriver = useCallback(
    async (
      point: LatLng | null,
      opts?: { draggable?: boolean; onDragEnd?: (p: LatLng) => void }
    ) => {
      const L = await ensureL();
      if (!map || !L) return;
      if (!point) {
        selfRef.current?.remove();
        selfRef.current = null;
        return;
      }
      const existing = selfRef.current;
      if (existing) {
        existing.setLatLng([point.lat, point.lng]);
        if (opts?.draggable) existing.dragging?.enable();
        else existing.dragging?.disable();
        return;
      }
      const marker = L.marker([point.lat, point.lng], {
        icon: carIcon(L),
        draggable: opts?.draggable ?? false,
        zIndexOffset: 1000,
      }).addTo(map);
      if (opts?.draggable && opts.onDragEnd) {
        marker.on("dragend", () => {
          const ll = marker.getLatLng();
          opts.onDragEnd?.({ lat: ll.lat, lng: ll.lng });
        });
      }
      selfRef.current = marker;
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
    selfRef.current?.remove();
    selfRef.current = null;
    driversRef.current.forEach((m) => m.remove());
    driversRef.current.clear();
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
