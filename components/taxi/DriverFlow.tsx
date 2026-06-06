"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Power,
  User,
} from "lucide-react";
import {
  Field,
  Metric,
  Panel,
  PrimaryButton,
  RideLine,
  TextInput,
} from "./ui";
import { useTaxiMap } from "@/hooks/useTaxiMap";
import { useDriverTracking } from "@/hooks/useDriverTracking";
import { useDriverSession, useRides } from "@/hooks/useTaxiStore";
import {
  acceptRide,
  clearDriverSession,
  createDriverSession,
  patchRide,
  releaseDriver,
  setDriverStatus,
} from "@/lib/taxi/actions";
import { getRouteEstimate } from "@/lib/taxi/routing";
import { formatFare } from "@/lib/taxi/fare";
import { haversineKm } from "@/lib/taxi/matching";
import { MATCH_RADIUS_KM, VEHICLE_TYPES } from "@/constants/taxi-config";
import type { RideRequest, VehicleType } from "@/types/taxi";

interface DriverFlowProps {
  onExit: () => void;
}

export function DriverFlow({ onExit }: DriverFlowProps) {
  const driver = useDriverSession();
  const rides = useRides();
  const taxiMap = useTaxiMap();

  const [goingOnline, setGoingOnline] = useState(false);

  const isOnline = driver?.status === "ONLINE";
  const activeRide = driver?.activeRideId ? rides[driver.activeRideId] : null;

  // Heartbeat GPS while online (and not stuck on a finished session).
  useDriverTracking(driver?.id ?? null, !!driver && driver.status !== "OFFLINE");

  // ── Registration ───────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("economy");
  const [vehicleNumber, setVehicleNumber] = useState("");

  const handleRegister = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (fullName.trim().length < 2) {
        toast.error("Please enter your full name");
        return;
      }
      if (vehicleNumber.trim().length < 2) {
        toast.error("Please enter your vehicle number");
        return;
      }
      createDriverSession({ fullName, vehicleType, vehicleNumber });
      toast.success("Driver profile created");
    },
    [fullName, vehicleType, vehicleNumber]
  );

  // ── Online / offline toggle ────────────────────────────────────────────────
  const goOnline = useCallback(() => {
    if (!driver) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Geolocation is required to go online");
      return;
    }
    setGoingOnline(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDriverStatus(driver.id, "ONLINE", {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGoingOnline(false);
        toast.success("You are online");
      },
      () => {
        setGoingOnline(false);
        toast.error("Could not get your location. Enable GPS and retry.");
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, [driver]);

  const goOffline = useCallback(() => {
    if (!driver) return;
    setDriverStatus(driver.id, "OFFLINE");
    toast("You are offline");
  }, [driver]);

  // ── Incoming requests within range, nearest first ──────────────────────────
  const incoming = useMemo(() => {
    if (!driver?.location || !isOnline) return [];
    return Object.values(rides)
      .filter((r) => r.status === "REQUESTED")
      .map((r) => ({
        ride: r,
        distanceKm: haversineKm(driver.location!, r.pickup),
      }))
      .filter((x) => x.distanceKm <= MATCH_RADIUS_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [rides, driver, isOnline]);

  // ── Draw the active ride route on the map ──────────────────────────────────
  useEffect(() => {
    if (!activeRide) {
      taxiMap.drawRoute(null);
      taxiMap.setPickup(null);
      taxiMap.setDestination(null);
      return;
    }
    taxiMap.setPickup(activeRide.pickup);
    taxiMap.setDestination(activeRide.destination);
    let cancelled = false;
    (async () => {
      try {
        const r = await getRouteEstimate(activeRide.pickup, activeRide.destination);
        if (!cancelled) taxiMap.drawRoute(r.coordinates);
      } catch {
        /* leave markers without a drawn route */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeRide, taxiMap]);

  const handleAccept = useCallback(
    (ride: RideRequest) => {
      if (!driver) return;
      const result = acceptRide(ride.id, driver);
      if (result) toast.success("Ride accepted");
      else toast.error("This ride was already taken");
    },
    [driver]
  );

  const advance = useCallback(
    (ride: RideRequest, status: RideRequest["status"]) => {
      patchRide(ride.id, { status });
      if (status === "COMPLETED" && driver) {
        releaseDriver(driver.id);
        toast.success("Trip completed");
      }
    },
    [driver]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Registration gate
  // ─────────────────────────────────────────────────────────────────────────
  if (!driver) {
    return (
      <Panel title="Driver sign-up" onExit={onExit}>
        <form onSubmit={handleRegister} className="space-y-3">
          <Field label="Full name">
            <TextInput
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Salim Al Hinai"
            />
          </Field>
          <Field label="Vehicle type">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(VEHICLE_TYPES) as VehicleType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setVehicleType(type)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                    vehicleType === type
                      ? "border-amber-400/60 bg-amber-500/15 text-white"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  <span className="text-lg">{VEHICLE_TYPES[type].emoji}</span>
                  {VEHICLE_TYPES[type].label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Vehicle number">
            <TextInput
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              placeholder="e.g. 1234 A/B"
            />
          </Field>
          <PrimaryButton type="submit">Create profile</PrimaryButton>
        </form>
      </Panel>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Active trip
  // ─────────────────────────────────────────────────────────────────────────
  if (activeRide && activeRide.status !== "COMPLETED" && activeRide.status !== "CANCELLED") {
    return (
      <Panel title="Active trip" onExit={onExit}>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
              <User className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">
                {activeRide.passengerName}
              </p>
              {activeRide.passengerMobile && (
                <a
                  href={`tel:${activeRide.passengerMobile}`}
                  className="flex items-center gap-1 text-xs text-amber-400"
                >
                  <Phone className="h-3 w-3" /> {activeRide.passengerMobile}
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <RideLine icon={<MapPin className="h-4 w-4 text-green-400" />} text={activeRide.pickup.address} />
          <RideLine icon={<MapPin className="h-4 w-4 text-red-400" />} text={activeRide.destination.address} />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric label="Distance" value={`${activeRide.distanceKm} km`} />
          <Metric label="Time" value={`${activeRide.durationMin} min`} />
          <Metric label="Fare" value={formatFare(activeRide.fare)} accent />
        </div>

        <div className="mt-4">
          {activeRide.status === "ACCEPTED" && (
            <PrimaryButton onClick={() => advance(activeRide, "ARRIVED")}>
              I&apos;ve arrived at pickup
            </PrimaryButton>
          )}
          {activeRide.status === "ARRIVED" && (
            <PrimaryButton onClick={() => advance(activeRide, "IN_PROGRESS")}>
              Start trip
            </PrimaryButton>
          )}
          {activeRide.status === "IN_PROGRESS" && (
            <PrimaryButton onClick={() => advance(activeRide, "COMPLETED")}>
              Complete trip
            </PrimaryButton>
          )}
        </div>
      </Panel>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Dashboard (online / offline + incoming requests)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Panel title={driver.fullName.split(" ")[0]} onExit={onExit}>
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isOnline ? "bg-green-400" : "bg-white/30"
            }`}
          />
          <div>
            <p className="text-sm font-bold text-white">
              {isOnline ? "Online" : "Offline"}
            </p>
            <p className="text-xs text-white/45">
              {VEHICLE_TYPES[driver.vehicleType].label} · {driver.vehicleNumber}
            </p>
          </div>
        </div>
        <button
          onClick={isOnline ? goOffline : goOnline}
          disabled={goingOnline}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
            isOnline
              ? "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
              : "bg-amber-500 text-black hover:bg-amber-400"
          }`}
        >
          {goingOnline ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Power className="h-4 w-4" />
          )}
          {isOnline ? "Go offline" : "Go online"}
        </button>
      </div>

      {!isOnline ? (
        <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center text-xs text-white/45">
          Go online to start receiving ride requests.
        </p>
      ) : (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/45">
            <Navigation className="h-3.5 w-3.5 text-amber-400" />
            Incoming requests
          </div>
          {incoming.length === 0 ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-6 text-xs text-white/40">
              <Loader2 className="h-4 w-4 animate-spin" /> Waiting for ride
              requests…
            </div>
          ) : (
            <ul className="space-y-2.5">
              {incoming.map(({ ride, distanceKm }) => (
                <li
                  key={ride.id}
                  className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">
                      {formatFare(ride.fare)}
                    </span>
                    <span className="text-xs text-white/50">
                      {distanceKm.toFixed(1)} km away
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <RideLine
                      icon={<MapPin className="h-4 w-4 text-green-400" />}
                      text={ride.pickup.address}
                    />
                    <RideLine
                      icon={<MapPin className="h-4 w-4 text-red-400" />}
                      text={ride.destination.address}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-white/45">
                    <span>
                      {ride.distanceKm} km · {ride.durationMin} min
                    </span>
                    <span>{ride.passengerName}</span>
                  </div>
                  <button
                    onClick={() => handleAccept(ride)}
                    className="mt-3 w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-black transition hover:bg-amber-400 active:scale-[0.98]"
                  >
                    Accept ride
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        onClick={() => {
          clearDriverSession(driver.id);
          onExit();
        }}
        className="mt-4 w-full rounded-xl border border-white/10 py-2 text-xs font-medium text-white/40 transition hover:text-white/70"
      >
        Sign out
      </button>
    </Panel>
  );
}
