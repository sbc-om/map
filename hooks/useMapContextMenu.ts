'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLeafletMap } from './useLeafletMap';
import type { LeafletMouseEvent } from 'leaflet';

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

/**
 * Hook for managing map context menu (right-click menu)
 * 
 * Features:
 * - Proper event handler cleanup (stores reference to specific handler)
 * - Prevents default browser context menu on map
 * - Tracks click position in both screen and map coordinates
 * - Closes on map click, scroll, or escape key
 * 
 * @returns Object with context menu state and controls
 */
export function useMapContextMenu(): UseMapContextMenuReturn {
  const map = useLeafletMap();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<ContextMenuPosition | null>(null);
  
  // Store handler references for proper cleanup
  const contextMenuHandlerRef = useRef<((e: LeafletMouseEvent) => void) | null>(null);
  const clickHandlerRef = useRef<(() => void) | null>(null);
  const moveStartHandlerRef = useRef<(() => void) | null>(null);

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

    // Context menu handler (right-click)
    const handleContextMenu = (e: LeafletMouseEvent) => {
      // Prevent default browser context menu
      e.originalEvent.preventDefault();
      
      // Get container position for accurate menu placement
      const containerPoint = e.containerPoint;
      
      setPosition({
        x: containerPoint.x,
        y: containerPoint.y,
        latlng: {
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        },
      });
      setIsOpen(true);
    };

    // Click handler to close menu
    const handleClick = () => {
      if (isOpen) {
        close();
      }
    };

    // Move/drag handler to close menu
    const handleMoveStart = () => {
      if (isOpen) {
        close();
      }
    };

    // Store references
    contextMenuHandlerRef.current = handleContextMenu;
    clickHandlerRef.current = handleClick;
    moveStartHandlerRef.current = handleMoveStart;

    // Attach handlers
    map.on('contextmenu', handleContextMenu);
    map.on('click', handleClick);
    map.on('movestart', handleMoveStart);

    // Cleanup
    return () => {
      if (contextMenuHandlerRef.current) {
        map.off('contextmenu', contextMenuHandlerRef.current);
        contextMenuHandlerRef.current = null;
      }
      if (clickHandlerRef.current) {
        map.off('click', clickHandlerRef.current);
        clickHandlerRef.current = null;
      }
      if (moveStartHandlerRef.current) {
        map.off('movestart', moveStartHandlerRef.current);
        moveStartHandlerRef.current = null;
      }
    };
  }, [map, isOpen, close]);

  return {
    isOpen,
    position,
    close,
  };
}
