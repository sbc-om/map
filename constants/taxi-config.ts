/**
 * Taxi dispatch configuration constants (OmanTaxi)
 */

import type { VehicleType } from "@/types/taxi";

/** Fare model — values in OMR */
export const FARE_CONFIG = {
  /** Flat fee applied to every ride */
  baseFare: 1.0,
  /** Cost per kilometre */
  perKm: 0.25,
  /** Cost per minute of estimated travel time */
  perMinute: 0.05,
  /** Minimum fare charged regardless of distance */
  minimumFare: 1.0,
  currency: "OMR",
} as const;

/** How often an online driver broadcasts its GPS position (ms) */
export const DRIVER_GPS_INTERVAL_MS = 5_000;

/** A driver is considered stale/offline if not seen for this long (ms) */
export const DRIVER_STALE_MS = 30_000;

/** Simulated time for an accepted driver to reach the pickup (ms) — 3 minutes */
export const DRIVER_APPROACH_MS = 180_000;

/** Simulated time to drive the passenger from pickup to destination (ms) — 4 minutes */
export const DRIVER_TRIP_MS = 240_000;

/** How often the approach simulation broadcasts a new position (ms) */
export const APPROACH_TICK_MS = 1_000;

/** Maximum search radius for the matching engine (kilometres) */
export const MATCH_RADIUS_KM = 15;

/** Default pickup location when geolocation is unavailable (Muscat) */
export const DEFAULT_PICKUP: [number, number] = [23.588, 58.3829];

/** Vehicle type presentation metadata */
export const VEHICLE_TYPES: Record<
  VehicleType,
  { label: string; description: string; emoji: string }
> = {
  taxi: {
    label: "Taxi",
    description: "Classic metered taxi",
    emoji: "🚕",
  },
  economy: {
    label: "Economy",
    description: "Affordable everyday rides",
    emoji: "🚗",
  },
  comfort: {
    label: "Comfort",
    description: "Newer cars with extra legroom",
    emoji: "🚙",
  },
  xl: {
    label: "XL",
    description: "Up to 6 seats",
    emoji: "🚐",
  },
  bike: {
    label: "Bike",
    description: "Quick & low-cost",
    emoji: "🏍️",
  },
};
