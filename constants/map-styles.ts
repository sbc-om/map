/**
 * Basemap styles rendered by MapLibre GL.
 *
 * The vector styles come from OpenFreeMap: free, key-less and without request
 * limits. Vector tiles are drawn on the GPU, so the map zooms continuously and
 * never shows the grey "block by block" squares of raster tile maps.
 */

import type { StyleSpecification } from "maplibre-gl";
import type { MapStyleOption } from "@/types/map";

const OPENFREEMAP = "https://tiles.openfreemap.org/styles";

/** Esri World Imagery wrapped in a minimal style (no vector satellite source is key-less). */
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    imagery: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "&copy; Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [{ id: "imagery", type: "raster", source: "imagery" }],
};

export const MAP_STYLES: MapStyleOption[] = [
  { id: "streets", name: "Streets", style: `${OPENFREEMAP}/liberty`, category: "standard" },
  { id: "light", name: "Light", style: `${OPENFREEMAP}/positron`, category: "standard" },
  { id: "dark", name: "Dark", style: `${OPENFREEMAP}/dark`, category: "dark" },
  { id: "satellite", name: "Satellite", style: SATELLITE_STYLE, category: "satellite" },
];

export const DEFAULT_MAP_STYLE_ID = "streets";

export function getMapStyleById(id: string): MapStyleOption | undefined {
  return MAP_STYLES.find((s) => s.id === id);
}

export function getDefaultMapStyle(): MapStyleOption {
  return getMapStyleById(DEFAULT_MAP_STYLE_ID) ?? MAP_STYLES[0];
}
