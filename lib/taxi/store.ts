"use client";

/**
 * Lightweight reactive client store for the taxi dispatch module.
 *
 * Persists JSON values in localStorage and synchronises across browser tabs
 * using both the `storage` event (other tabs) and a BroadcastChannel
 * (immediate, same-origin). This provides real-time passenger ↔ driver
 * communication for the MVP without a backend server.
 *
 * Designed to plug into React via `useSyncExternalStore`.
 */

type Listener = () => void;

const PREFIX = "omantaxi:";
const CHANNEL_NAME = "omantaxi";

const isBrowser = typeof window !== "undefined";

/** Cache of parsed values so getSnapshot returns stable references. */
const cache = new Map<string, unknown>();
/** Per-key subscriber sets. */
const listeners = new Map<string, Set<Listener>>();

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (!isBrowser) return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<{ key: string }>) => {
      const key = event.data?.key;
      if (key) invalidate(key);
    };
  }
  return channel;
}

function fullKey(key: string): string {
  return key.startsWith(PREFIX) ? key : `${PREFIX}${key}`;
}

/** Drop the cached value for a key and notify subscribers to re-read. */
function invalidate(key: string): void {
  cache.delete(key);
  const set = listeners.get(key);
  if (set) set.forEach((l) => l());
}

/** Read + parse a value from localStorage, falling back when absent/invalid. */
export function read<T>(key: string, fallback: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  if (!isBrowser) return fallback;
  try {
    const raw = window.localStorage.getItem(fullKey(key));
    const value = raw === null ? fallback : (JSON.parse(raw) as T);
    cache.set(key, value);
    return value;
  } catch {
    cache.set(key, fallback);
    return fallback;
  }
}

/** Persist a value, update the cache, and broadcast the change. */
export function write<T>(key: string, value: T): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(fullKey(key), JSON.stringify(value));
  } catch {
    /* storage may be full or unavailable — keep in-memory cache */
  }
  cache.set(key, value);
  const set = listeners.get(key);
  if (set) set.forEach((l) => l());
  getChannel()?.postMessage({ key });
}

/** Apply a functional update to a stored value. */
export function update<T>(key: string, fallback: T, updater: (prev: T) => T): T {
  const next = updater(read(key, fallback));
  write(key, next);
  return next;
}

/** Subscribe to changes for a key. Returns an unsubscribe function. */
export function subscribe(key: string, listener: Listener): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);

  // Lazily wire the cross-tab storage listener once.
  ensureStorageListener();

  return () => {
    set?.delete(listener);
  };
}

let storageListenerAttached = false;
function ensureStorageListener(): void {
  if (storageListenerAttached || !isBrowser) return;
  storageListenerAttached = true;
  window.addEventListener("storage", (event) => {
    if (!event.key || !event.key.startsWith(PREFIX)) return;
    invalidate(event.key.slice(PREFIX.length));
  });
  // Ensure the BroadcastChannel is initialised so we receive same-origin updates.
  getChannel();
}

/** Storage keys used by the taxi module. */
export const TAXI_KEYS = {
  drivers: "drivers",
  rides: "rides",
  passengerSession: "passenger-session",
  driverSession: "driver-session",
} as const;
