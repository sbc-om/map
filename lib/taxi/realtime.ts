"use client";

/**
 * Cross-device realtime transport for the taxi module, backed by Ably.
 *
 * The local store (see `./store`) already syncs across tabs of the *same*
 * browser via BroadcastChannel + the `storage` event. That is not enough for a
 * real taxi service, where the driver and the passenger run on *different*
 * devices. This module bridges those devices over an Ably pub/sub channel:
 *
 *   • Drivers publish their own record on every change/heartbeat.
 *   • Passengers (and other drivers) merge those records into the local store,
 *     so `useDrivers()` updates instantly — exactly like a local change.
 *   • Ride requests + status updates flow the same way on a second channel.
 *   • On connect we replay recent channel history, so a passenger who opens the
 *     app *after* a driver is already online still sees them immediately.
 *
 * If `NEXT_PUBLIC_ABLY_KEY` is not configured, realtime is a no-op and the app
 * gracefully falls back to the single-browser localStorage sync.
 */

import type { RealtimeChannel, InboundMessage } from "ably";
import { read, write, TAXI_KEYS } from "./store";
import type { DriverSession, RideRequest } from "@/types/taxi";

type DriverMap = Record<string, DriverSession>;
type RideMap = Record<string, RideRequest>;

const ABLY_KEY = process.env.NEXT_PUBLIC_ABLY_KEY ?? "";
const DRIVERS_CHANNEL = "omantaxi:drivers";
const RIDES_CHANNEL = "omantaxi:rides";
const HISTORY_LIMIT = 100;

export type RealtimeStatus =
  | "disabled"
  | "connecting"
  | "connected"
  | "failed";

let status: RealtimeStatus = ABLY_KEY ? "connecting" : "disabled";
let initStarted = false;
let enabled = false;
let driversChannel: RealtimeChannel | null = null;
let ridesChannel: RealtimeChannel | null = null;

const statusListeners = new Set<() => void>();

function setStatus(next: RealtimeStatus): void {
  if (status === next) return;
  status = next;
  statusListeners.forEach((l) => l());
}

/** Current connection status (for a small "Live" indicator). */
export function getRealtimeStatus(): RealtimeStatus {
  return status;
}

/** Subscribe to connection-status changes. Returns an unsubscribe function. */
export function subscribeRealtimeStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

// ─── Inbound merge (writes WITHOUT re-publishing, to avoid feedback loops) ────

function mergeRemoteDriver(driver: DriverSession | undefined): void {
  if (!driver || typeof driver.id !== "string") return;
  const prev = read<DriverMap>(TAXI_KEYS.drivers, {});
  const existing = prev[driver.id];
  // Last-write-wins by heartbeat: never let an older/echoed copy clobber a
  // fresher local record.
  if (existing && existing.lastSeen >= driver.lastSeen) return;
  write(TAXI_KEYS.drivers, { ...prev, [driver.id]: driver });
}

function removeRemoteDriver(driverId: string | undefined): void {
  if (!driverId) return;
  const prev = read<DriverMap>(TAXI_KEYS.drivers, {});
  if (!(driverId in prev)) return;
  const next = { ...prev };
  delete next[driverId];
  write(TAXI_KEYS.drivers, next);
}

function mergeRemoteRide(ride: RideRequest | undefined): void {
  if (!ride || typeof ride.id !== "string") return;
  const prev = read<RideMap>(TAXI_KEYS.rides, {});
  const existing = prev[ride.id];
  if (existing && existing.updatedAt >= ride.updatedAt) return;
  write(TAXI_KEYS.rides, { ...prev, [ride.id]: ride });
}

function applyDriverMessage(msg: InboundMessage): void {
  if (msg.name === "remove") {
    removeRemoteDriver((msg.data as { id?: string } | undefined)?.id);
  } else {
    mergeRemoteDriver(msg.data as DriverSession | undefined);
  }
}

function applyRideMessage(msg: InboundMessage): void {
  mergeRemoteRide(msg.data as RideRequest | undefined);
}

async function hydrateFromHistory(
  channel: RealtimeChannel,
  apply: (msg: InboundMessage) => void
): Promise<void> {
  try {
    const page = await channel.history({
      limit: HISTORY_LIMIT,
      direction: "backwards",
    });
    // History is newest-first; replay oldest-first so last-write-wins resolves
    // to the most recent state.
    for (const msg of [...page.items].reverse()) apply(msg);
  } catch {
    /* history may be unavailable on the plan — live updates still work */
  }
}

// ─── Connection lifecycle ─────────────────────────────────────────────────────

/**
 * Establish the realtime connection and start syncing. Safe to call multiple
 * times — only the first call has an effect. No-op without an Ably key.
 */
export async function initRealtime(): Promise<void> {
  if (initStarted || typeof window === "undefined") return;
  initStarted = true;

  if (!ABLY_KEY) {
    setStatus("disabled");
    console.info(
      "[taxi] Cross-device realtime is OFF. Set NEXT_PUBLIC_ABLY_KEY to enable driver↔passenger sync across devices."
    );
    return;
  }

  try {
    const Ably = await import("ably");
    const client = new Ably.Realtime({
      key: ABLY_KEY,
      clientId: `omantaxi-${Math.random().toString(36).slice(2, 10)}`,
      // Don't receive our own published messages — local state is the source
      // of truth for entities this device owns.
      echoMessages: false,
    });

    client.connection.on("connected", () => setStatus("connected"));
    client.connection.on("failed", () => setStatus("failed"));
    client.connection.on("suspended", () => setStatus("connecting"));
    client.connection.on("disconnected", () => {
      if (status === "connected") setStatus("connecting");
    });

    driversChannel = client.channels.get(DRIVERS_CHANNEL);
    ridesChannel = client.channels.get(RIDES_CHANNEL);

    driversChannel.subscribe(applyDriverMessage);
    ridesChannel.subscribe(applyRideMessage);

    enabled = true;

    // Catch up on whatever is already happening on the channels.
    await Promise.all([
      hydrateFromHistory(driversChannel, applyDriverMessage),
      hydrateFromHistory(ridesChannel, applyRideMessage),
    ]);
  } catch (err) {
    setStatus("failed");
    enabled = false;
    console.warn("[taxi] Realtime init failed; falling back to local sync", err);
  }
}

// ─── Outbound publishing (called from local mutations in actions.ts) ──────────

export function publishDriver(driver: DriverSession): void {
  if (!enabled || !driversChannel) return;
  driversChannel.publish("update", driver).catch(() => {});
}

export function publishDriverRemoved(driverId: string): void {
  if (!enabled || !driversChannel) return;
  driversChannel.publish("remove", { id: driverId }).catch(() => {});
}

export function publishRide(ride: RideRequest): void {
  if (!enabled || !ridesChannel) return;
  ridesChannel.publish("update", ride).catch(() => {});
}
