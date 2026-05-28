'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLeafletMap } from './useLeafletMap';
import type { Marker } from 'leaflet';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
}

export function useMapMarkers() {
  const map = useLeafletMap();
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const leafletMarkersRef = useRef<Map<string, Marker>>(new Map());

  const generateId = useCallback(() => {
    return `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const addMarker = useCallback(async (lat: number, lng: number, label?: string) => {
    if (!map) return null;

    const id = generateId();
    const L = await import('leaflet');

    const makeIcon = () =>
      L.divIcon({
        className: 'poi-preview-marker',
        html: `<div style="position:relative;width:44px;height:60px;pointer-events:none">
  <div class="poi-pulse-ring" style="position:absolute;top:0;left:0;width:40px;height:40px;border-radius:50%;border:2px solid #ef4444"></div>
  <div style="position:absolute;top:4px;left:4px;width:32px;height:32px;background:#ef4444;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center">
    <div style="width:9px;height:9px;background:white;border-radius:50%;opacity:0.95"></div>
  </div>
</div>`,
        iconSize: [44, 60],
        iconAnchor: [22, 60],
        popupAnchor: [0, -64],
      });

    const leafletMarker = L.marker([lat, lng], {
      draggable: true,
      icon: makeIcon(),
    }).addTo(map);

    leafletMarker.dragging?.enable();

    // Stop only mousedown/touchstart from bubbling to map (prevents pan-vs-drag conflict).
    // Do NOT stop contextmenu — it needs to bubble so the map's right-click menu still works.
    const el = leafletMarker.getElement();
    if (el) {
      L.DomEvent.on(el, 'mousedown touchstart', L.DomEvent.stopPropagation);
    }

    // Popup content - share button reads getLatLng() so position is always current after drag
    const popupHtml = `
<div style="font-family:system-ui,sans-serif;min-width:156px;padding:2px 0">
  ${label ? `<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#111">${label}</p>` : ''}
  <p style="margin:0 0 10px;font-size:11px;font-family:monospace;color:#6b7280" data-coords>
    ${lat.toFixed(6)}, ${lng.toFixed(6)}
  </p>
  <div style="display:flex;gap:6px">
    <button data-share-btn style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:6px 0;background:#3b82f6;color:white;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      Share
    </button>
    <button data-remove-btn style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:6px 0;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      Remove
    </button>
  </div>
</div>`;

    leafletMarker.bindPopup(popupHtml, { minWidth: 168 });

    // Bind interactive popup buttons each time popup opens
    leafletMarker.on('popupopen', function (this: typeof leafletMarker) {
      const popupEl = this.getPopup()?.getElement();
      if (!popupEl) return;

      // Update coords display to current position
      const coordsEl = popupEl.querySelector('[data-coords]') as HTMLElement | null;
      if (coordsEl) {
        const pos = leafletMarker.getLatLng();
        coordsEl.textContent = `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
      }

      // Share button
      const shareBtn = popupEl.querySelector('[data-share-btn]') as HTMLElement | null;
      if (shareBtn) {
        shareBtn.onclick = async () => {
          const pos = leafletMarker.getLatLng();
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
              setTimeout(() => { shareBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share'; }, 2000);
            }
          } catch { /* user cancelled share */ }
        };
      }

      // Remove button
      const removeBtn = popupEl.querySelector('[data-remove-btn]') as HTMLElement | null;
      if (removeBtn) {
        removeBtn.onclick = () => {
          if (map?.hasLayer(leafletMarker)) map.removeLayer(leafletMarker);
          leafletMarkersRef.current.delete(id);
          setMarkers(prev => prev.filter(m => m.id !== id));
        };
      }
    });

    // Update coords display in open popup after drag
    leafletMarker.on('dragend', function (this: typeof leafletMarker) {
      const pos = this.getLatLng();
      setMarkers(prev =>
        prev.map(m => m.id === id ? { ...m, lat: pos.lat, lng: pos.lng } : m)
      );
      // If popup is open, refresh coords text
      if (this.isPopupOpen()) {
        const coordsEl = this.getPopup()?.getElement()?.querySelector('[data-coords]') as HTMLElement | null;
        if (coordsEl) coordsEl.textContent = `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
      }
    });

    const newMarker: MapMarker = { id, lat, lng, label };
    leafletMarkersRef.current.set(id, leafletMarker);
    setMarkers(prev => [...prev, newMarker]);

    return id;
  }, [map, generateId]);

  const removeMarker = useCallback((id: string) => {
    const leafletMarker = leafletMarkersRef.current.get(id);
    if (leafletMarker && map?.hasLayer(leafletMarker)) map.removeLayer(leafletMarker);
    leafletMarkersRef.current.delete(id);
    setMarkers(prev => prev.filter(m => m.id !== id));
  }, [map]);

  const clearMarkers = useCallback(() => {
    leafletMarkersRef.current.forEach((leafletMarker) => {
      if (map?.hasLayer(leafletMarker)) map.removeLayer(leafletMarker);
    });
    leafletMarkersRef.current.clear();
    setMarkers([]);
  }, [map]);

  const getMarker = useCallback((id: string): MapMarker | undefined => {
    return markers.find(m => m.id === id);
  }, [markers]);

  useEffect(() => {
    const markersMap = leafletMarkersRef.current;
    return () => {
      markersMap.forEach((leafletMarker) => {
        if (map?.hasLayer(leafletMarker)) map.removeLayer(leafletMarker);
      });
      markersMap.clear();
    };
  }, [map]);

  return { markers, addMarker, removeMarker, clearMarkers, getMarker, markerCount: markers.length };
}
