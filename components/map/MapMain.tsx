"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { LeafletMap } from "./LeafletMap";
import { LeafletTileLayer } from "./LeafletTileLayer";
import { LeafletGeoJSON } from "./LeafletGeoJSON";
import { MapSearchBar } from "./MapSearchBar";
import { MapTopBar } from "./MapTopBar";
import { MapTileSwitcher } from "./MapTileSwitcher";
import { MapControls } from "./MapControls";
import { MapDetailsPanel } from "./MapDetailsPanel";
import { MapMeasurementPanel } from "./MapMeasurementPanel";
import { MapContextMenu } from "./MapContextMenu";
import { MapPOIPanel } from "./MapPOIPanel";
import { useMapTileProvider } from "@/hooks/useMapTileProvider";
import { getCountryFeature } from "@/lib/countries";
import { useMapContextMenu } from "@/hooks/useMapContextMenu";
import { useMapMarkers } from "@/hooks/useMapMarkers";
import { usePOIManager } from "@/hooks/usePOIManager";
import { useLeafletMap } from "@/hooks/useLeafletMap";
import type { POICategory } from "@/types/poi";

// Memoized GeoJSON style
const GEOJSON_STYLE = {
  fillColor: "#3b82f6",
  fillOpacity: 0.15,
  color: "#2563eb",
  weight: 2,
} as const;

/**
 * MapMain - root map component.
 *
 * New features vs previous version:
 * - MapDirectionsPanel (OSRM routing)
 * - MapStatusBar (coordinate/zoom display)
 * - Share URL on mount (fly to ?lat=&lng=&zoom= params)
 * - Directions shortcut from context menu
 * - onDirectionsClick wired in search bar
 */
export function MapMain() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedCountry, setSelectedCountry] =
    useState<GeoJSON.Feature | null>(null);
  const [isMeasurementOpen, setIsMeasurementOpen] = useState(false);
  const [isPOIPanelOpen, setIsPOIPanelOpen] = useState(false);
  const [directionsInitialTo, setDirectionsInitialTo] = useState("");
  const [poiFilterCategory, setPOIFilterCategory] =
    useState<POICategory | null>(null);
  const [poiInitialCoords, setPOIInitialCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [poiPanelMode, setPOIPanelMode] = useState<"list" | "add" | "directions">("list");
  const [isSelectingPOILocation, setIsSelectingPOILocation] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const map = useLeafletMap();
  const { tileProvider, currentProviderId, setProviderId } =
    useMapTileProvider();
  const { isOpen: isContextMenuOpen, position: contextMenuPosition, close: closeContextMenu } =
    useMapContextMenu();
  const { addMarker } = useMapMarkers();
  const { pois, addPOI, updatePOI, deletePOI, clearAllPOIs, exportGeoJSON, importGeoJSON, flyToPOI } =
    usePOIManager();

  // Deep-link: fly to ?lat=&lng=&zoom= on mount, show pin if &pin=1
  useEffect(() => {
    if (!map) return;
    const params = new URLSearchParams(window.location.search);
    const lat = parseFloat(params.get("lat") ?? "");
    const lng = parseFloat(params.get("lng") ?? "");
    const zoom = parseInt(params.get("zoom") ?? "", 10);
    const showPin = params.get("pin") === "1";
    const title = params.get("title") ? decodeURIComponent(params.get("title")!) : undefined;

    if (!isNaN(lat) && !isNaN(lng)) {
      map.flyTo([lat, lng], !isNaN(zoom) ? zoom : 15, {
        animate: true,
        duration: 1.5,
      });
      if (showPin) {
        addMarker(lat, lng, title);
      }
    }
  // addMarker is stable (useCallback); including it satisfies exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // ── Callbacks ──────────────────────────────────────────────────────────────

  const handleCountrySelect = useCallback(async (countryId: string) => {
    try {
      const feature = await getCountryFeature(countryId);
      if (feature) setSelectedCountry(feature);
    } catch (error) {
      console.error("Error loading country GeoJSON:", error);
    }
  }, []);

  const handleClearSelection = useCallback(() => setSelectedCountry(null), []);

  // Measurement
  const handleMeasurementOpen = useCallback(
    () => setIsMeasurementOpen(true),
    []
  );
  const handleMeasurementClose = useCallback(
    () => setIsMeasurementOpen(false),
    []
  );

  // Directions - now shown inside the POI sidebar as mode='directions'
  const handleDirectionsOpen = useCallback((to = "") => {
    setDirectionsInitialTo(to);
    setPOIPanelMode("directions");
    setIsPOIPanelOpen(true);
    setPOIFilterCategory(null);
    setPOIInitialCoords(null);
  }, []);

  // Context menu
  const handleAddMarker = useCallback(
    (lat: number, lng: number) => addMarker(lat, lng),
    [addMarker]
  );

  const handleShareLocation = useCallback(
    async (lat: number, lng: number) => {
      const zoom = map?.getZoom() ?? 15;
      const params = new URLSearchParams({
        lat: lat.toFixed(6),
        lng: lng.toFixed(6),
        zoom: String(Math.round(zoom)),
        pin: "1",
      });
      const url = `${window.location.origin}/map?${params}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: "Location on Map", text: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, url });
        } else {
          await navigator.clipboard.writeText(url);
        }
      } catch { /* user cancelled */ }
    },
    [map]
  );
  const handleContextMenuMeasurement = useCallback(
    () => setIsMeasurementOpen(true),
    []
  );
  const handleContextMenuAddPOI = useCallback((lat: number, lng: number) => {
    setPOIInitialCoords({ lat, lng });
    setPOIFilterCategory(null);
    setPOIPanelMode("add");
    setIsPOIPanelOpen(true);
  }, []);
  const handleContextMenuDirections = useCallback(
    (_lat: number, _lng: number) => {
      handleDirectionsOpen();
    },
    [handleDirectionsOpen]
  );

  // POI
  const handleOpenPOIPanel = useCallback((category?: POICategory) => {
    setPOIFilterCategory(category || null);
    setPOIInitialCoords(null);
    setPOIPanelMode("list");
    setIsPOIPanelOpen(true);
  }, []);

  const handleClosePOIPanel = useCallback(() => {
    setIsPOIPanelOpen(false);
    setIsSelectingPOILocation(false);
    setPOIPanelMode("list");
    setTimeout(() => {
      setPOIFilterCategory(null);
      setPOIInitialCoords(null);
    }, 100);
  }, []);

  const handleRequestPOILocation = useCallback(() => {
    setIsSelectingPOILocation((prev) => !prev);
  }, []);

  const handleClearPOICoordinates = useCallback(() => {
    setPOIInitialCoords(null);
    setCursorCoords(null);
    setIsSelectingPOILocation(false);
  }, []);

  const handlePOIModeChange = useCallback((mode: string) => {
    if (mode === "list" || mode === "add") {
      setPOIPanelMode(mode);
    }
    // 'directions' mode is managed via handleDirectionsOpen; 'edit' stays internal
  }, []);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (isSelectingPOILocation) {
        setPOIInitialCoords({ lat, lng });
        setIsSelectingPOILocation(false);
        setCursorCoords(null);
      }
    },
    [isSelectingPOILocation]
  );

  const handleMapMouseMove = useCallback(
    (lat: number, lng: number) => {
      if (isSelectingPOILocation) setCursorCoords({ lat, lng });
    },
    [isSelectingPOILocation]
  );

  const handlePOIExport = useCallback(() => {
    const geojson = exportGeoJSON();
    const blob = new Blob([JSON.stringify(geojson, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-places-${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportGeoJSON]);

  const handlePOIImport = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const geojson = JSON.parse(text);
        const count = importGeoJSON(geojson);
        toast.success(
          `Imported ${count} place${count !== 1 ? "s" : ""} successfully!`
        );
      } catch {
        toast.error("Failed to import file. Please check the format.");
      }
    },
    [importGeoJSON]
  );

  const handleCategoryClick = useCallback(
    (categoryId: string) => {
      const map: Record<string, POICategory> = {
        restaurants: "food-drink",
        hotels: "lodging",
        attractions: "tourism",
        transit: "transport",
      };
      const cat = map[categoryId.toLowerCase()];
      if (cat) handleOpenPOIPanel(cat);
    },
    [handleOpenPOIPanel]
  );

  // Is any left-side panel currently open? Used to shift the search bar and hide category pills.
  const isLeftPanelOpen = isPOIPanelOpen || !!selectedCountry;

  // Memoised tile props
  const tileLayerProps = useMemo(
    () => ({
      url: tileProvider.url,
      attribution: tileProvider.attribution,
      maxZoom: tileProvider.maxZoom,
      tileSize: tileProvider.tileSize,
      zoomOffset: tileProvider.zoomOffset,
      detectRetina: tileProvider.detectRetina,
    }),
    [
      tileProvider.url,
      tileProvider.attribution,
      tileProvider.maxZoom,
      tileProvider.tileSize,
      tileProvider.zoomOffset,
      tileProvider.detectRetina,
    ]
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* ── Map ── */}
      <LeafletMap
        className="w-full h-full"
        onClick={handleMapClick}
        onMouseMove={handleMapMouseMove}
        cursorStyle={isSelectingPOILocation ? "crosshair" : "grab"}
      >
        <LeafletTileLayer
          url={tileLayerProps.url}
          attribution={tileLayerProps.attribution}
          maxZoom={tileLayerProps.maxZoom}
          tileSize={tileLayerProps.tileSize}
          zoomOffset={tileLayerProps.zoomOffset}
          detectRetina={tileLayerProps.detectRetina}
        />
        <LeafletGeoJSON data={selectedCountry} style={GEOJSON_STYLE} />
      </LeafletMap>

      {/* ── Search Bar ── */}
      <MapSearchBar
        onCountrySelect={handleCountrySelect}
        selectedCountry={selectedCountry}
        onClearSelection={handleClearSelection}
        onMeasurementClick={handleMeasurementOpen}
        onPOIClick={() => handleOpenPOIPanel()}
        onDirectionsClick={() => handleDirectionsOpen()}
        onCategoryClick={handleCategoryClick}
        leftPanelOpen={isLeftPanelOpen}
      />

      {/* ── Top Bar (theme + user) ── */}
      <MapTopBar />

      {/* ── Tile Switcher ── */}
      <MapTileSwitcher
        selectedProviderId={currentProviderId}
        onProviderChange={setProviderId}
      />

      {/* ── Controls ── */}
      <MapControls />

      {/* ── Details Panel ── */}
      <MapDetailsPanel
        country={selectedCountry}
        onClose={handleClearSelection}
      />

      {/* ── Measurement Panel ── */}
      <MapMeasurementPanel
        isOpen={isMeasurementOpen}
        onClose={handleMeasurementClose}
      />

      {/* ── Context Menu ── */}
      <MapContextMenu
        isOpen={isContextMenuOpen}
        position={contextMenuPosition}
        onClose={closeContextMenu}
        onAddMarker={handleAddMarker}
        onStartMeasurement={handleContextMenuMeasurement}
        onAddPOI={handleContextMenuAddPOI}
        onDirections={handleContextMenuDirections}
        onShareLocation={handleShareLocation}
      />

      {/* ── POI + Directions Panel (unified sidebar) ── */}
      <MapPOIPanel
        isOpen={isPOIPanelOpen}
        onClose={handleClosePOIPanel}
        pois={pois}
        filterCategory={poiFilterCategory}
        onAddPOI={addPOI}
        onUpdatePOI={updatePOI}
        onDeletePOI={deletePOI}
        onClearAll={clearAllPOIs}
        onExport={handlePOIExport}
        onImport={handlePOIImport}
        onFlyTo={flyToPOI}
        onRequestLocation={handleRequestPOILocation}
        onClearCoordinates={handleClearPOICoordinates}
        onModeChange={handlePOIModeChange}
        isSelectingLocation={isSelectingPOILocation}
        initialLat={poiInitialCoords?.lat}
        initialLng={poiInitialCoords?.lng}
        cursorLat={cursorCoords?.lat}
        cursorLng={cursorCoords?.lng}
        mode={poiPanelMode}
        directionsInitialTo={directionsInitialTo}
      />
    </div>
  );
}
