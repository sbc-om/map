"use client";

import { memo } from "react";
import { MapThemeSwitcher } from "./MapThemeSwitcher";
import { MapUser } from "./MapUser";

/**
 * MapTopBar - minimal top-right controls (theme switcher + user avatar).
 * Category quick-access chips have moved into MapSearchBar.
 */
export const MapTopBar = memo(function MapTopBar() {
  return (
    <div className="absolute right-0 top-3 z-[1000] pointer-events-none pr-4">
      <div className="hidden sm:flex items-center gap-2 pointer-events-auto">
        <MapThemeSwitcher />
        <MapUser />
      </div>
    </div>
  );
});

MapTopBar.displayName = "MapTopBar";
