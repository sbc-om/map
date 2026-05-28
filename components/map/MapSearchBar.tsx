"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
} from "react";
import {
  Search,
  ChevronRight,
  MapPin,
  Ruler,
  Locate,
  Navigation2,
  X,
  Clock,
  Globe2,
  Building2,
  RouteOff,
  Landmark,
  Utensils,
  Hotel,
  Compass,
  Bus,
} from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useLeafletMap } from "@/hooks/useLeafletMap";
import { MapUser } from "./MapUser";
import { searchCountries, type Country } from "@/lib/countries";

// ─── Category quick-access chips ─────────────────────────────────────────────

const QUICK_CATEGORIES = [
  { icon: Utensils, label: "Restaurants", id: "restaurants" },
  { icon: Hotel,    label: "Hotels",      id: "hotels" },
  { icon: Compass,  label: "Attractions", id: "attractions" },
  { icon: Bus,      label: "Transit",     id: "transit" },
] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

interface GeoResult {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  type: "country" | "city" | "address" | "poi" | "region";
  countryId?: string; // for country results only
  icon: React.ReactNode;
}

interface MapSearchBarProps {
  onCountrySelect: (countryId: string) => void;
  selectedCountry?: GeoJSON.Feature | null;
  onClearSelection?: () => void;
  onMeasurementClick?: () => void;
  onPOIClick?: () => void;
  onDirectionsClick?: () => void;
  onCategoryClick?: (categoryId: string) => void;
  /** When any left-side panel is open, hide on mobile and shift right on sm+ */
  leftPanelOpen?: boolean;
}

// ─── Nominatim search ─────────────────────────────────────────────────────────

interface NominatimResult {
  place_id: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  addresstype?: string;
  address?: {
    country?: string;
    country_code?: string;
    city?: string;
    town?: string;
    state?: string;
  };
}

function nominatimType(r: NominatimResult): GeoResult["type"] {
  const cls = r.class;
  const type = r.type;
  if (cls === "boundary" || type === "country") return "country";
  if (cls === "place" && ["city", "town", "village"].includes(type))
    return "city";
  if (cls === "highway" || cls === "road") return "address";
  if (
    cls === "amenity" ||
    cls === "tourism" ||
    cls === "leisure" ||
    cls === "natural"
  )
    return "poi";
  return "region";
}

function typeIcon(t: GeoResult["type"]): React.ReactNode {
  switch (t) {
    case "country":
      return <Globe2 className="h-4 w-4 text-blue-500" />;
    case "city":
      return <Building2 className="h-4 w-4 text-emerald-500" />;
    case "address":
      return <RouteOff className="h-4 w-4 text-orange-400" />;
    case "poi":
      return <Landmark className="h-4 w-4 text-purple-500" />;
    default:
      return <MapPin className="h-4 w-4 text-gray-400" />;
  }
}

async function searchNominatim(query: string): Promise<NominatimResult[]> {
  if (!query.trim()) return [];
  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1&accept-language=en`;
  const res = await fetch(url, {
    headers: { "User-Agent": "SBCMap/1.0 (https://map.sbc.om)" },
  });
  if (!res.ok) return [];
  return res.json();
}

/** Parse "lat, lng" coordinate strings */
function parseCoordinates(
  input: string
): { lat: number; lng: number } | null {
  const clean = input.replace(/[°'"NSEW\s]/gi, " ").trim();
  const parts = clean.split(/[,\s]+/).filter(Boolean);
  if (parts.length === 2) {
    const [a, b] = parts.map(Number);
    if (!isNaN(a) && !isNaN(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180) {
      return { lat: a, lng: b };
    }
  }
  return null;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * MapSearchBar - full geocoding search powered by Nominatim.
 *
 * Searches places, addresses, cities, POIs, landmarks globally.
 * Falls back to country list from lib/countries when needed.
 * Also handles direct coordinate input (e.g. "23.588, 58.383").
 */
export function MapSearchBar({
  onCountrySelect,
  selectedCountry,
  onClearSelection,
  onMeasurementClick,
  onPOIClick,
  onDirectionsClick,
  onCategoryClick,
  leftPanelOpen = false,
}: MapSearchBarProps) {
  const map = useLeafletMap();
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [, startTransition] = useTransition();

  const { locateUser, isLocating, isAvailable } = useGeolocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sbcmap_recent_searches");
      if (stored) setRecentSearches(JSON.parse(stored).slice(0, 5));
    } catch {
      /* ignore */
    }
  }, []);

  const saveToRecent = useCallback((result: GeoResult) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((r) => r.id !== result.id);
      const next = [result, ...filtered].slice(0, 5);
      try {
        localStorage.setItem("sbcmap_recent_searches", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Search: Nominatim + country list
  useEffect(() => {
    if (!isExpanded) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Check coordinate input first
    const coords = parseCoordinates(query);
    if (coords) {
      const coordResult: GeoResult = {
        id: `coord-${coords.lat}-${coords.lng}`,
        name: `${coords.lat.toFixed(5)}°, ${coords.lng.toFixed(5)}°`,
        displayName: `Coordinates: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
        lat: coords.lat,
        lng: coords.lng,
        type: "poi",
        icon: <MapPin className="h-4 w-4 text-amber-500" />,
      };
      setResults([coordResult]);
      setLoading(false);
      return;
    }

    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const [nominatimRaw, countries] = await Promise.all([
          searchNominatim(query),
          searchCountries(query),
        ]);

        // Convert Nominatim results
        const nominatimResults: GeoResult[] = nominatimRaw.map((r) => {
          const t = nominatimType(r);
          const parts = r.display_name.split(",");
          const name = r.name || parts[0].trim();
          const subtitle = parts
            .slice(1)
            .filter((p) => p.trim())
            .slice(0, 2)
            .join(",")
            .trim();
          return {
            id: `nom-${r.place_id}`,
            name,
            displayName: subtitle || r.display_name,
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
            type: t,
            icon: typeIcon(t),
          };
        });

        // Convert country results (for GeoJSON boundary highlight)
        const countryResults: GeoResult[] = countries.slice(0, 3).map((c) => ({
          id: `country-${c.id}`,
          name: c.name,
          displayName: c.nameLong ?? c.name,
          lat: 0,
          lng: 0,
          type: "country" as const,
          countryId: c.id,
          icon: <Globe2 className="h-4 w-4 text-blue-500" />,
        }));

        // Merge: Nominatim first, then any unique country results
        const nominatimIds = new Set(nominatimResults.map((r) => r.name));
        const uniqueCountries = countryResults.filter(
          (c) => !nominatimIds.has(c.name)
        );

        startTransition(() => {
          setResults([...nominatimResults, ...uniqueCountries].slice(0, 8));
          setLoading(false);
        });
      } catch {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isExpanded]);

  // Select a result
  const handleSelect = useCallback(
    async (result: GeoResult) => {
      saveToRecent(result);
      setIsExpanded(false);
      setQuery("");
      setSelectedIndex(-1);

      if (result.countryId) {
        // Load GeoJSON boundary for countries
        onCountrySelect(result.countryId);
      } else {
        // Fly directly to coordinates
        if (map) {
          const L = await import("leaflet");
          const zoomLevel =
            result.type === "country"
              ? 5
              : result.type === "city"
                ? 12
                : result.type === "address"
                  ? 16
                  : 14;

          map.flyTo(L.latLng(result.lat, result.lng), zoomLevel, {
            animate: true,
            duration: 1.5,
          });
        }
      }
    },
    [map, onCountrySelect, saveToRecent]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const list = results.length ? results : recentSearches;
      if (!isExpanded || !list.length) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((p) => Math.min(p + 1, list.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((p) => Math.max(p - 1, -1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < list.length)
            handleSelect(list[selectedIndex]);
          break;
        case "Escape":
          e.preventDefault();
          setIsExpanded(false);
          inputRef.current?.blur();
          break;
      }
    },
    [isExpanded, results, recentSearches, selectedIndex, handleSelect]
  );

  // Scroll item into view
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Reset index on query change
  useEffect(() => setSelectedIndex(-1), [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (isExpanded && !t.closest(".search-container"))
        setIsExpanded(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isExpanded]);

  const handleLocateMe = useCallback(() => {
    locateUser();
    setIsExpanded(false);
  }, [locateUser]);

  const selectedName =
    (selectedCountry?.properties?.NAME as string | undefined) ?? "";
  const hasSelection = !!selectedCountry;

  // Determine which list to show
  const showRecent =
    isExpanded && !query.trim() && recentSearches.length > 0 && !loading;
  const showResults =
    isExpanded && (query.trim() ? true : false) && !loading;
  const showEmpty =
    isExpanded &&
    query.trim() &&
    !loading &&
    results.length === 0;

  return (
    <div
      className={`search-container absolute top-3 z-[1001] transition-all duration-300 ease-out ${
        leftPanelOpen
          ? "hidden sm:block sm:left-[400px] sm:right-4"
          : "left-0 right-0 sm:left-4 sm:right-auto px-3 sm:px-0"
      }`}
    >
      {/* ── Search Box ── */}
      <div
        className={`flex items-center gap-2 bg-white dark:bg-gray-900/95 backdrop-blur-md px-3.5 sm:px-4 py-2 sm:py-2.5 shadow-lg shadow-black/8 transition-all duration-200 ${
          isExpanded ? "rounded-t-2xl" : "rounded-full"
        } w-full sm:w-[390px] border border-gray-100 dark:border-gray-800/80`}
      >
        {hasSelection ? (
          <>
            <MapPin className="h-5 w-5 flex-shrink-0 text-blue-500" />
            <span className="text-sm text-gray-800 dark:text-gray-200 font-semibold flex-1 truncate">
              {selectedName}
            </span>
            <button
              onClick={() => {
                onClearSelection?.();
                setIsExpanded(false);
              }}
              className="h-5 w-5 flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Clear"
            >
              <X className="h-5 w-5" />
            </button>
          </>
        ) : (
          <>
            {loading ? (
              <div className="h-5 w-5 flex-shrink-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="h-5 w-5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
            )}
            <input
              ref={inputRef}
              type="text"
              placeholder="Search places, addresses, coordinates…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsExpanded(true)}
              onKeyDown={handleKeyDown}
              className="border-none bg-transparent text-sm text-gray-800 dark:text-gray-200 font-medium outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 w-full"
              autoComplete="off"
              aria-label="Search"
              aria-autocomplete="list"
            />
            {query && (
              <button
                onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </>
        )}

        {/* Separator + Locate */}
        {!hasSelection && (
          <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-600 pl-3">
            <button
              onClick={handleLocateMe}
              disabled={!isAvailable || isLocating}
              className={`hidden sm:block text-blue-500 hover:text-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isLocating ? "animate-pulse" : ""}`}
              aria-label="My location"
              title="Locate me"
            >
              <Locate className="h-4.5 w-4.5" />
            </button>
            <div className="sm:hidden">
              <MapUser />
            </div>
          </div>
        )}
      </div>

      {/* ── Dropdown Panel ── */}
      <div
        className={`overflow-hidden bg-white dark:bg-gray-900/95 backdrop-blur-md border-x border-b border-gray-100 dark:border-gray-800/80 shadow-xl shadow-black/10 transition-all duration-200 ease-out ${
          isExpanded
            ? "max-h-[480px] opacity-100 rounded-b-2xl"
            : "max-h-0 opacity-0 pointer-events-none"
        } w-full sm:w-[390px]`}
        role="listbox"
        aria-label="Search results"
      >
        {/* Recent searches (when no query) */}
        {showRecent && (
          <div className="overflow-y-auto max-h-[260px]">
            <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Recent
              </span>
            </div>
            {recentSearches.map((r, i) => (
              <SearchResultItem
                key={r.id}
                result={r}
                isSelected={selectedIndex === i}
                ref={(el) => { itemRefs.current[i] = el; }}
                onSelect={() => handleSelect(r)}
                onHover={() => setSelectedIndex(i)}
              />
            ))}
          </div>
        )}

        {/* Search results */}
        {showResults && (
          <div className="overflow-y-auto max-h-[340px]">
            {results.map((r, i) => (
              <SearchResultItem
                key={r.id}
                result={r}
                isSelected={selectedIndex === i}
                ref={(el) => { itemRefs.current[i] = el; }}
                onSelect={() => handleSelect(r)}
                onHover={() => setSelectedIndex(i)}
              />
            ))}
          </div>
        )}

        {/* Loading */}
        {isExpanded && loading && (
          <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            Searching…
          </div>
        )}

        {/* No results */}
        {showEmpty && (
          <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            No results for &quot;{query}&quot;
          </div>
        )}

        {/* ── Categories ── */}
        {onCategoryClick && (
          <div className="border-t border-gray-100 dark:border-gray-700/50 px-3 pt-3 pb-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">
              Explore
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_CATEGORIES.map((cat) => (
                <ToolButton
                  key={cat.id}
                  icon={<cat.icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
                  label={cat.label}
                  onClick={() => {
                    onCategoryClick(cat.id);
                    setIsExpanded(false);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Map Tools ── */}
        <div className="border-t border-gray-100 dark:border-gray-700/50 px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">
            Tools
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <ToolButton
              icon={<Ruler className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
              label="Measure"
              onClick={() => {
                onMeasurementClick?.();
                setIsExpanded(false);
              }}
            />
            <ToolButton
              icon={<MapPin className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
              label="My Places"
              onClick={() => {
                onPOIClick?.();
                setIsExpanded(false);
              }}
            />
            <ToolButton
              icon={<Navigation2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
              label="Directions"
              onClick={() => {
                onDirectionsClick?.();
                setIsExpanded(false);
              }}
            />
            <ToolButton
              icon={<Locate className="h-4 w-4 text-orange-500" />}
              label="Locate Me"
              onClick={handleLocateMe}
              disabled={!isAvailable || isLocating}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

import { forwardRef } from "react";

const SearchResultItem = forwardRef<
  HTMLButtonElement,
  {
    result: GeoResult;
    isSelected: boolean;
    onSelect: () => void;
    onHover: () => void;
  }
>(({ result, isSelected, onSelect, onHover }, ref) => (
  <button
    ref={ref}
    role="option"
    aria-selected={isSelected}
    onClick={onSelect}
    onMouseEnter={onHover}
    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
      isSelected
        ? "bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-500"
        : "hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-2 border-transparent"
    }`}
  >
    <span className="flex-shrink-0">{result.icon}</span>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
        {result.name}
      </div>
      {result.displayName && result.displayName !== result.name && (
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
          {result.displayName}
        </div>
      )}
    </div>
    {isSelected && (
      <ChevronRight className="h-4 w-4 text-blue-500 flex-shrink-0" />
    )}
  </button>
));
SearchResultItem.displayName = "SearchResultItem";

function ToolButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 px-2 py-2 rounded-xl bg-gray-100 dark:bg-gray-700/70 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {icon}
      <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300 leading-tight text-center">
        {label}
      </span>
    </button>
  );
}
