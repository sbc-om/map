/**
 * Tile provider configurations
 *
 * Every provider lists `fallbackUrls`. LeafletTileLayer switches to the next
 * URL automatically when the current server is blocked, rate-limited or too
 * slow, so the basemap never stays blank because one CDN is unreachable.
 *
 * Only key-less servers are used. CARTO basemaps now answer every request
 * with an "API KEY REQUIRED" placeholder image (HTTP 200, so failover cannot
 * detect it), which is what blanked the old dark theme.
 */

import type { TileProvider } from "@/types/map";

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const ESRI_ATTRIBUTION = '&copy; <a href="https://www.esri.com/">Esri</a>';

// OSM retired the a/b/c subdomains; the single host is the supported endpoint.
const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_HOT_URL = "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png";
const ESRI_STREET_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const ESRI_TOPO_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}";
const ESRI_IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/**
 * Available tile providers
 */
export const TILE_PROVIDERS: TileProvider[] = [
  {
    id: "streets",
    name: "Streets",
    url: OSM_URL,
    fallbackUrls: [ESRI_STREET_URL, OSM_HOT_URL],
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
    category: "standard",
  },
  {
    id: "humanitarian",
    name: "Humanitarian",
    url: OSM_HOT_URL,
    fallbackUrls: [OSM_URL, ESRI_STREET_URL],
    attribution: `${OSM_ATTRIBUTION}, Humanitarian OpenStreetMap Team`,
    maxZoom: 19,
    category: "standard",
  },
  {
    id: "satellite",
    name: "Satellite",
    url: ESRI_IMAGERY_URL,
    fallbackUrls: [],
    attribution: `${ESRI_ATTRIBUTION}, Maxar, GeoEye, Earthstar Geographics`,
    maxZoom: 19,
    category: "satellite",
  },
  {
    id: "dark",
    name: "Dark",
    // The full-detail street map, re-tinted by the `map-tiles-dark` CSS filter
    url: OSM_URL,
    fallbackUrls: [ESRI_STREET_URL, OSM_HOT_URL],
    className: "map-tiles-dark",
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
    category: "dark",
  },
  {
    id: "terrain",
    name: "Terrain",
    url: ESRI_TOPO_URL,
    fallbackUrls: ["https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", OSM_URL],
    attribution: `${ESRI_ATTRIBUTION}, ${OSM_ATTRIBUTION}`,
    maxZoom: 19,
    category: "standard",
  },
];

export const DEFAULT_TILE_PROVIDER_ID = "streets";

export function getTileProviderById(id: string): TileProvider | undefined {
  return TILE_PROVIDERS.find((p) => p.id === id);
}

export function getDefaultTileProvider(): TileProvider {
  return (
    TILE_PROVIDERS.find((p) => p.id === DEFAULT_TILE_PROVIDER_ID) ??
    TILE_PROVIDERS[0]
  );
}
