'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useMap } from './useMap';
import { calculateDistance as calculateDistanceUtil } from '@/lib/utils/coordinates';
import { setOverlay, removeOverlay, featureCollection } from '@/lib/map/overlays';
import type { MapMouseEvent } from 'maplibre-gl';

export type MeasurementMode = 'distance' | 'area' | null;

interface MeasurementPoint {
  latlng: { lat: number; lng: number };
}

const OVERLAY_ID = 'measurement';

/** Polygon fill/outline, dashed distance line and vertex dots (same look as before the MapLibre switch). */
const OVERLAY_LAYERS = [
  {
    id: 'fill',
    type: 'fill' as const,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.2 },
  },
  {
    id: 'outline',
    type: 'line' as const,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'line-color': '#3b82f6', 'line-width': 2, 'line-opacity': 0.7 },
  },
  {
    id: 'line',
    type: 'line' as const,
    filter: ['==', ['geometry-type'], 'LineString'],
    // Dash lengths are in line widths: 10px dash / 10px gap at width 3
    paint: {
      'line-color': '#3b82f6',
      'line-width': 3,
      'line-opacity': 0.7,
      'line-dasharray': [3.3, 3.3],
    },
  },
  {
    id: 'points',
    type: 'circle' as const,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 6,
      'circle-color': '#3b82f6',
      'circle-opacity': 0.8,
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  },
];

/**
 * Hook for map measurement functionality
 * Supports distance and area measurements
 *
 * Features:
 * - Proper event handler cleanup (stores reference to specific handler)
 * - Everything is drawn as one GeoJSON overlay, so it survives basemap switches
 * - Uses shared utility for distance calculation (no duplication)
 *
 * @returns Object with measurement functions and state
 */
export function useMeasurement() {
  const map = useMap();
  const [mode, setMode] = useState<MeasurementMode>(null);
  const [points, setPoints] = useState<MeasurementPoint[]>([]);
  const [distance, setDistance] = useState<number>(0);
  const [area, setArea] = useState<number>(0);

  // Store click handler reference for proper cleanup
  const clickHandlerRef = useRef<((e: MapMouseEvent) => void) | null>(null);
  // Latest points, read by the map click handler between renders
  const pointsRef = useRef<MeasurementPoint[]>([]);
  // Mode of the drawing on screen; kept after finish so undo still redraws it
  const drawModeRef = useRef<MeasurementMode>(null);

  /**
   * Calculate total distance for all points
   */
  const calculateTotalDistance = useCallback((pts: MeasurementPoint[]): number => {
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      total += calculateDistanceUtil(
        [pts[i].latlng.lat, pts[i].latlng.lng],
        [pts[i + 1].latlng.lat, pts[i + 1].latlng.lng]
      );
    }
    return total;
  }, []);

  /**
   * Calculate area using Shoelace formula
   */
  const calculateArea = useCallback((pts: MeasurementPoint[]): number => {
    if (pts.length < 3) return 0;

    const R = 6371e3; // Earth's radius in meters
    let area = 0;

    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      const xi = pts[i].latlng.lng * Math.PI / 180;
      const yi = pts[i].latlng.lat * Math.PI / 180;
      const xj = pts[j].latlng.lng * Math.PI / 180;
      const yj = pts[j].latlng.lat * Math.PI / 180;

      area += xi * Math.sin(yj) - xj * Math.sin(yi);
    }

    area = Math.abs(area * R * R / 2);
    return area;
  }, []);

  /**
   * Redraw the overlay and recompute totals for a point list
   */
  const applyPoints = useCallback((pts: MeasurementPoint[], measurementMode: MeasurementMode) => {
    if (!map) return;

    const coords = pts.map((p): [number, number] => [p.latlng.lng, p.latlng.lat]);
    const features: GeoJSON.Feature[] = coords.map((c) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: c },
    }));

    if (measurementMode === 'distance' && pts.length > 1) {
      features.unshift({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      });
      setDistance(calculateTotalDistance(pts));
    } else if (measurementMode === 'distance') {
      setDistance(0);
    }

    if (measurementMode === 'area' && pts.length > 2) {
      features.unshift({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [[...coords, coords[0]]] },
      });
      setArea(calculateArea(pts));
    } else if (measurementMode === 'area') {
      setArea(0);
    }

    // Draw above labels so the vertices stay clickable-looking and visible
    setOverlay(map, OVERLAY_ID, featureCollection(features), OVERLAY_LAYERS, {
      belowLabels: false,
    });
  }, [map, calculateTotalDistance, calculateArea]);

  /**
   * Clear measurement - removes only OUR click handler, not all handlers
   * NOTE: Defined before startMeasurement to avoid reference issues
   */
  const clearMeasurement = useCallback(() => {
    if (!map) return;

    removeOverlay(map, OVERLAY_ID);

    // Remove ONLY our click handler (not all click handlers)
    if (clickHandlerRef.current) {
      map.off('click', clickHandlerRef.current);
      clickHandlerRef.current = null;
    }

    map.getCanvas().style.cursor = '';

    pointsRef.current = [];
    drawModeRef.current = null;
    setPoints([]);
    setDistance(0);
    setArea(0);
    setMode(null);
  }, [map]);

  /**
   * Start measurement mode
   */
  const startMeasurement = useCallback((measurementMode: MeasurementMode) => {
    if (!map || !measurementMode) return;

    // Clear previous measurement first
    clearMeasurement();

    setMode(measurementMode);
    drawModeRef.current = measurementMode;

    // Create click handler and store reference for proper cleanup
    const handleMapClick = (e: MapMouseEvent) => {
      const updated = [...pointsRef.current, { latlng: { lat: e.lngLat.lat, lng: e.lngLat.lng } }];
      pointsRef.current = updated;
      setPoints(updated);
      applyPoints(updated, measurementMode);
    };

    // Store handler reference for cleanup
    clickHandlerRef.current = handleMapClick;
    map.on('click', handleMapClick);
    map.getCanvas().style.cursor = 'crosshair';
  }, [map, clearMeasurement, applyPoints]);

  /**
   * Undo last point
   */
  const undoLastPoint = useCallback(() => {
    if (pointsRef.current.length === 0) return;

    const updated = pointsRef.current.slice(0, -1);
    pointsRef.current = updated;
    setPoints(updated);
    applyPoints(updated, drawModeRef.current);
  }, [applyPoints]);

  /**
   * Finish measurement (close polygon for area)
   */
  const finishMeasurement = useCallback(() => {
    if (!map) return;

    // Remove ONLY our click handler
    if (clickHandlerRef.current) {
      map.off('click', clickHandlerRef.current);
      clickHandlerRef.current = null;
    }

    map.getCanvas().style.cursor = '';
    setMode(null);
  }, [map]);

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (map && clickHandlerRef.current) {
        map.off('click', clickHandlerRef.current);
        clickHandlerRef.current = null;
      }
      // Clean up any remaining drawing
      if (map) removeOverlay(map, OVERLAY_ID);
    };
  }, [map]);

  return {
    mode,
    points,
    distance,
    area,
    startMeasurement,
    clearMeasurement,
    undoLastPoint,
    finishMeasurement,
    isActive: mode !== null,
    pointCount: points.length,
  };
}
