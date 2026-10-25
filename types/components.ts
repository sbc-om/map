/**
 * Component prop type definitions
 */

import type { ReactNode } from 'react';
import type { StyleSpecification } from 'maplibre-gl';

/**
 * MapView component props
 */
export interface MapViewProps {
  /** Basemap style URL or inline style document */
  mapStyle: string | StyleSpecification;
  /** `[lat, lng]` */
  center?: [number, number];
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  className?: string;
  children?: ReactNode;
  onClick?: (lat: number, lng: number) => void;
  onMouseMove?: (lat: number, lng: number) => void;
  /** CSS cursor over the map canvas; defaults to MapLibre's grab cursor */
  cursorStyle?: string;
}

/**
 * DockContainer component props
 */
export interface DockContainerProps {
  children: ReactNode;
  position?: 'bottom' | 'top';
  className?: string;
}

/**
 * DockButton component props
 */
export interface DockButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

/**
 * Base map option for chooser
 */
export interface BaseMapOption {
  id: string;
  name: string;
  url: string;
  attribution: string;
  preview?: string;
}

/**
 * BaseMapChooser component props
 */
export interface BaseMapChooserProps {
  options: BaseMapOption[];
  activeId: string;
  onChange: (id: string) => void;
}
