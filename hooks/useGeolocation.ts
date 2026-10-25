'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useMap } from './useMap';
import { maplibre } from '@/lib/map/maplibre';
import { setOverlay, removeOverlay } from '@/lib/map/overlays';
import type { Marker } from 'maplibre-gl';

const ACCURACY_OVERLAY_ID = 'user-location-accuracy';

/** Polygon approximating a circle of `radius` metres around a point. */
function circlePolygon(lat: number, lng: number, radius: number, steps = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const R = 6371008.8;
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (radius * Math.cos(angle)) / R;
    const dLng = (radius * Math.sin(angle)) / (R * Math.cos((lat * Math.PI) / 180));
    coords.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}

/**
 * Custom hook for geolocation functionality
 *
 * Provides a reusable way to locate user's position on the map
 * and add a marker at their location.
 *
 * Features:
 * - Uses the browser Geolocation API, then flies the map to the fix
 * - Accuracy circle drawn as a map overlay (survives basemap switches)
 * - Tracks the location marker for cleanup
 *
 * @returns Object with locate function and loading state
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { locateUser, isLocating } = useGeolocation();
 *
 *   return (
 *     <button onClick={locateUser} disabled={isLocating}>
 *       {isLocating ? 'Locating...' : 'Find Me'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useGeolocation() {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);

  // Store references for cleanup
  const locationMarkerRef = useRef<Marker | null>(null);
  // Ignore fixes that arrive after unmount or a newer request
  const requestIdRef = useRef(0);

  // Cleanup function for location markers
  const clearLocationMarkers = useCallback(() => {
    if (map) removeOverlay(map, ACCURACY_OVERLAY_ID);
    if (locationMarkerRef.current) {
      locationMarkerRef.current.remove();
      locationMarkerRef.current = null;
    }
  }, [map]);

  const locateUser = useCallback(() => {
    if (!map) {
      console.warn('Map instance not available');
      return;
    }
    if (!navigator.geolocation) {
      toast.error('Unable to find your location. Please check your browser permissions.');
      return;
    }

    // Clean up previous markers
    clearLocationMarkers();

    setIsLocating(true);
    const requestId = ++requestIdRef.current;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (requestId !== requestIdRef.current) return;
        setIsLocating(false);

        const { latitude: lat, longitude: lng, accuracy } = pos.coords;

        // Clear any existing markers first
        clearLocationMarkers();

        // Add accuracy circle
        const circle = circlePolygon(lat, lng, accuracy / 2);
        setOverlay(map, ACCURACY_OVERLAY_ID, circle, [
          {
            id: 'fill',
            type: 'fill',
            paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.2 },
          },
          {
            id: 'outline',
            type: 'line',
            paint: { 'line-color': '#3b82f6', 'line-width': 3, 'line-opacity': 1 },
          },
        ]);

        // Add location marker
        const el = document.createElement('div');
        el.className = 'custom-location-marker';
        el.style.cssText =
          'width: 16px; height: 16px; background: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);';
        locationMarkerRef.current = new (maplibre().Marker)({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map);

        // Frame the accuracy circle, never closer than street level (z16)
        const ring = circle.geometry.coordinates[0];
        const lngs = ring.map((c) => c[0]);
        const lats = ring.map((c) => c[1]);
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { maxZoom: 16, padding: 40 }
        );
      },
      (err) => {
        if (requestId !== requestIdRef.current) return;
        setIsLocating(false);
        console.error('Location error:', err.message);
        toast.error('Unable to find your location. Please check your browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [map, clearLocationMarkers]);

  // Cleanup on unmount
  useEffect(() => {
    const requests = requestIdRef;
    return () => {
      requests.current++;
      clearLocationMarkers();
    };
  }, [clearLocationMarkers]);

  return {
    locateUser,
    isLocating,
    isAvailable: !!map,
    clearLocationMarkers,
  };
}
