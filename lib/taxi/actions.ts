"use client";

/**
 * High-level data actions for the taxi module, built on top of the reactive
 * store. Drivers and rides are kept as id-keyed records in shared storage so
 * passengers and drivers can observe each other in real time.
 */

import { read, write, update, TAXI_KEYS } from "./store";
import { calculateFare } from "./fare";
import type {
  DriverSession,
  LatLng,
  PassengerSession,
  RideRequest,
  RideStatus,
  RouteInfo,
  TaxiPlace,
  VehicleType,
} from "@/types/taxi";

type DriverMap = Record<string, DriverSession>;
type RideMap = Record<string, RideRequest>;

function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export function createPassengerSession(
  fullName: string,
  mobile?: string
): PassengerSession {
  const session: PassengerSession = {
    id: id("psg"),
    fullName: fullName.trim(),
    mobile: mobile?.trim() || undefined,
    createdAt: Date.now(),
  };
  write(TAXI_KEYS.passengerSession, session);
  return session;
}

export function clearPassengerSession(): void {
  write<PassengerSession | null>(TAXI_KEYS.passengerSession, null);
}

export function createDriverSession(input: {
  fullName: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
}): DriverSession {
  const session: DriverSession = {
    id: id("drv"),
    fullName: input.fullName.trim(),
    vehicleType: input.vehicleType,
    vehicleNumber: input.vehicleNumber.trim().toUpperCase(),
    status: "OFFLINE",
    location: null,
    lastSeen: Date.now(),
    activeRideId: null,
    createdAt: Date.now(),
  };
  write(TAXI_KEYS.driverSession, session);
  upsertDriver(session);
  return session;
}

export function clearDriverSession(driverId?: string): void {
  if (driverId) removeDriver(driverId);
  write<DriverSession | null>(TAXI_KEYS.driverSession, null);
}

// ─── Drivers registry ────────────────────────────────────────────────────────

export function upsertDriver(driver: DriverSession): void {
  update<DriverMap>(TAXI_KEYS.drivers, {}, (prev) => ({
    ...prev,
    [driver.id]: driver,
  }));
  write(TAXI_KEYS.driverSession, driver);
}

export function patchDriver(
  driverId: string,
  patch: Partial<DriverSession>
): DriverSession | null {
  let next: DriverSession | null = null;
  update<DriverMap>(TAXI_KEYS.drivers, {}, (prev) => {
    const existing = prev[driverId];
    if (!existing) return prev;
    next = { ...existing, ...patch };
    return { ...prev, [driverId]: next };
  });
  if (next) write(TAXI_KEYS.driverSession, next);
  return next;
}

export function setDriverStatus(
  driverId: string,
  status: DriverSession["status"],
  location?: LatLng
): void {
  patchDriver(driverId, {
    status,
    lastSeen: Date.now(),
    ...(location ? { location } : {}),
  });
}

export function updateDriverLocation(driverId: string, location: LatLng): void {
  patchDriver(driverId, { location, lastSeen: Date.now() });
}

export function removeDriver(driverId: string): void {
  update<DriverMap>(TAXI_KEYS.drivers, {}, (prev) => {
    if (!(driverId in prev)) return prev;
    const next = { ...prev };
    delete next[driverId];
    return next;
  });
}

export function getDrivers(): DriverMap {
  return read<DriverMap>(TAXI_KEYS.drivers, {});
}

// ─── Rides ───────────────────────────────────────────────────────────────────

export function createRideRequest(input: {
  passenger: PassengerSession;
  pickup: TaxiPlace;
  destination: TaxiPlace;
  route: RouteInfo;
}): RideRequest {
  const fare = calculateFare(input.route.distance, input.route.duration);
  const now = Date.now();

  const ride: RideRequest = {
    id: id("ride"),
    passengerId: input.passenger.id,
    passengerName: input.passenger.fullName,
    passengerMobile: input.passenger.mobile,
    pickup: input.pickup,
    destination: input.destination,
    distanceKm: fare.distanceKm,
    durationMin: fare.durationMin,
    fare: fare.total,
    currency: fare.currency,
    status: "REQUESTED",
    driverId: null,
    driverName: null,
    vehicleType: null,
    vehicleNumber: null,
    createdAt: now,
    updatedAt: now,
  };

  update<RideMap>(TAXI_KEYS.rides, {}, (prev) => ({ ...prev, [ride.id]: ride }));
  return ride;
}

export function patchRide(
  rideId: string,
  patch: Partial<RideRequest>
): RideRequest | null {
  let next: RideRequest | null = null;
  update<RideMap>(TAXI_KEYS.rides, {}, (prev) => {
    const existing = prev[rideId];
    if (!existing) return prev;
    next = { ...existing, ...patch, updatedAt: Date.now() };
    return { ...prev, [rideId]: next };
  });
  return next;
}

export function setRideStatus(
  rideId: string,
  status: RideStatus
): RideRequest | null {
  return patchRide(rideId, { status });
}

/** Driver accepts a ride: assigns driver, marks ride ACCEPTED, driver ON_TRIP. */
export function acceptRide(
  rideId: string,
  driver: DriverSession
): RideRequest | null {
  const current = read<RideMap>(TAXI_KEYS.rides, {})[rideId];
  if (!current || current.status !== "REQUESTED") return null;

  const updated = patchRide(rideId, {
    status: "ACCEPTED",
    driverId: driver.id,
    driverName: driver.fullName,
    vehicleType: driver.vehicleType,
    vehicleNumber: driver.vehicleNumber,
  });

  if (updated) {
    patchDriver(driver.id, { status: "ON_TRIP", activeRideId: rideId });
  }
  return updated;
}

/** Release a driver back to ONLINE after a ride ends or is cancelled. */
export function releaseDriver(driverId: string): void {
  patchDriver(driverId, { status: "ONLINE", activeRideId: null });
}

export function getRides(): RideMap {
  return read<RideMap>(TAXI_KEYS.rides, {});
}
