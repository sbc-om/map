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
  Route as RouteIcon,
  X,
} from "lucide-react";
import { AddressSearch } from "./AddressSearch";
import {
  AccordionSection,
  Field,
  Metric,
  Panel,
  PrimaryButton,
  RideLine,
  SmallButton,
  TextInput,
} from "./ui";
import { useTaxiMap } from "@/hooks/useTaxiMap";
import { useDrivers, usePassengerSession, useRide } from "@/hooks/useTaxiStore";
import {
  createPassengerSession,
  createRideRequest,
  releaseDriver,
  setRideStatus,
} from "@/lib/taxi/actions";
import { getRouteEstimate, reverseGeocode } from "@/lib/taxi/routing";
import { calculateFare, formatFare } from "@/lib/taxi/fare";
import { findNearbyDrivers } from "@/lib/taxi/matching";
import { VEHICLE_TYPES, DRIVER_STALE_MS, DRIVER_APPROACH_MS } from "@/constants/taxi-config";
import type { RouteInfo, TaxiPlace } from "@/types/taxi";

interface PassengerFlowProps {
  onExit: () => void;
  registerMapClick: (handler: ((lat: number, lng: number) => void) | null) => void;
  onPickModeChange?: (active: boolean) => void;
}

type PickTarget = "pickup" | "destination" | null;

export function PassengerFlow({ onExit, registerMapClick, onPickModeChange }: PassengerFlowProps) {
  const passenger = usePassengerSession();
  const drivers = useDrivers();
  const taxiMap = useTaxiMap();

  const [pickup, setPickup] = useState<TaxiPlace | null>(null);
  const [destination, setDestination] = useState<TaxiPlace | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routing, setRouting] = useState(false);
  const [pickTarget, setPickTarget] = useState<PickTarget>(null);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const ride = useRide(activeRideId);

  // Tick a 1s clock only while the taxi is approaching, to drive the ETA.
  useEffect(() => {
    if (ride?.status !== "ACCEPTED") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ride?.status]);

  // ── Registration form state ────────────────────────────────────────────────
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");

  const handleRegister = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (fullName.trim().length < 2) {
        toast.error("Please enter your full name");
        return;
      }
      createPassengerSession(fullName, mobile);
      toast.success(`Welcome, ${fullName.trim()}!`);
    },
    [fullName, mobile]
  );

  // ── Pickup marker (draggable) ──────────────────────────────────────────────
  const applyPickup = useCallback(
    async (place: TaxiPlace) => {
      setPickup(place);
      await taxiMap.setPickup(place, {
        draggable: true,
        onDragEnd: async (p) => {
          const address = await reverseGeocode(p);
          setPickup({ ...p, address });
        },
      });
    },
    [taxiMap]
  );

  const applyDestination = useCallback(
    async (place: TaxiPlace) => {
      setDestination(place);
      await taxiMap.setDestination(place, {
        draggable: true,
        onDragEnd: async (p) => {
          const address = await reverseGeocode(p);
          setDestination({ ...p, address });
        },
      });
    },
    [taxiMap]
  );

  // ── Auto-detect current location once the passenger is registered ──────────
  const detectLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Geolocation is not supported on this device");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const address = await reverseGeocode(p);
        await applyPickup({ ...p, address });
        taxiMap.flyTo(p, 15);
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("Could not detect your location. Pick it on the map.");
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, [applyPickup, taxiMap]);

  // On first registration, request the pickup location automatically.
  const autoLocatedRef = useRef(false);
  useEffect(() => {
    if (passenger && !pickup && !autoLocatedRef.current) {
      autoLocatedRef.current = true;
      detectLocation();
    }
  }, [passenger, pickup, detectLocation]);

  // ── Map click handling for "pick on map" ───────────────────────────────────
  useEffect(() => {
    onPickModeChange?.(pickTarget !== null);
    if (!pickTarget) {
      registerMapClick(null);
      return;
    }
    const handler = async (lat: number, lng: number) => {
      const p = { lat, lng };
      const address = await reverseGeocode(p);
      const place: TaxiPlace = { ...p, address };
      if (pickTarget === "pickup") await applyPickup(place);
      else await applyDestination(place);
      setPickTarget(null);
    };
    registerMapClick(handler);
    return () => registerMapClick(null);
  }, [pickTarget, registerMapClick, applyPickup, applyDestination, onPickModeChange]);

  // ── Compute route + fare whenever both endpoints are set ───────────────────
  useEffect(() => {
    if (!pickup || !destination) {
      setRoute(null);
      taxiMap.drawRoute(null);
      return;
    }

    let cancelled = false;
    setRouting(true);

    (async () => {
      try {
        const r = await getRouteEstimate(pickup, destination);
        if (cancelled) return;
        setRoute(r);
        taxiMap.drawRoute(r.coordinates);
      } catch {
        if (!cancelled) {
          setRoute(null);
          toast.error("Could not calculate a route");
        }
      } finally {
        if (!cancelled) setRouting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pickup, destination, taxiMap]);

  const fare = useMemo(
    () => (route ? calculateFare(route.distance, route.duration) : null),
    [route]
  );

  // ── Nearby drivers (live) ──────────────────────────────────────────────────
  const nearbyDrivers = useMemo(() => {
    if (!pickup) return [];
    return findNearbyDrivers({ pickup }, Object.values(drivers));
  }, [pickup, drivers]);

  // ── All online taxis (live) — always visible on the map, even before a
  //    pickup is chosen, so the passenger can see cars moving around. ─────────
  const onlineDrivers = useMemo(() => {
    const now = Date.now();
    return Object.values(drivers).filter(
      (d) =>
        d.status === "ONLINE" &&
        d.location !== null &&
        now - d.lastSeen <= DRIVER_STALE_MS
    );
  }, [drivers]);

  // ── Assigned driver (once a taxi accepts the ride) ─────────────────────────
  const assignedDriver = ride?.driverId ? drivers[ride.driverId] : undefined;
  const hasAssignedTaxi =
    !!assignedDriver?.location &&
    !!ride &&
    ride.status !== "REQUESTED" &&
    ride.status !== "CANCELLED";

  // Taxi visibility on the map:
  //  • before a taxi accepts → show every online taxi (live), so the
  //    passenger can watch cars moving around.
  //  • after the first taxi accepts → show ONLY that taxi heading over.
  useEffect(() => {
    if (hasAssignedTaxi && assignedDriver?.location) {
      taxiMap.setDrivers([
        { id: assignedDriver.id, location: assignedDriver.location },
      ]);
      return;
    }
    taxiMap.setDrivers(
      onlineDrivers.map((d) => ({ id: d.id, location: d.location! }))
    );
  }, [hasAssignedTaxi, assignedDriver, onlineDrivers, taxiMap]);

  // Draw the relevant route as the ride progresses:
  //  • ACCEPTED  → approach path (taxi → pickup) so the passenger sees the car come.
  //  • IN_PROGRESS → trip path (pickup → destination).
  const drawnPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ride) return;
    const phase = `${ride.id}:${ride.status}`;
    if (drawnPhaseRef.current === phase) return;

    if (ride.status === "ACCEPTED" && assignedDriver?.location) {
      drawnPhaseRef.current = phase;
      const from = assignedDriver.location;
      const to = ride.pickup;
      let cancelled = false;
      (async () => {
        try {
          const r = await getRouteEstimate(from, to);
          if (!cancelled) taxiMap.drawRoute(r.coordinates, false);
        } catch {
          /* keep markers without a drawn approach route */
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (ride.status === "IN_PROGRESS") {
      drawnPhaseRef.current = phase;
      // Passenger is on board: drop the person glyph from the pickup pin while
      // keeping the pin to mark the origin.
      taxiMap.setPickup(ride.pickup, { boarded: true });
      let cancelled = false;
      (async () => {
        try {
          const r = await getRouteEstimate(ride.pickup, ride.destination);
          // Fit the view to the full trip so the passenger actually sees the
          // pickup -> destination route (the driver already fits to it).
          if (!cancelled) taxiMap.drawRoute(r.coordinates, true);
        } catch {
          /* keep markers without a drawn trip route */
        }
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [ride, assignedDriver, taxiMap]);

  // ── Request a taxi ─────────────────────────────────────────────────────────
  const handleRequest = useCallback(() => {
    if (!passenger || !pickup || !destination || !route) return;
    const created = createRideRequest({ passenger, pickup, destination, route });
    setActiveRideId(created.id);
    toast.success("Searching for a nearby driver…");
  }, [passenger, pickup, destination, route]);

  const handleCancelRide = useCallback(() => {
    if (!ride) return;
    setRideStatus(ride.id, "CANCELLED");
    if (ride.driverId) releaseDriver(ride.driverId);
    setActiveRideId(null);
    toast("Ride cancelled");
  }, [ride]);

  const handleNewRide = useCallback(() => {
    setActiveRideId(null);
    setDestination(null);
    setRoute(null);
    taxiMap.setDestination(null);
    taxiMap.drawRoute(null);
  }, [taxiMap]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render: registration gate
  // ─────────────────────────────────────────────────────────────────────────
  if (!passenger) {
    return (
      <Panel title="Passenger sign-up" onExit={onExit}>
        <form onSubmit={handleRegister} className="space-y-3">
          <Field label="Full name">
            <TextInput
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Ahmed Al Balushi"
            />
          </Field>
          <Field label="Mobile number (optional)">
            <TextInput
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              inputMode="tel"
              placeholder="+968 …"
            />
          </Field>
          <PrimaryButton type="submit">Continue</PrimaryButton>
        </form>
      </Panel>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: active ride status
  // ─────────────────────────────────────────────────────────────────────────
  if (ride && ride.status !== "CANCELLED") {
    const approachEtaSec =
      ride.status === "ACCEPTED" && ride.acceptedAt
        ? Math.max(
            0,
            Math.ceil((DRIVER_APPROACH_MS - (now - ride.acceptedAt)) / 1000)
          )
        : null;
    return (
      <Panel title="Your ride" onExit={onExit}>
        <RideStatusView
          status={ride.status}
          nearbyCount={nearbyDrivers.length}
          etaSeconds={approachEtaSec}
        />

        {assignedDriver && ride.status !== "REQUESTED" && (
          <AccordionSection
            title="Driver details"
            subtitle="Your assigned taxi"
            defaultOpen
            accent="green"
          >
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-xl">
                  {VEHICLE_TYPES[assignedDriver.vehicleType].emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">
                    {assignedDriver.fullName}
                  </p>
                  <p className="text-xs text-white/50">
                    {VEHICLE_TYPES[assignedDriver.vehicleType].label} ·{" "}
                    {assignedDriver.vehicleNumber}
                  </p>
                </div>
              </div>
            </div>
          </AccordionSection>
        )}

        <AccordionSection
          title="Trip details"
          subtitle="Pickup, destination, and fare"
          defaultOpen
          accent="amber"
        >
          <div className="space-y-2">
            <RideLine icon={<MapPin className="h-4 w-4 text-green-400" />} text={ride.pickup.address} />
            <RideLine icon={<MapPin className="h-4 w-4 text-red-400" />} text={ride.destination.address} />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="Distance" value={`${ride.distanceKm} km`} />
            <Metric label="Time" value={`${ride.durationMin} min`} />
            <Metric label="Fare" value={formatFare(ride.fare)} accent />
          </div>
        </AccordionSection>

        {ride.status === "COMPLETED" ? (
          <button
            onClick={handleNewRide}
            className="mt-4 w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-black transition hover:bg-amber-400 active:scale-[0.98]"
          >
            Book another ride
          </button>
        ) : (
          <button
            onClick={handleCancelRide}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/20"
          >
            <X className="h-4 w-4" /> Cancel ride
          </button>
        )}
      </Panel>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: trip planner
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {pickTarget && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[1100] flex -translate-x-1/2 justify-center px-4 sm:top-6">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-amber-400/30 bg-zinc-900/90 py-2 pl-4 pr-2 shadow-2xl backdrop-blur-xl">
            <MousePointerClick className="h-4 w-4 shrink-0 animate-pulse text-amber-400" />
            <span className="text-xs font-semibold text-white">
              {pickTarget === "pickup"
                ? "Tap anywhere on the map to set your pickup"
                : "Tap anywhere on the map to set your destination"}
            </span>
            <button
              onClick={() => setPickTarget(null)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
              aria-label="Cancel map selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <Panel title={`Hi, ${passenger.fullName.split(" ")[0]}`} onExit={onExit}>
      <AccordionSection
        title="Trip setup"
        subtitle="Pickup, destination, and map selection"
        defaultOpen
        accent="green"
      >
      <div className="space-y-2.5">
        {/* Pickup */}
        <AddressSearch
          placeholder="Pickup location"
          value={pickup?.address ?? ""}
          dotColor="#22c55e"
          onSelect={applyPickup}
        />
        <div className="flex gap-2">
          <SmallButton
            active={pickTarget === "pickup"}
            onClick={() => setPickTarget((t) => (t === "pickup" ? null : "pickup"))}
            icon={<MapPin className="h-3.5 w-3.5" />}
            label={pickTarget === "pickup" ? "Tap the map…" : "Set on map"}
          />
          <SmallButton
            onClick={detectLocation}
            icon={
              locating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Crosshair className="h-3.5 w-3.5" />
              )
            }
            label="My location"
          />
        </div>

        {/* Destination */}
        <AddressSearch
          placeholder="Where to?"
          value={destination?.address ?? ""}
          dotColor="#ef4444"
          onSelect={applyDestination}
        />
        <SmallButton
          active={pickTarget === "destination"}
          onClick={() =>
            setPickTarget((t) => (t === "destination" ? null : "destination"))
          }
          icon={<MapPin className="h-3.5 w-3.5" />}
          label={pickTarget === "destination" ? "Tap the map…" : "Set destination on map"}
        />

        {(pickup || destination) && (
          <p className="flex items-center gap-1.5 pt-0.5 text-[11px] text-white/40">
            <Move className="h-3 w-3 shrink-0 text-amber-400/70" />
            Drag the pins on the map to fine-tune pickup &amp; destination
          </p>
        )}
      </div>
      </AccordionSection>


      {/* Fare estimate */}
      {(routing || fare) && (
        <AccordionSection
          title="Fare estimate"
          subtitle={routing ? "Calculating the best route" : "Distance, time, and price"}
          defaultOpen
          accent="amber"
        >
        {routing && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-4 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculating route…
          </div>
        )}

        {fare && !routing && (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-300/80">
            <RouteIcon className="h-3.5 w-3.5" /> Estimated trip
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="Distance" value={`${fare.distanceKm} km`} />
            <Metric label="Time" value={`${fare.durationMin} min`} />
            <Metric label="Fare" value={formatFare(fare.total)} accent />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
            Base {fare.baseFare.toFixed(2)} + {fare.distanceKm}km × {fare.perKm} +{" "}
            {fare.durationMin}min × {fare.perMinute} {fare.currency}
          </p>
        </div>
        )}
        </AccordionSection>
      )}

      <AccordionSection
        title="Nearby taxis"
        subtitle="Live availability around your pickup"
        accent="blue"
      >
        <p className="flex items-center gap-1.5 text-xs text-white/45">
          <Navigation className="h-3.5 w-3.5 text-amber-400" />
          {nearbyDrivers.length > 0
            ? `${nearbyDrivers.length} driver${nearbyDrivers.length > 1 ? "s" : ""} nearby`
            : onlineDrivers.length > 0
            ? `${onlineDrivers.length} taxi${onlineDrivers.length > 1 ? "s" : ""} online — shown on the map`
            : "No taxis online right now"}
        </p>
      </AccordionSection>

      <div className="mt-4">
        <PrimaryButton disabled={!fare || routing} onClick={handleRequest}>
          Request Taxi
        </PrimaryButton>
      </div>
    </Panel>
    </>
  );
}

const STATUS_COPY: Record<string, { title: string; sub: string }> = {
  REQUESTED: { title: "Finding your driver…", sub: "Matching you with a nearby taxi" },
  ACCEPTED: { title: "Driver on the way", sub: "Your driver is heading to the pickup" },
  ARRIVED: { title: "Driver has arrived", sub: "Your taxi is waiting at the pickup" },
  IN_PROGRESS: { title: "On the way", sub: "Enjoy your ride" },
  COMPLETED: { title: "Trip completed", sub: "Thanks for riding with OmanTaxi" },
  NO_DRIVERS: { title: "No drivers available", sub: "Please try again shortly" },
};

function RideStatusView({
  status,
  nearbyCount,
  etaSeconds,
}: {
  status: string;
  nearbyCount: number;
  etaSeconds?: number | null;
}) {
  const copy = STATUS_COPY[status] ?? STATUS_COPY.REQUESTED;
  const pending = status === "REQUESTED";
  const eta =
    etaSeconds != null
      ? `${Math.floor(etaSeconds / 60)}:${String(etaSeconds % 60).padStart(2, "0")}`
      : null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15">
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
        ) : status === "COMPLETED" ? (
          <Phone className="h-5 w-5 text-amber-400" />
        ) : (
          <Navigation className="h-5 w-5 text-amber-400" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white">{copy.title}</p>
        <p className="text-xs text-white/50">
          {pending
            ? nearbyCount > 0
              ? `${nearbyCount} taxi${nearbyCount > 1 ? "s" : ""} nearby`
              : "Looking for nearby taxis…"
            : copy.sub}
        </p>
      </div>
      {eta && (
        <div className="shrink-0 text-right">
          <p className="text-base font-bold tabular-nums text-amber-400">{eta}</p>
          <p className="text-[10px] uppercase tracking-wide text-white/40">
            arriving
          </p>
        </div>
      )}
    </div>
  );
}
