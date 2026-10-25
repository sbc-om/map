import { useMemo } from "react";
import { useTheme } from "@/hooks/useTheme";
import { getMapStyleById, getDefaultMapStyle } from "@/constants/map-styles";
import type { MapStyleOption } from "@/types/map";

/**
 * Basemap style that follows the app theme: streets in light mode, the dark
 * vector style in dark mode. An explicit `overrideId` (e.g. satellite) wins.
 */
export function useMapStyle(overrideId?: string | null) {
  const { theme } = useTheme();

  const mapStyle = useMemo<MapStyleOption>(() => {
    const override = overrideId ? getMapStyleById(overrideId) : undefined;
    if (override) return override;
    if (theme === "dark") return getMapStyleById("dark") ?? getDefaultMapStyle();
    return getDefaultMapStyle();
  }, [theme, overrideId]);

  return { mapStyle, currentStyleId: mapStyle.id };
}
