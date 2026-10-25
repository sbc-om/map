/**
 * Lazy MapLibre GL loader.
 *
 * The library is imported on demand so the page shell renders before the
 * ~220 KB (gzip) map engine arrives. Once a map exists the module is cached,
 * so markers and controls can be created synchronously with `maplibre()`.
 */

type MapLibre = typeof import("maplibre-gl");

/** Shapes Arabic/Persian labels; loaded only when such text is first drawn. */
const RTL_PLUGIN_URL =
  "https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js";

let loaded: MapLibre | null = null;
let loading: Promise<MapLibre> | null = null;

export function loadMapLibre(): Promise<MapLibre> {
  if (loaded) return Promise.resolve(loaded);
  loading ??= import("maplibre-gl").then((mod) => {
    const lib = ((mod as unknown as { default?: MapLibre }).default ?? mod) as MapLibre;
    if (lib.getRTLTextPluginStatus() === "unavailable") {
      lib.setRTLTextPlugin(RTL_PLUGIN_URL, true).catch(() => {
        /* labels still render, only without RTL shaping */
      });
    }
    loaded = lib;
    return lib;
  });
  return loading;
}

/** The loaded module. Safe wherever a map instance already exists. */
export function maplibre(): MapLibre {
  if (!loaded) throw new Error("MapLibre GL has not been loaded yet");
  return loaded;
}
