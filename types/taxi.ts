/**
 * Taxi dispatch module type definitions (OmanTaxi)
 */

/** Simple latitude/longitude pair */
export interface LatLng {
  lat: number;
  lng: number;
}

/** A geocoded place with a human-readable address */
export interface TaxiPlace extends LatLng {
  address: string;
}

/** App mode selected on the entry screen */
export type TaxiMode = "passenger" | "driver";

/** Lifecycle status of a ride request */
export type RideStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_DRIVERS";

/** Driver availability status */
export type DriverStatus = "OFFLINE" | "ONLINE" | "ON_TRIP";

/** Vehicle category */
export type VehicleType = "economy" | "comfort" | "xl" | "bike";

/** Passenger session stored locally (no auth for MVP) */
export interface PassengerSession {
  id: string;
  fullName: string;
  mobile?: string;
  createdAt: number;
}

/** Driver session stored locally + shared in the drivers registry */
export interface DriverSession {
  id: string;
  fullName: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  status: DriverStatus;
  location: LatLng | null;
  /** Timestamp of the last GPS heartbeat */
  lastSeen: number;
  /** Id of the ride the driver is currently serving */
  activeRideId: string | null;
  createdAt: number;
}

/** Fare calculation breakdown */
export interface FareBreakdown {
  baseFare: number;
  perKm: number;
  perMinute: number;
  distanceKm: number;
  durationMin: number;
  distanceCost: number;
  timeCost: number;
  total: number;
  currency: string;
}

/** Route geometry + metrics returned by the routing engine */
export interface RouteInfo {
  /** Total distance in metres */
  distance: number;
  /** Total duration in seconds */
  duration: number;
  /** Polyline as [lat, lng] pairs */
  coordinates: [number, number][];
}

/** A ride request shared between passenger and driver */
export interface RideRequest {
  id: string;
  passengerId: string;
  passengerName: string;
  passengerMobile?: string;
  pickup: TaxiPlace;
  destination: TaxiPlace;
  distanceKm: number;
  durationMin: number;
  fare: number;
  currency: string;
  status: RideStatus;
  driverId: string | null;
  driverName: string | null;
  vehicleType: VehicleType | null;
  vehicleNumber: string | null;
  /** When a driver accepted the ride (used for the approach ETA countdown) */
  acceptedAt?: number;
  createdAt: number;
  updatedAt: number;
}
