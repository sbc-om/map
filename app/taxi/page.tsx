import { MapProvider, MapErrorBoundary, MapLoadingSpinner } from "@/components/map";
import { TaxiMain } from "@/components/taxi";

/**
 * OmanTaxi dispatch page (Server Component).
 *
 * Wraps the taxi experience in the shared MapProvider so passenger and driver
 * flows can use the Leaflet map. The role is preselected client-side from the
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
