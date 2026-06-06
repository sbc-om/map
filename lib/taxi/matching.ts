/**
 * Driver matching engine for the taxi module.
 *
 * Given a ride request, find online drivers within range and rank them by
 * proximity to the pickup location.
 */

import { DRIVER_STALE_MS, MATCH_RADIUS_KM } from "@/constants/taxi-config";
import type { DriverSession, LatLng, RideRequest } from "@/types/taxi";

/** Great-circle distance between two points in kilometres (Haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface DriverMatch {
  driver: DriverSession;
  distanceKm: number;
}

/**
 * Find candidate drivers for a ride request.
 *
 * Conditions:
 * - Driver status is ONLINE.
 * - Driver has a recent GPS heartbeat (not stale).
 * - Driver is within {@link MATCH_RADIUS_KM} of the pickup point.
 *
 * Results are sorted nearest-first.
 */
export function findNearbyDrivers(
  request: Pick<RideRequest, "pickup">,
  drivers: DriverSession[],
  radiusKm: number = MATCH_RADIUS_KM,
  now: number = Date.now()
): DriverMatch[] {
  const pickup = request.pickup;

  return drivers
    .filter(
      (d) =>
        d.status === "ONLINE" &&
        d.location !== null &&
        now - d.lastSeen <= DRIVER_STALE_MS
    )
    .map((driver) => ({
      driver,
      distanceKm: haversineKm(pickup, driver.location as LatLng),
    }))
    .filter((match) => match.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
