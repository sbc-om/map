"use client";

import { memo, useState, useCallback, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  X,
  Plus,
  Upload,
  Download,
  Trash2,
  ArrowLeft,
  Save,
  Edit2,
  MapPin,
  Crosshair,
  Navigation2,
  ChevronDown,
  Share2,
} from "lucide-react";
import { DirectionsView } from "./DirectionsView";
import { Drawer } from "vaul";
import { toast } from "sonner";
import type { POI, POICategory } from "@/types/poi";
import {
  POI_CATEGORIES,
  getCategoryColor,
  getCategoryBgColor,
  getCategoryById,
} from "@/constants/poi-categories";
import { formatDecimalDegrees } from "@/lib/utils/coordinates";
import { useLeafletMap } from "@/hooks/useLeafletMap";

interface MapPOIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  pois: POI[];
  filterCategory?: POICategory | null;
  onAddPOI: (
    title: string,
    lat: number,
    lng: number,
    category: POICategory,
    description?: string
  ) => void;
  onUpdatePOI: (
    id: string,
    updates: Partial<Omit<POI, "id" | "createdAt">>
  ) => void;
  onDeletePOI: (id: string) => void;
  onClearAll: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onFlyTo: (poi: POI) => void;
  onRequestLocation?: () => void;
  onClearCoordinates?: () => void;
  onModeChange?: (mode: string) => void;
  isSelectingLocation?: boolean;
  initialLat?: number;
  initialLng?: number;
  cursorLat?: number;
  cursorLng?: number;
  mode?: "list" | "add" | "directions"; // Control view mode from parent
  /** Pre-fill destination when opened via context-menu "Directions to here" */
  directionsInitialTo?: string;
}

type ViewMode = "list" | "add" | "edit" | "directions";

interface POIFormData {
  title: string;
  description: string;
  lat: string;
  lng: string;
  category: POICategory;
}

/**
 * POI List Item Component - Fixed: No nested buttons
 */
const POIListItem = memo(function POIListItem({
  poi,
  onEdit,
  onDelete,
  onFlyTo,
}: {
  poi: POI;
  onEdit: () => void;
  onDelete: () => void;
  onFlyTo: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const categoryColor = getCategoryColor(poi.category);
  const categoryBgColor = getCategoryBgColor(poi.category);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
    >
      {/* Category Icon - Clickable to fly to */}
      <button
        onClick={onFlyTo}
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
        style={{ backgroundColor: categoryBgColor }}
        title="Fly to location"
      >
        <MapPin className="h-5 w-5" style={{ color: categoryColor }} />
      </button>

      {/* Content - Clickable to fly to */}
      <button onClick={onFlyTo} className="flex-1 min-w-0 text-left">
        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {poi.title}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {formatDecimalDegrees([poi.lat, poi.lng], 4)}
        </div>
      </button>

      {/* Actions (show on hover) */}
      {isHovered && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Edit"
          >
            <Edit2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </button>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              const params = new URLSearchParams({
                lat: poi.lat.toFixed(6),
                lng: poi.lng.toFixed(6),
                zoom: "15",
                pin: "1",
                title: poi.title,
              });
              const url = `${window.location.origin}/map?${params}`;
              try {
                if (navigator.share) {
                  await navigator.share({ title: poi.title, text: poi.description, url });
                } else {
                  await navigator.clipboard.writeText(url);
                  toast.success("Location link copied!");
                }
              } catch { /* user cancelled */ }
            }}
            className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            title="Share location"
          >
            <Share2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}
    </div>
  );
});

POIListItem.displayName = "POIListItem";

/**
 * MapPOIPanel - POI management panel
 *
 * Features:
 * - List view with category filtering
 * - Add/Edit POI forms
 * - Import/Export GeoJSON
 * - LocalStorage persistence
 * - Responsive (drawer on mobile, panel on desktop)
 * - Interactive coordinate selection
 */
export const MapPOIPanel = memo(function MapPOIPanel({
  isOpen,
  onClose,
  pois,
  filterCategory,
  onAddPOI,
  onUpdatePOI,
  onDeletePOI,
  onClearAll,
  onExport,
  onImport,
  onFlyTo,
  onRequestLocation,
  onClearCoordinates,
  onModeChange,
  isSelectingLocation: isSelectingLocationProp = false,
  initialLat,
  initialLng,
  cursorLat,
  cursorLng,
  mode: externalMode,
  directionsInitialTo = "",
}: MapPOIPanelProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [editingPOI, setEditingPOI] = useState<POI | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const snapPoints = [0.4, 0.7, 1];
  const [snap, setSnap] = useState<number | string | null>(snapPoints[1]);

  // ── Draggable preview marker ──────────────────────────────────────────────
  const map = useLeafletMap();
  const previewMarkerRef = useRef<any>(null);
  const prevCategoryRef = useRef<string>("");
  // Keep a stable ref to map for cleanup on unmount
  const mapRef = useRef(map);
  useEffect(() => { mapRef.current = map; }, [map]);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Derive initial coordinates for form
  const initialLatStr = initialLat?.toFixed(6) || "";
  const initialLngStr = initialLng?.toFixed(6) || "";

  // Use external mode if provided, otherwise manage internally
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>("list");
  const viewMode = externalMode || internalViewMode;
  const setViewMode = useCallback(
    (mode: ViewMode) => {
      if (externalMode && onModeChange) {
        // Notify parent of mode change
        onModeChange(mode);
      } else {
        // Manage internally
        setInternalViewMode(mode);
      }
    },
    [externalMode, onModeChange]
  );

  // Remove preview marker when leaving form mode
  useEffect(() => {
    const isFormMode = viewMode === "add" || viewMode === "edit";
    if (!isFormMode) {
      if (previewMarkerRef.current && mapRef.current) {
        try { mapRef.current.removeLayer(previewMarkerRef.current); } catch {}
        previewMarkerRef.current = null;
        prevCategoryRef.current = "";
      }
    }
  }, [viewMode]);

  // Cleanup preview marker on unmount
  useEffect(() => {
    return () => {
      if (previewMarkerRef.current && mapRef.current) {
        try { mapRef.current.removeLayer(previewMarkerRef.current); } catch {}
        previewMarkerRef.current = null;
      }
    };
  }, []);

  // Initialize form data - derive from props when available
  const initialFormData = useMemo(
    () => ({
      title: "",
      description: "",
      lat: initialLatStr,
      lng: initialLngStr,
      category: (filterCategory || "food-drink") as POICategory,
    }),
    [initialLatStr, initialLngStr, filterCategory]
  );

  const [formData, setFormData] = useState<POIFormData>(initialFormData);

  // Update form coordinates when they change from parent
  useEffect(() => {
    if (initialLatStr && initialLngStr) {
      setFormData((prev) => ({
        ...prev,
        lat: initialLatStr,
        lng: initialLngStr,
      }));
    }
  }, [initialLatStr, initialLngStr]);

  // ── Draggable preview marker (position + category-aware) ──────────────────
  useEffect(() => {
    const isFormMode = viewMode === "add" || viewMode === "edit";
    const lat = parseFloat(formData.lat);
    const lng = parseFloat(formData.lng);
    const hasCoords =
      !isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

    if (!isFormMode || !hasCoords || !map) {
      if (previewMarkerRef.current) {
        try { map?.removeLayer(previewMarkerRef.current); } catch {}
        previewMarkerRef.current = null;
        prevCategoryRef.current = "";
      }
      return;
    }

    const categoryChanged = formData.category !== prevCategoryRef.current;

    if (previewMarkerRef.current && !categoryChanged) {
      // Just reposition - no flicker
      previewMarkerRef.current.setLatLng([lat, lng]);
      return;
    }

    // Remove stale marker before recreating
    if (previewMarkerRef.current) {
      try { map.removeLayer(previewMarkerRef.current); } catch {}
      previewMarkerRef.current = null;
    }
    prevCategoryRef.current = formData.category;

    const color = getCategoryColor(formData.category);
    const cat = getCategoryById(formData.category);
    const icon = cat?.icon ?? "📍";

    import("leaflet").then((L) => {
      if (!map) return;
      const marker = L.marker([lat, lng], {
        draggable: true,
        zIndexOffset: 600,
        icon: L.divIcon({
          // poi-preview-marker → sets touch-action:none + grab cursor on the
          // Leaflet icon wrapper so mobile drag works and desktop shows grab cursor
          className: "poi-preview-marker",
          html: `<div style="position:relative;width:44px;height:60px;pointer-events:none">
  <div class="poi-pulse-ring" style="position:absolute;top:0;left:0;width:40px;height:40px;border-radius:50%;border:2px solid ${color}"></div>
  <div style="position:absolute;top:4px;left:4px;width:32px;height:32px;background:${color};border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center">
    <span style="transform:rotate(45deg);font-size:14px;line-height:1">${icon}</span>
  </div>
</div>`,
          iconSize: [44, 60],
          iconAnchor: [22, 60],
          popupAnchor: [0, -64],
        }),
      }).addTo(map);

      // Explicit enable - belt-and-suspenders for mobile reliability
      marker.dragging?.enable();

      marker.on("dragend", function (this: typeof marker) {
        const pos = this.getLatLng();
        setFormData((prev) => ({
          ...prev,
          lat: pos.lat.toFixed(6),
          lng: pos.lng.toFixed(6),
        }));
      });

      previewMarkerRef.current = marker;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, viewMode, formData.lat, formData.lng, formData.category]);

  // Filter POIs by category if specified
  const displayPOIs = filterCategory
    ? pois.filter((poi) => poi.category === filterCategory)
    : pois;

  const categoryName = filterCategory
    ? POI_CATEGORIES.find((c) => c.id === filterCategory)?.name
    : "My Places";

  /**
   * Handle add POI mode
   */
  const handleAddMode = useCallback(() => {
    setViewMode("add");
    setEditingPOI(null);

    // Auto-place pin at current map center if no external coords
    let lat = initialLatStr;
    let lng = initialLngStr;
    if (!lat && !lng && map) {
      const center = map.getCenter();
      lat = center.lat.toFixed(6);
      lng = center.lng.toFixed(6);
    }

    setFormData({
      title: "",
      description: "",
      lat,
      lng,
      category: filterCategory || "food-drink",
    });
  }, [setViewMode, initialLatStr, initialLngStr, filterCategory, map]);

  /**
   * Handle edit POI mode
   */
  const handleEditMode = useCallback(
    (poi: POI) => {
      setViewMode("edit");
      setEditingPOI(poi);
      setFormData({
        title: poi.title,
        description: poi.description || "",
        lat: poi.lat.toFixed(6),
        lng: poi.lng.toFixed(6),
        category: poi.category,
      });
    },
    [setViewMode]
  );

  /**
   * Handle save POI
   */
  const handleSave = useCallback(() => {
    const lat = parseFloat(formData.lat);
    const lng = parseFloat(formData.lng);

    if (!formData.title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (isNaN(lat) || isNaN(lng)) {
      toast.error("Please enter valid coordinates");
      return;
    }

    if (viewMode === "edit" && editingPOI) {
      onUpdatePOI(editingPOI.id, {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        lat,
        lng,
        category: formData.category,
      });
      toast.success("Place updated successfully");
    } else {
      onAddPOI(
        formData.title.trim(),
        lat,
        lng,
        formData.category,
        formData.description.trim() || undefined
      );
      toast.success("Place added successfully");
    }

    // Clear form and reset state
    setViewMode("list");
    setEditingPOI(null);
    setFormData({
      title: "",
      description: "",
      lat: "",
      lng: "",
      category: "food-drink",
    });

    // Notify parent to clear coordinates
    onClearCoordinates?.();
  }, [
    formData,
    viewMode,
    editingPOI,
    onAddPOI,
    onUpdatePOI,
    onClearCoordinates,
    setViewMode,
  ]);

  /**
   * Handle import file
   */
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onImport(file);
        // Reset input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [onImport]
  );

  /**
   * Handle delete POI with toast
   */
  const handleDeletePOI = useCallback(
    (id: string, title: string) => {
      onDeletePOI(id);
      toast.success(`"${title}" deleted`);
    },
    [onDeletePOI]
  );

  /**
   * Handle clear all with confirmation
   */
  const handleClearAll = useCallback(() => {
    if (confirm(`Are you sure you want to delete all ${pois.length} POIs?`)) {
      onClearAll();
      toast.success(
        `Cleared ${pois.length} place${pois.length !== 1 ? "s" : ""}`
      );
    }
  }, [pois.length, onClearAll]);

  /**
   * Handle location selection mode toggle
   */
  const handleToggleLocationSelection = useCallback(() => {
    onRequestLocation?.();
  }, [onRequestLocation]);

  /**
   * Handle clear coordinates
   */
  const handleClearCoordinates = useCallback(() => {
    setFormData((prev) => ({ ...prev, lat: "", lng: "" }));
    if (!isSelectingLocationProp) {
      onRequestLocation?.();
    }
  }, [isSelectingLocationProp, onRequestLocation]);

  /**
   * Render content based on view mode
   */
  const renderContent = () => {
    // Directions view
    if (viewMode === "directions") {
      return (
        <DirectionsView
          key={directionsInitialTo}
          initialTo={directionsInitialTo}
        />
      );
    }

    // Form view (Add/Edit)
    if (viewMode === "add" || viewMode === "edit") {
      return (
        <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 scrollbar-thin px-6 py-4">
          {/* Location Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Location
              </label>
              {map && formData.lat && formData.lng && (
                <button
                  type="button"
                  onClick={() => {
                    const center = map.getCenter();
                    setFormData((prev) => ({
                      ...prev,
                      lat: center.lat.toFixed(6),
                      lng: center.lng.toFixed(6),
                    }));
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  title="Move pin to current map center"
                >
                  <Crosshair className="h-3.5 w-3.5" />
                  Re-center
                </button>
              )}
            </div>

            {/* Status banner */}
            {isSelectingLocationProp ? (
              <div className="flex items-start gap-2.5 px-3 py-2.5 mb-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
                <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    Click anywhere on the map to place the pin
                  </p>
                  {cursorLat && cursorLng && (
                    <p className="text-[11px] font-mono text-amber-600/70 dark:text-amber-400/70 mt-0.5">
                      {cursorLat.toFixed(6)}, {cursorLng.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
            ) : formData.lat && formData.lng ? (
              <div className="flex items-center gap-2.5 px-3 py-2.5 mb-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-900/40">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <MapPin className="h-3 w-3 text-white" />
                </div>
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300 leading-snug">
                  Pin placed.{" "}
                  <span className="text-blue-500 dark:text-blue-400">Drag it on the map to refine</span>
                </p>
              </div>
            ) : null}

            {/* Coordinate inputs */}
            <div className="grid grid-cols-2 gap-2 mb-2.5">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                  Latitude
                </p>
                <input
                  type="text"
                  value={formData.lat}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, lat: e.target.value }))
                  }
                  placeholder="e.g. 23.5882"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono placeholder:font-sans placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                  Longitude
                </p>
                <input
                  type="text"
                  value={formData.lng}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, lng: e.target.value }))
                  }
                  placeholder="e.g. 58.3823"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono placeholder:font-sans placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            {/* Pick from map */}
            <button
              type="button"
              onClick={handleToggleLocationSelection}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-xs font-medium transition-all ${
                isSelectingLocationProp
                  ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                  : "border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
              }`}
            >
              <Crosshair className="h-3.5 w-3.5" />
              {isSelectingLocationProp
                ? "Click on the map to place pin…"
                : "Pick location by clicking on map"}
            </button>
          </div>

          {/* Category Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <CategorySelect
              value={formData.category}
              onChange={(cat) =>
                setFormData((prev) => ({ ...prev, category: cat }))
              }
            />
          </div>

          {/* Title Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Enter place name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            />
          </div>

          {/* Description Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Add notes or details (optional)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none"
            />
          </div>
        </div>
      );
    }

    // List view
    return (
      <>
        {/* Action Buttons */}
        <div className="px-6 py-4 border-b dark:border-gray-800">
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={handleAddMode}
              className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Plus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 leading-tight">
                Add
              </span>
            </button>
            <button
              onClick={handleImportClick}
              className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
            >
              <Upload className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 leading-tight">
                Import
              </span>
            </button>
            <button
              onClick={onExport}
              disabled={pois.length === 0}
              className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 leading-tight">
                Export
              </span>
            </button>
            <button
              onClick={handleClearAll}
              disabled={pois.length === 0}
              className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 leading-tight">
                Clear
              </span>
            </button>
          </div>
        </div>

        {/* POI List */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 scrollbar-thin">
          {displayPOIs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <MapPin className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                No places yet
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Add your first place to get started
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {displayPOIs.map((poi) => (
                <POIListItem
                  key={poi.id}
                  poi={poi}
                  onEdit={() => handleEditMode(poi)}
                  onDelete={() => handleDeletePOI(poi.id, poi.title)}
                  onFlyTo={() => onFlyTo(poi)}
                />
              ))}
            </div>
          )}
        </div>
      </>
    );
  };

  const content = (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header Image - Hidden on mobile AND in directions mode */}
      {!isMobile && viewMode !== "directions" && (
        <div className="relative isolate h-48 w-full overflow-hidden bg-gradient-to-br from-blue-400 to-purple-600">
          <Image
            src="/poi-bg.png"
            alt="POI Background"
            fill
            sizes="(max-width: 768px) 100vw, 384px"
            className="object-cover"
            priority
            onError={(e) => {
              // Fallback to gradient if image not found
              e.currentTarget.style.display = "none";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-10" />

          {/* Title overlay */}
          <div className="absolute bottom-4 left-6 right-6 z-20">
            <h2 className="text-3xl font-bold text-white drop-shadow-lg">
              {categoryName}
            </h2>
            <p className="text-sm text-white/90 mt-1 drop-shadow">
              {displayPOIs.length}{" "}
              {displayPOIs.length === 1 ? "place" : "places"}
            </p>
          </div>
        </div>
      )}

      {/* Mobile Header / Top Bar */}
      {isMobile && viewMode === "list" && (
        <div className="px-6 py-4 border-b dark:border-gray-800">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {categoryName}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {displayPOIs.length} {displayPOIs.length === 1 ? "place" : "places"}
          </p>
        </div>
      )}

      {/* Top Bar (for directions mode) */}
      {viewMode === "directions" && (
        <div className="flex items-center gap-3 px-4 py-4 border-b dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
          <button
            onClick={() => setViewMode("list")}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <Navigation2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Directions
            </h2>
          </div>
        </div>
      )}

      {/* Top Bar (for add/edit mode) */}
      {(viewMode === "add" || viewMode === "edit") && (
        <div className="flex items-center justify-between px-6 py-3 border-b dark:border-gray-800 bg-white dark:bg-gray-900">
          <button
            onClick={() => {
              setViewMode("list");
            }}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {viewMode === "edit" ? "Edit Place" : "Add Place"}
          </h3>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Save className="h-4 w-4" />
            {viewMode === "edit" ? "Update" : "Save"}
          </button>
        </div>
      )}

      {/* Content */}
      {renderContent()}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.geojson"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );

  // Mobile: Use Drawer
  if (isMobile) {
    return (
      <Drawer.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
        snapPoints={snapPoints}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}
        modal={false}
        noBodyStyles
      >
        <Drawer.Portal>
          <Drawer.Content
            className="fixed flex flex-col bg-white dark:bg-gray-900 rounded-t-[10px] bottom-0 left-0 right-0 h-full max-h-[97%] !z-[1100] shadow-[0_-10px_40px_rgba(0,0,0,0.2)]"
            aria-describedby={undefined}
          >
            {/* Handle bar + explicit close button */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1 flex-shrink-0">
              <div className="w-8" />
              <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600" />
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <Drawer.Title className="sr-only">{categoryName}</Drawer.Title>
              {content}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  // Desktop: Side Panel
  return (
    <div
      className={`absolute top-0 left-0 h-full w-96 flex flex-col bg-white dark:bg-gray-900 shadow-2xl z-[1000] transform transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Close Button - z-[60] so it stays above header image overlays (z-10/z-20) */}
      <button
        onClick={() => {
          onClose();
        }}
        className="absolute top-4 right-4 z-[60] p-2 rounded-full bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 shadow-lg transition-colors"
        aria-label="Close"
      >
        <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
      </button>

      {content}
    </div>
  );
});

MapPOIPanel.displayName = "MapPOIPanel";

// ─── CategorySelect ───────────────────────────────────────────────────────────

function CategorySelect({
  value,
  onChange,
}: {
  value: POICategory;
  onChange: (cat: POICategory) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = getCategoryById(value);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("touchstart", handle);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("touchstart", handle);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
      >
        <span
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base"
          style={{ backgroundColor: selected?.bgColor }}
        >
          {selected?.icon}
        </span>
        <span className="flex-1 text-left text-sm font-medium text-gray-900 dark:text-white">
          {selected?.name}
        </span>
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: selected?.color }}
        />
        <ChevronDown
          className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-[70] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="grid grid-cols-4 gap-1 p-2 max-h-56 overflow-y-auto">
            {POI_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  onChange(cat.id);
                  setOpen(false);
                }}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-95 ${
                  value === cat.id
                    ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
                  style={{ backgroundColor: cat.bgColor }}
                >
                  {cat.icon}
                </span>
                <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 leading-tight text-center line-clamp-1">
                  {cat.name.split(" ")[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
