import { useMemo } from "react";
import { useTheme } from "@/hooks/useTheme";
import {
  getTileProviderById,
  getDefaultTileProvider,
} from "@/constants/tile-providers";
import type { TileProvider } from "@/types/map";

/**
 * Custom hook to manage the base map from the app theme only.
 *
 * Light theme → default/standard basemap
 * Dark theme → dark basemap
 * 
 * Map-style switching is intentionally disabled to keep the UI minimal.
 */
export function useMapTileProvider() {
  const { theme } = useTheme();

  const tileProvider = useMemo<TileProvider>(() => {
    if (theme === "dark") {
      return getTileProviderById("dark") || getDefaultTileProvider();
    }

    return getDefaultTileProvider();
  }, [theme]);

  return {
    tileProvider,
    currentProviderId: theme === "dark" ? "dark" : "osm",
  };
}
