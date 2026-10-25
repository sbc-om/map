'use client';

import { useState, useCallback, useEffect } from 'react';
import { useMap } from './useMap';
import type { MapMouseEvent, MapTouchEvent, PointLike } from 'maplibre-gl';

export interface ContextMenuPosition {
  x: number;
  y: number;
  latlng: {
    lat: number;
    lng: number;
  };
}

export interface UseMapContextMenuReturn {
  isOpen: boolean;
  position: ContextMenuPosition | null;
  close: () => void;
}

/** Touch hold duration that opens the menu (iOS never fires `contextmenu`). */
const LONG_PRESS_MS = 550;
/** Finger movement (px) that cancels a long-press. */
const LONG_PRESS_TOLERANCE = 8;

/**
 * Hook for managing map context menu (right-click / long-press menu)
 *
 * Features:
 * - Proper event handler cleanup
 * - Prevents default browser context menu on map
 * - Long-press on touch screens opens the same menu
 * - Tracks click position in both screen and map coordinates
 * - Closes on map click, scroll, or escape key
 *
 * @returns Object with context menu state and controls
 */
export function useMapContextMenu(): UseMapContextMenuReturn {
  const map = useMap();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<ContextMenuPosition | null>(null);

  /**
   * Close the context menu
   */
  const close = useCallback(() => {
    setIsOpen(false);
    setPosition(null);
  }, []);

  /**
   * Handle escape key to close menu
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, close]);

  /**
   * Setup context menu event handlers
   */
  useEffect(() => {
    if (!map) return;

    // Android fires both a native contextmenu and our long-press; open once,
    // and ignore the click that some browsers synthesise after a long hold.
    let openedAt = 0;
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let pressStart: { x: number; y: number } | null = null;

    const openAt = (point: { x: number; y: number }, lngLat: { lat: number; lng: number }) => {
      if (Date.now() - openedAt < 700) return;
      openedAt = Date.now();
      setPosition({
        x: point.x,
        y: point.y,
        latlng: { lat: lngLat.lat, lng: lngLat.lng },
      });
      setIsOpen(true);
    };

    // Context menu handler (right-click)
    const handleContextMenu = (e: MapMouseEvent) => {
      // Prevent default browser context menu
      e.originalEvent.preventDefault();
      openAt(e.point, e.lngLat);
    };

    const cancelPress = () => {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = null;
      pressStart = null;
    };

    // Long-press handler (single finger held still)
    const handleTouchStart = (e: MapTouchEvent) => {
      cancelPress();
      if (e.originalEvent.touches.length !== 1) return;
      pressStart = { x: e.point.x, y: e.point.y };
      const point: PointLike = [e.point.x, e.point.y];
      pressTimer = setTimeout(() => {
        pressTimer = null;
        if (!pressStart) return;
        openAt(pressStart, map.unproject(point));
      }, LONG_PRESS_MS);
    };

    const handleTouchMove = (e: MapTouchEvent) => {
      if (!pressStart) return;
      const moved = Math.hypot(e.point.x - pressStart.x, e.point.y - pressStart.y);
      if (moved > LONG_PRESS_TOLERANCE || e.originalEvent.touches.length !== 1) cancelPress();
    };

    // Click handler to close menu
    const handleClick = () => {
      if (Date.now() - openedAt < 700) return;
      close();
    };

    // Move/drag handler to close menu
    const handleMoveStart = () => {
      cancelPress();
      close();
    };

    map.on('contextmenu', handleContextMenu);
    map.on('touchstart', handleTouchStart);
    map.on('touchmove', handleTouchMove);
    map.on('touchend', cancelPress);
    map.on('touchcancel', cancelPress);
    map.on('click', handleClick);
    map.on('movestart', handleMoveStart);

    // Cleanup
    return () => {
      cancelPress();
      map.off('contextmenu', handleContextMenu);
      map.off('touchstart', handleTouchStart);
      map.off('touchmove', handleTouchMove);
      map.off('touchend', cancelPress);
      map.off('touchcancel', cancelPress);
      map.off('click', handleClick);
      map.off('movestart', handleMoveStart);
    };
  }, [map, close]);

  return {
    isOpen,
    position,
    close,
  };
}
