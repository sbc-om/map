'use client';

import { useCallback } from 'react';
import { useMap } from './useMap';
import { toLngLat } from '@/lib/map/geo';
import type { FitBoundsOptions, LngLatBounds, LngLatBoundsLike } from 'maplibre-gl';

/**
 * Hook providing safe map operations with null checks and error handling
 * 
 * All operations are wrapped in try-catch and return success/failure status.
 * This prevents crashes from map operations when the map is not ready.
 * 
 * @returns Object with safe map operation functions
 */
export function useSafeMapOperations() {
  const map = useMap();

  /**
   * Safely get current zoom level
   */
  const getZoom = useCallback((defaultZoom: number = 13): number => {
    try {
      return map?.getZoom() ?? defaultZoom;
    } catch {
      return defaultZoom;
    }
  }, [map]);

  /**
   * Safely get current center
   */
  const getCenter = useCallback((defaultCenter: [number, number] = [0, 0]): [number, number] => {
    try {
      const center = map?.getCenter();
      if (center) {
        return [center.lat, center.lng];
      }
      return defaultCenter;
    } catch {
      return defaultCenter;
    }
  }, [map]);

  /**
   * Safely get current bounds
   */
  const getBounds = useCallback((): LngLatBounds | null => {
    try {
      return map?.getBounds() ?? null;
    } catch {
      return null;
    }
  }, [map]);

  /**
   * Safely set view (instant jump, no animation). Center is [lat, lng].
   */
  const setView = useCallback((center: [number, number], zoom: number): boolean => {
    try {
      if (!map) return false;
      map.jumpTo({ center: toLngLat(center), zoom });
      return true;
    } catch {
      return false;
    }
  }, [map]);

  /**
   * Safely fly to location. Center is [lat, lng].
   */
  const flyTo = useCallback((center: [number, number], zoom: number): boolean => {
    try {
      if (!map) return false;
      map.flyTo({ center: toLngLat(center), zoom, essential: true });
      return true;
    } catch {
      return false;
    }
  }, [map]);

  /**
   * Safely fit bounds
   */
  const fitBounds = useCallback((bounds: LngLatBoundsLike, options?: FitBoundsOptions): boolean => {
    try {
      if (!map || !bounds) return false;
      map.fitBounds(bounds, options);
      return true;
    } catch {
      return false;
    }
  }, [map]);

  /**
   * Safely zoom in
   */
  const zoomIn = useCallback((delta: number = 1): boolean => {
    try {
      if (!map) return false;
      map.zoomTo(map.getZoom() + delta);
      return true;
    } catch {
      return false;
    }
  }, [map]);

  /**
   * Safely zoom out
   */
  const zoomOut = useCallback((delta: number = 1): boolean => {
    try {
      if (!map) return false;
      map.zoomTo(map.getZoom() - delta);
      return true;
    } catch {
      return false;
    }
  }, [map]);

  /**
   * Safely resize the map canvas (useful after container resize)
   */
  const resize = useCallback((): boolean => {
    try {
      if (!map) return false;
      map.resize();
      return true;
    } catch {
      return false;
    }
  }, [map]);

  /**
   * Safely pan to location. Center is [lat, lng].
   */
  const panTo = useCallback((center: [number, number]): boolean => {
    try {
      if (!map) return false;
      map.panTo(toLngLat(center));
      return true;
    } catch {
      return false;
    }
  }, [map]);

  return {
    map,
    isReady: !!map,
    getZoom,
    getCenter,
    getBounds,
    setView,
    flyTo,
    fitBounds,
    zoomIn,
    zoomOut,
    resize,
    panTo,
  };
}
