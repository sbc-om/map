"use client";

import { Car, User } from "lucide-react";
import type { TaxiMode } from "@/types/taxi";

interface TaxiModeSelectProps {
  onSelect: (mode: TaxiMode) => void;
}

/**
 * Entry screen for the taxi module — the user picks Passenger or Driver
 * before entering the system.
 */
export function TaxiModeSelect({ onSelect }: TaxiModeSelectProps) {
  return (
    <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-2xl shadow-lg shadow-amber-500/30">
            🚕
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            OmanTaxi
          </h1>
          <p className="mt-2 text-sm text-white/45">
            Choose how you want to continue
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSelect("passenger")}
            className="group flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-6 text-center transition-all hover:-translate-y-1 hover:border-amber-400/50 hover:bg-white/10"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 transition group-hover:bg-amber-500 group-hover:text-black">
              <User className="h-6 w-6" />
            </span>
            <span className="text-lg font-bold text-white">Passenger</span>
            <span className="text-xs text-white/45">
              Book a ride to your destination
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelect("driver")}
            className="group flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-6 text-center transition-all hover:-translate-y-1 hover:border-amber-400/50 hover:bg-white/10"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 transition group-hover:bg-amber-500 group-hover:text-black">
              <Car className="h-6 w-6" />
            </span>
            <span className="text-lg font-bold text-white">Driver</span>
            <span className="text-xs text-white/45">
              Go online and accept rides
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
