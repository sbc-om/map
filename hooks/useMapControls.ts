'use client';

import { useCallback } from 'react';
import { useMap } from './useMap';

/**
 * Hook for controlling map zoom and fullscreen
 */
export function useMapControls() {
    const map = useMap();

    const zoomIn = useCallback(() => {
        if (map) {
            map.zoomIn();
        }
    }, [map]);

    const zoomOut = useCallback(() => {
        if (map) {
            map.zoomOut();
        }
    }, [map]);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }, []);

    const resetView = useCallback(() => {
        if (map) {
            // Reset to Oman default view
            map.flyTo({ center: [58.4093, 22.5796], zoom: 7, duration: 1200, essential: true });
        }
    }, [map]);

    return {
        zoomIn,
        zoomOut,
        toggleFullscreen,
        resetView,
        map,
    };
}
