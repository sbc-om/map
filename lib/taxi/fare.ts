/**
 * Fare calculation for the taxi dispatch module.
 *
 * Estimated Fare = Base Fare + (Distance × Per KM) + (Duration × Per Minute)
 */

import { FARE_CONFIG } from "@/constants/taxi-config";
import type { FareBreakdown } from "@/types/taxi";

/**
 * Calculate an estimated fare from route metrics.
 *
 * @param distanceMeters Total route distance in metres.
 * @param durationSeconds Total route duration in seconds.
 */
export function calculateFare(
  distanceMeters: number,
  durationSeconds: number
): FareBreakdown {
  const { baseFare, perKm, perMinute, minimumFare, currency } = FARE_CONFIG;

  const distanceKm = distanceMeters / 1000;
  const durationMin = durationSeconds / 60;

  const distanceCost = distanceKm * perKm;
  const timeCost = durationMin * perMinute;

  const total = Math.max(minimumFare, baseFare + distanceCost + timeCost);

  return {
    baseFare,
    perKm,
    perMinute,
    distanceKm: round(distanceKm, 1),
    durationMin: Math.round(durationMin),
    distanceCost: round(distanceCost, 3),
    timeCost: round(timeCost, 3),
    total: round(total, 2),
    currency,
  };
}

/** Format a monetary amount with the configured currency. */
export function formatFare(amount: number): string {
  return `${amount.toFixed(2)} ${FARE_CONFIG.currency}`;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
