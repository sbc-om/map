/**
 * Map-related TypeScript type definitions
 */

import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';

/**
 * Map configuration options
 */
export interface MapConfig {
  defaultCenter: [number, number];
  defaultZoom: number;
  minZoom: number;
  maxZoom: number;
  zoomControl: boolean;
  attributionControl: boolean;
}

/**
 * Basemap style option
 */
export interface MapStyleOption {
  id: string;
  name: string;
  /** Style URL or inline style document */
  style: string | StyleSpecification;
  category: 'standard' | 'satellite' | 'dark' | 'custom';
}

/**
 * Map context value type
 */
export interface MapContextValue {
  map: MapLibreMap | null;
  setMap: (map: MapLibreMap | null) => void;
  isReady: boolean;
  error: Error | null;
  isInitializing: boolean;
  setMapError: (error: Error | null) => void;
  startInitializing: () => void;
}

/**
 * Coordinate tuple type
 */
export type Coordinate = [number, number];

/**
 * Bounds type
 */
export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}
