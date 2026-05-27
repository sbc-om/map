/**
 * Tile provider configurations
 */

import type { TileProvider } from "@/types/map";

/**
 * Available tile providers
 */
export const TILE_PROVIDERS: TileProvider[] = [
  {
    id: "osm",
    name: "Standard",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    category: "standard",
  },
  {
    id: "satellite",
    name: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, GeoEye, Earthstar Geographics',
    maxZoom: 18,
    category: "satellite",
  },
  {
    id: "dark",
    name: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    category: "dark",
  },
  {
    id: "light",
    name: "Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    category: "standard",
  },
  {
    id: "terrain",
    name: "Terrain",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
    category: "standard",
  },
  {
    id: "streets",
    name: "Streets",
    url: "https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 20,
    category: "standard",
  },
];

export const DEFAULT_TILE_PROVIDER_ID = "osm";

export function getTileProviderById(id: string): TileProvider | undefined {
  return TILE_PROVIDERS.find((p) => p.id === id);
}

export function getDefaultTileProvider(): TileProvider {
  return (
    TILE_PROVIDERS.find((p) => p.id === DEFAULT_TILE_PROVIDER_ID) ??
    TILE_PROVIDERS[0]
  );
}
