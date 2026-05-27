'use client';

import { useCallback } from 'react';
import { useLeafletMap } from './useLeafletMap';

/**
 * Hook for controlling map zoom and fullscreen
 */
export function useMapControls() {
    const map = useLeafletMap();

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
            map.flyTo([22.5796, 58.4093], 7, { animate: true, duration: 1.2 });
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
