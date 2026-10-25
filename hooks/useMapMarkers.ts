'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useMap } from './useMap';
import { maplibre } from '@/lib/map/maplibre';
import { escapeHtml, htmlElement } from '@/lib/utils/maps';
import type { Marker } from 'maplibre-gl';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
}

const SHARE_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';

export function useMapMarkers() {
  const map = useMap();
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const mapMarkersRef = useRef<Map<string, Marker>>(new Map());

  const generateId = useCallback(() => {
    return `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const addMarker = useCallback((lat: number, lng: number, label?: string) => {
    if (!map) return null;

    const id = generateId();
    const { Marker, Popup } = maplibre();

    // poi-preview-marker → touch-action:none + grab cursor so mobile drag works
    const element = htmlElement(
      `<div style="position:relative;width:44px;height:60px;pointer-events:none">
  <div class="poi-pulse-ring" style="position:absolute;top:0;left:0;width:40px;height:40px;border-radius:50%;border:2px solid #ef4444"></div>
  <div style="position:absolute;top:4px;left:4px;width:32px;height:32px;background:#ef4444;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center">
    <div style="width:9px;height:9px;background:white;border-radius:50%;opacity:0.95"></div>
  </div>
</div>`,
      'poi-preview-marker'
    );

    // Popup content - share button reads getLngLat() so position is always current after drag
    const popupEl = htmlElement(`
<div style="font-family:system-ui,sans-serif;min-width:156px;padding:2px 0">
  ${label ? `<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#111">${escapeHtml(label)}</p>` : ''}
  <p style="margin:0 0 10px;font-size:11px;font-family:monospace;color:#6b7280" data-coords>
    ${lat.toFixed(6)}, ${lng.toFixed(6)}
  </p>
  <div style="display:flex;gap:6px">
    <button data-share-btn style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:6px 0;background:#3b82f6;color:white;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">
      ${SHARE_ICON}
      Share
    </button>
    <button data-remove-btn style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:6px 0;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      Remove
    </button>
  </div>
</div>`);

    // Popup tip sits just above the pin head (Leaflet popupAnchor [0, -64])
    const popup = new Popup({ offset: 64, maxWidth: '260px' }).setDOMContent(popupEl);

    const mapMarker = new Marker({ element, anchor: 'bottom', draggable: true })
      .setLngLat([lng, lat])
      .setPopup(popup)
      .addTo(map);

    // Marker clicks must not reach the map (context menu close, measuring,
    // picking a location); toggle the popup ourselves instead.
    element.addEventListener('click', (e) => {
      e.stopPropagation();
      mapMarker.togglePopup();
    });

    const coordsEl = popupEl.querySelector('[data-coords]') as HTMLElement | null;
    const refreshCoords = () => {
      if (!coordsEl) return;
      const pos = mapMarker.getLngLat();
      coordsEl.textContent = `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
    };

    // Update coords display to current position each time the popup opens
    popup.on('open', refreshCoords);

    // Share button
    const shareBtn = popupEl.querySelector('[data-share-btn]') as HTMLElement | null;
    if (shareBtn) {
      shareBtn.onclick = async () => {
        const pos = mapMarker.getLngLat();
        const params = new URLSearchParams({
          lat: pos.lat.toFixed(6),
          lng: pos.lng.toFixed(6),
          zoom: '15',
          pin: '1',
          ...(label ? { title: label } : {}),
        });
        const url = `${window.location.origin}/map?${params}`;
        try {
          if (navigator.share) {
            await navigator.share({ title: label || 'Location on Map', text: `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`, url });
          } else {
            await navigator.clipboard.writeText(url);
            shareBtn.textContent = '✓ Link Copied!';
            setTimeout(() => { shareBtn.innerHTML = `${SHARE_ICON} Share`; }, 2000);
          }
        } catch { /* user cancelled share */ }
      };
    }

    // Remove button
    const removeBtn = popupEl.querySelector('[data-remove-btn]') as HTMLElement | null;
    if (removeBtn) {
      removeBtn.onclick = () => {
        mapMarker.remove();
        mapMarkersRef.current.delete(id);
        setMarkers(prev => prev.filter(m => m.id !== id));
      };
    }

    // Track position after drag and refresh coords in an open popup
    mapMarker.on('dragend', () => {
      const pos = mapMarker.getLngLat();
      setMarkers(prev =>
        prev.map(m => m.id === id ? { ...m, lat: pos.lat, lng: pos.lng } : m)
      );
      if (popup.isOpen()) refreshCoords();
    });

    const newMarker: MapMarker = { id, lat, lng, label };
    mapMarkersRef.current.set(id, mapMarker);
    setMarkers(prev => [...prev, newMarker]);

    return id;
  }, [map, generateId]);

  const removeMarker = useCallback((id: string) => {
    mapMarkersRef.current.get(id)?.remove();
    mapMarkersRef.current.delete(id);
    setMarkers(prev => prev.filter(m => m.id !== id));
  }, []);

  const clearMarkers = useCallback(() => {
    mapMarkersRef.current.forEach((mapMarker) => mapMarker.remove());
    mapMarkersRef.current.clear();
    setMarkers([]);
  }, []);

  const getMarker = useCallback((id: string): MapMarker | undefined => {
    return markers.find(m => m.id === id);
  }, [markers]);

  useEffect(() => {
    const markersMap = mapMarkersRef.current;
    return () => {
      markersMap.forEach((mapMarker) => mapMarker.remove());
      markersMap.clear();
    };
  }, [map]);

  return { markers, addMarker, removeMarker, clearMarkers, getMarker, markerCount: markers.length };
}
