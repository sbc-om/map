import { MapProvider } from "@/contexts/MapContext";
import { MapErrorBoundary } from "@/components/map/MapErrorBoundary";
import { MapLoadingSpinner } from "@/components/map/MapLoadingSpinner";
import { TaxiMain } from "@/components/taxi";

/**
 * Taxi dispatch page (Server Component).
 *
 * Wraps the taxi experience in the shared MapProvider so passenger and driver
 * flows can use the MapLibre map. The role is preselected client-side from the
 * `?mode=passenger|driver` query (the app uses static `output: "export"`).
 */
export default function TaxiPage() {
  return (
    <div className="relative h-dvh-screen w-full">
      <MapErrorBoundary>
        <MapProvider>
          <TaxiMain />
          <MapLoadingSpinner />
        </MapProvider>
      </MapErrorBoundary>
    </div>
  );
}
