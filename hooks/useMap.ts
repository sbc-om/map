'use client';

import { useContext } from 'react';
import { MapContext } from '@/contexts/MapContext';
import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * Access the shared MapLibre map instance from MapContext.
 *
 * @returns the map once its first style has loaded, otherwise null
 * @throws Error if used outside MapProvider
 */
export function useMap(): MapLibreMap | null {
  const context = useContext(MapContext);

  if (context === undefined) {
    throw new Error('useMap must be used within a MapProvider');
  }

  return context.map;
}
