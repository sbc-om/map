"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Crosshair,
  Loader2,
  MapPin,
  MousePointerClick,
  Move,
  Navigation,
  Phone,
  Power,
  User,
  X,
} from "lucide-react";
import {
  AccordionSection,
  Field,
  Metric,
  Panel,
  PrimaryButton,
  SmallButton,
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
  updateDriverLocation,
} from "@/lib/taxi/actions";
import { getRouteEstimate, interpolateAlongPath } from "@/lib/taxi/routing";
import { formatFare } from "@/lib/taxi/fare";
import { haversineKm } from "@/lib/taxi/matching";
import {
  APPROACH_TICK_MS,
  DRIVER_APPROACH_MS,
  DRIVER_TRIP_MS,
  MATCH_RADIUS_KM,
  VEHICLE_TYPES,
} from "@/constants/taxi-config";
import type { RideRequest, VehicleType } from "@/types/taxi";

interface DriverFlowProps {
  onExit: () => void;
  registerMapClick: (handler: ((lat: number, lng: number) => void) | null) => void;
  onPickModeChange?: (active: boolean) => void;
}

export function DriverFlow({
  onExit,
  registerMapClick,
  onPickModeChange,
}: DriverFlowProps) {
  const driver = useDriverSession();
  const rides = useRides();
  const taxiMap = useTaxiMap();

  const [goingOnline, setGoingOnline] = useState(false);
  const [pickingSelf, setPickingSelf] = useState(false);
  const [locating, setLocating] = useState(false);

  const isOnline = driver?.status === "ONLINE";
  const activeRide = driver?.activeRideId ? rides[driver.activeRideId] : null;

  // Heartbeat GPS while online and idle. During an active ride the position is
  // driven by the approach simulation, so real GPS is paused to avoid conflicts.
  useDriverTracking(
    driver?.id ?? null,
    !!driver && driver.status !== "OFFLINE" && !activeRide
  );

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

    // Already have a location (e.g. set manually on the map) → go online with it.
    const goOnlineWith = (loc?: { lat: number; lng: number }) => {
      setDriverStatus(driver.id, "ONLINE", loc ?? driver.location ?? undefined);
      setGoingOnline(false);
      toast.success("You are online");
    };

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      if (driver.location) return goOnlineWith();
      toast.error("Set your location on the map first");
      return;
    }

    setGoingOnline(true);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        goOnlineWith({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        if (driver.location) return goOnlineWith();
        setGoingOnline(false);
        toast.error("Could not get your location. Set it on the map.");
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, [driver]);

  const goOffline = useCallback(() => {
    if (!driver) return;
    setDriverStatus(driver.id, "OFFLINE");
    toast("You are offline");
  }, [driver]);

  // ── Detect / set the driver's own location ─────────────────────────────────
  const detectMyLocation = useCallback(() => {
    if (!driver) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Geolocation is not supported. Set it on the map instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        updateDriverLocation(driver.id, p);
        taxiMap.flyTo(p, 15);
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("Could not detect your location. Set it on the map.");
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, [driver, taxiMap]);

  // Show the driver's own car marker; draggable so it can be positioned by hand.
  useEffect(() => {
    if (!driver?.location) {
      taxiMap.setSelfDriver(null);
      return;
    }
    taxiMap.setSelfDriver(driver.location, {
      draggable: true,
      onDragEnd: (p) => updateDriverLocation(driver.id, p),
    });
  }, [driver, taxiMap]);

  // Tap-on-map to set the driver's location.
  useEffect(() => {
    onPickModeChange?.(pickingSelf);
    if (!pickingSelf || !driver) {
      registerMapClick(null);
      return;
    }
    const handler = (lat: number, lng: number) => {
      updateDriverLocation(driver.id, { lat, lng });
      taxiMap.flyTo({ lat, lng }, 15);
      setPickingSelf(false);
    };
    registerMapClick(handler);
    return () => registerMapClick(null);
  }, [pickingSelf, driver, registerMapClick, onPickModeChange, taxiMap]);

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
  // Keep a ref to the latest driver location so route/animation logic can read
  // it without re-subscribing on every GPS / simulation tick.
  const driverLocRef = useRef(driver?.location ?? null);
  useEffect(() => {
    driverLocRef.current = driver?.location ?? null;
  }, [driver?.location]);

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
        // Before pickup: show the approach path (driver → pickup).
        // After pickup: show the trip path (pickup → destination).
        const approach = activeRide.status === "ACCEPTED";
        const from = approach
          ? driverLocRef.current ?? activeRide.pickup
          : activeRide.pickup;
        const to = approach ? activeRide.pickup : activeRide.destination;
        const r = await getRouteEstimate(from, to);
        if (!cancelled) taxiMap.drawRoute(r.coordinates);
      } catch {
        /* leave markers without a drawn route */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeRide, taxiMap]);

  // ── Movement simulation: drive the car smoothly along the real route ───────
  //   • ACCEPTED     → drive from the driver's spot to the pickup, then ARRIVE.
  //   • IN_PROGRESS  → carry the passenger from pickup to destination, then
  //                    COMPLETE the trip and release the driver.
  // Keyed on stable primitives (driver id + ride id + status) so it starts once
  // per phase — NOT on every location tick (which would reset the animation).
  const simRef = useRef<string | null>(null);
  const driverId = driver?.id ?? null;
  const rideId = activeRide?.id ?? null;
  const rideStatus = activeRide?.status ?? null;
  useEffect(() => {
    if (!driverId || !rideId || !activeRide) return;
    const approach = rideStatus === "ACCEPTED";
    const trip = rideStatus === "IN_PROGRESS";
    if (!approach && !trip) return;

    const phaseKey = `${rideId}:${rideStatus}`;
    if (simRef.current === phaseKey) return; // already animating this phase
    const from = approach
      ? driverLocRef.current ?? activeRide.pickup
      : activeRide.pickup;
    const to = approach ? activeRide.pickup : activeRide.destination;
    const durationMs = approach ? DRIVER_APPROACH_MS : DRIVER_TRIP_MS;

    simRef.current = phaseKey;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const route = await getRouteEstimate(from, to);
      if (cancelled) return;
      const coords = route.coordinates;
      const startedAt = Date.now();

      const step = () => {
        if (cancelled) return;
        const t = Math.min(1, (Date.now() - startedAt) / durationMs);
        updateDriverLocation(driverId, interpolateAlongPath(coords, t));
        if (t >= 1) {
          if (timer) clearInterval(timer);
          timer = null;
          if (approach) {
            // Reached the pickup → wait for the driver to start the trip.
            patchRide(rideId, { status: "ARRIVED" });
          } else {
            // Reached the destination → finish the ride automatically.
            patchRide(rideId, { status: "COMPLETED" });
            releaseDriver(driverId);
          }
        }
      };

      step(); // place the car at the route start immediately
      timer = setInterval(step, APPROACH_TICK_MS);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (simRef.current === phaseKey) simRef.current = null;
    };
  }, [driverId, rideId, rideStatus, activeRide]);

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
        <AccordionSection
          title="Passenger details"
          subtitle="Who you are picking up"
          defaultOpen
          accent="green"
        >
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
        </AccordionSection>

        <AccordionSection
          title="Trip details"
          subtitle="Pickup, destination, and fare"
          defaultOpen
          accent="amber"
        >
          <div className="space-y-2">
            <RideLine icon={<MapPin className="h-4 w-4 text-green-400" />} text={activeRide.pickup.address} />
            <RideLine icon={<MapPin className="h-4 w-4 text-red-400" />} text={activeRide.destination.address} />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="Distance" value={`${activeRide.distanceKm} km`} />
            <Metric label="Time" value={`${activeRide.durationMin} min`} />
            <Metric label="Fare" value={formatFare(activeRide.fare)} accent />
          </div>
        </AccordionSection>

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
    <>
      {pickingSelf && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[1100] flex -translate-x-1/2 justify-center px-4 sm:top-6">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-amber-400/30 bg-zinc-900/90 py-2 pl-4 pr-2 shadow-2xl backdrop-blur-xl">
            <MousePointerClick className="h-4 w-4 shrink-0 animate-pulse text-amber-400" />
            <span className="text-xs font-semibold text-white">
              Tap anywhere on the map to set your location
            </span>
            <button
              onClick={() => setPickingSelf(false)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
              aria-label="Cancel map selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <Panel title={driver.fullName.split(" ")[0]} onExit={onExit}>
      <AccordionSection
        title="Driver status"
        subtitle="Availability and vehicle"
        defaultOpen
        accent="green"
      >
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
      </AccordionSection>

      {/* My location ------------------------------------------------------- */}
      <AccordionSection
        title="My location"
        subtitle="GPS or map-based positioning"
        defaultOpen={!driver.location}
        accent="blue"
      >
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/45">
          <MapPin className="h-3.5 w-3.5 text-amber-400" />
          My location
        </div>
        <p className="mb-2.5 text-xs text-white/55">
          {driver.location
            ? `${driver.location.lat.toFixed(5)}, ${driver.location.lng.toFixed(5)}`
            : "Not set yet — use GPS or pick it on the map."}
        </p>
        <div className="flex gap-2">
          <SmallButton
            onClick={detectMyLocation}
            icon={
              locating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Crosshair className="h-3.5 w-3.5" />
              )
            }
            label="Use GPS"
          />
          <SmallButton
            active={pickingSelf}
            onClick={() => setPickingSelf((v) => !v)}
            icon={<MapPin className="h-3.5 w-3.5" />}
            label={pickingSelf ? "Tap the map…" : "Set on map"}
          />
        </div>
        {driver.location && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/40">
            <Move className="h-3 w-3 shrink-0 text-amber-400/70" />
            Drag the 🚕 marker on the map to move yourself around
          </p>
        )}
      </div>
      </AccordionSection>

      {!isOnline ? (
        <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center text-xs text-white/45">
          Go online to start receiving ride requests.
        </p>
      ) : (
        <AccordionSection
          title="Incoming requests"
          subtitle="Nearby ride requests in real time"
          defaultOpen
          accent="amber"
        >
        <div>
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
        </AccordionSection>
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
    </>
  );
}
