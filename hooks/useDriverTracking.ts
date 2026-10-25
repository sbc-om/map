"use client";

/**
 * Keeps an online driver visible to passengers. Every
 * {@link DRIVER_GPS_INTERVAL_MS} ms it publishes a heartbeat: the latest GPS
 * fix when GPS positioning is in use, otherwise just a fresh `lastSeen` so a
 * driver positioned by hand on the map doesn't go stale for passengers.
 */

import { useEffect, useRef } from "react";
import { DRIVER_GPS_INTERVAL_MS } from "@/constants/taxi-config";
import { touchDriver, updateDriverLocation } from "@/lib/taxi/actions";
import type { LatLng } from "@/types/taxi";

/** Hard cap on a one-off GPS request, including an unanswered permission prompt. */
const POSITION_TIMEOUT_MS = 12_000;

/**
 * One GPS fix as a promise. Unlike the `timeout` option of
 * `getCurrentPosition`, this also rejects when the user never answers the
 * permission prompt, so callers can't hang waiting.
 */
export function getCurrentPositionOnce(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported"));
      return;
    }
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for location")),
      POSITION_TIMEOUT_MS
    );
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 15_000 }
    );
  });
}

export function useDriverTracking(
  driverId: string | null,
  enabled: boolean,
  useGps: boolean
): void {
  const lastFixRef = useRef<LatLng | null>(null);

  useEffect(() => {
    if (!enabled || !driverId) return;

    let watchId: number | null = null;
    lastFixRef.current = null;

    if (useGps && typeof navigator !== "undefined" && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const isFirstFix = lastFixRef.current === null;
          lastFixRef.current = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          // Show the first fix right away instead of waiting for the heartbeat
          if (isFirstFix) updateDriverLocation(driverId, lastFixRef.current);
        },
        () => {
          /* ignore transient errors; heartbeat keeps last known fix */
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 10_000 }
      );
    }

    const heartbeat = setInterval(() => {
      const fix = lastFixRef.current;
      if (useGps && fix) updateDriverLocation(driverId, fix);
      else touchDriver(driverId);
    }, DRIVER_GPS_INTERVAL_MS);

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearInterval(heartbeat);
    };
  }, [driverId, enabled, useGps]);
}
