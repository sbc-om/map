"use client";

/**
 * React bindings for the taxi store using `useSyncExternalStore`.
 * Each hook subscribes to a single storage key and returns a stable snapshot.
 */

import { useMemo, useSyncExternalStore } from "react";
import { read, subscribe, TAXI_KEYS } from "@/lib/taxi/store";
import {
  getRealtimeStatus,
  subscribeRealtimeStatus,
  type RealtimeStatus,
} from "@/lib/taxi/realtime";
import type {
  ChatMessage,
  DriverSession,
  PassengerSession,
  RideRequest,
} from "@/types/taxi";

type DriverMap = Record<string, DriverSession>;
type RideMap = Record<string, RideRequest>;
type MessageMap = Record<string, ChatMessage>;

const EMPTY_DRIVERS: DriverMap = {};
const EMPTY_RIDES: RideMap = {};
const EMPTY_MESSAGES: MessageMap = {};
const EMPTY_MESSAGE_LIST: ChatMessage[] = [];

function useStoreValue<T>(key: string, fallback: T): T {
  return useSyncExternalStore(
    (listener) => subscribe(key, listener),
    () => read<T>(key, fallback),
    () => fallback
  );
}

/** All known drivers (id-keyed). */
export function useDrivers(): DriverMap {
  return useStoreValue<DriverMap>(TAXI_KEYS.drivers, EMPTY_DRIVERS);
}

/** All ride requests (id-keyed). */
export function useRides(): RideMap {
  return useStoreValue<RideMap>(TAXI_KEYS.rides, EMPTY_RIDES);
}

/** Locally stored passenger session, if any. */
export function usePassengerSession(): PassengerSession | null {
  return useStoreValue<PassengerSession | null>(
    TAXI_KEYS.passengerSession,
    null
  );
}

/** Locally stored driver session, if any. */
export function useDriverSession(): DriverSession | null {
  return useStoreValue<DriverSession | null>(TAXI_KEYS.driverSession, null);
}

/** A single ride by id, reactive to updates. */
export function useRide(rideId: string | null): RideRequest | null {
  const rides = useRides();
  return rideId ? rides[rideId] ?? null : null;
}

/** Chat messages for a single ride, sorted oldest-first and reactive. */
export function useMessages(rideId: string | null): ChatMessage[] {
  const messages = useStoreValue<MessageMap>(
    TAXI_KEYS.messages,
    EMPTY_MESSAGES
  );
  return useMemo(() => {
    if (!rideId) return EMPTY_MESSAGE_LIST;
    return Object.values(messages)
      .filter((m) => m.rideId === rideId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [messages, rideId]);
}

/** Live status of the cross-device realtime connection. */
export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(
    subscribeRealtimeStatus,
    getRealtimeStatus,
    () => "disabled" as RealtimeStatus
  );
}
