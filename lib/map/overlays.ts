/**
 * App-drawn GeoJSON overlays (routes, measurements, highlighted areas).
 *
 * `map.setStyle()` (theme or basemap switch) wipes every source and layer the
 * app added. Overlays are therefore kept in a per-map registry and re-added
 * automatically whenever a new style finishes loading, so callers never have
 * to care about basemap changes.
 */

import type {
  GeoJSONSource,
  LayerSpecification,
  Map as MapLibreMap,
} from "maplibre-gl";
import { prefersReducedMotion } from "@/lib/utils/map-motion";

type OverlayLayer = Omit<LayerSpecification, "source" | "id"> & {
  /** Suffix appended to the overlay id to form the layer id */
  id: string;
};

interface Overlay {
  data: GeoJSON.GeoJSON;
  layers: OverlayLayer[];
  /** Draw beneath the basemap's labels so street names stay readable */
  belowLabels: boolean;
}

const registries = new WeakMap<MapLibreMap, Map<string, Overlay>>();

function registryFor(map: MapLibreMap) {
  let registry = registries.get(map);
  if (!registry) {
    const created = new Map<string, Overlay>();
    registries.set(map, created);
    map.on("style.load", () => {
      for (const [id, overlay] of created) mount(map, id, overlay);
    });
    registry = created;
  }
  return registry;
}

function firstLabelLayerId(map: MapLibreMap): string | undefined {
  return map.getStyle()?.layers?.find((l) => l.type === "symbol")?.id;
}

function layerIds(map: MapLibreMap, id: string) {
  return (map.getStyle()?.layers ?? [])
    .map((l) => l.id)
    .filter((layerId) => layerId === id || layerId.startsWith(`${id}:`));
}

function unmount(map: MapLibreMap, id: string) {
  if (!map.getStyle()) return;
  for (const layerId of layerIds(map, id)) map.removeLayer(layerId);
  if (map.getSource(id)) map.removeSource(id);
}

function mount(map: MapLibreMap, id: string, overlay: Overlay) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  if (source) {
    source.setData(overlay.data);
    return;
  }
  map.addSource(id, { type: "geojson", data: overlay.data, lineMetrics: true });
  const before = overlay.belowLabels ? firstLabelLayerId(map) : undefined;
  for (const layer of overlay.layers) {
    map.addLayer(
      { ...layer, id: `${id}:${layer.id}`, source: id } as LayerSpecification,
      before
    );
  }
}

/**
 * Add or update an overlay. Layers are only created the first time; later
 * calls with the same id just swap the data (cheap, flicker-free).
 */
export function setOverlay(
  map: MapLibreMap,
  id: string,
  data: GeoJSON.GeoJSON,
  layers: OverlayLayer[],
  { belowLabels = true }: { belowLabels?: boolean } = {}
) {
  const overlay: Overlay = { data, layers, belowLabels };
  registryFor(map).set(id, overlay);
  try {
    mount(map, id, overlay);
  } catch {
    // Style mid-swap; the style.load handler mounts it shortly.
  }
}

export function removeOverlay(map: MapLibreMap, id: string) {
  registries.get(map)?.delete(id);
  cancelDraw(id);
  try {
    unmount(map, id);
  } catch {
    // Map already removed
  }
}

export function lineFeature(coordinates: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } };
}

export function featureCollection(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features };
}

const drawFrames = new Map<string, number>();

function cancelDraw(id: string) {
  const frame = drawFrames.get(id);
  if (frame !== undefined) cancelAnimationFrame(frame);
  drawFrames.delete(id);
}

/**
 * Draw a line overlay progressively from its first to its last point, as if
 * the route were being traced. Coordinates are `[lng, lat]`.
 */
export function animateLineOverlay(
  map: MapLibreMap,
  id: string,
  coordinates: [number, number][],
  layers: OverlayLayer[],
  durationMs = 1100
) {
  cancelDraw(id);
  if (prefersReducedMotion() || coordinates.length < 3) {
    setOverlay(map, id, lineFeature(coordinates), layers);
    return;
  }

  // Cumulative segment lengths so the line grows at constant speed
  const lengths = [0];
  for (let i = 1; i < coordinates.length; i++) {
    const [x1, y1] = coordinates[i - 1];
    const [x2, y2] = coordinates[i];
    lengths.push(lengths[i - 1] + Math.hypot(x2 - x1, y2 - y1));
  }
  const total = lengths[lengths.length - 1] || 1;
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const start = performance.now();

  const partial = (target: number): [number, number][] => {
    let i = 1;
    while (i < lengths.length && lengths[i] < target) i++;
    if (i >= lengths.length) return coordinates;
    const [x1, y1] = coordinates[i - 1];
    const [x2, y2] = coordinates[i];
    const seg = lengths[i] - lengths[i - 1] || 1;
    const k = (target - lengths[i - 1]) / seg;
    return [...coordinates.slice(0, i), [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k]];
  };

  const step = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    const path = t >= 1 ? coordinates : partial(ease(t) * total);
    setOverlay(map, id, lineFeature(path.length > 1 ? path : coordinates.slice(0, 2)), layers);
    if (t < 1) drawFrames.set(id, requestAnimationFrame(step));
    else drawFrames.delete(id);
  };
  drawFrames.set(id, requestAnimationFrame(step));
}
