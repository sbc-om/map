"use client";

/**
 * Tracks an online driver's GPS position and broadcasts it to the store on a
 * fixed interval (every {@link DRIVER_GPS_INTERVAL_MS} ms), simulating the
 * continuous location updates a real driver app would emit.
 */

import { useEffect, useRef } from "react";
import { DRIVER_GPS_INTERVAL_MS } from "@/constants/taxi-config";
import { updateDriverLocation } from "@/lib/taxi/actions";

export function useDriverTracking(
  driverId: string | null,
  enabled: boolean
): void {
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFixRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!enabled || !driverId || typeof navigator === "undefined") {
      return;
    }
    if (!("geolocation" in navigator)) return;

    // Continuously watch the device position; cache the latest fix.
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        lastFixRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
      },
      () => {
        /* ignore transient errors; heartbeat keeps last known fix */
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 10_000 }
    );

    // Heartbeat: push the latest fix to the shared store every N seconds.
    intervalRef.current = setInterval(() => {
      const fix = lastFixRef.current;
      if (fix) updateDriverLocation(driverId, fix);
    }, DRIVER_GPS_INTERVAL_MS);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [driverId, enabled]);
}
