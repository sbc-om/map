"use client";

import { useState, useCallback } from "react";
import {
  Navigation2,
  Loader2,
  ArrowUpDown,
  Route,
  Clock,
  MoveRight,
  CircleDot,
  MapPin,
} from "lucide-react";
import {
  useDirections,
  formatDistance,
  formatDuration,
} from "@/hooks/useDirections";
import type { DirectionStep } from "@/hooks/useDirections";

// ─── Maneuver icons ──────────────────────────────────────────────────────────

const STEP_ICONS: Record<string, string> = {
  depart: "🚗",
  arrive: "📍",
  turn: "↩",
  "new name": "→",
  merge: "⤵",
  "on ramp": "↗",
  "off ramp": "↘",
  fork: "⑂",
  "end of road": "⬛",
  continue: "↑",
  roundabout: "⟳",
  rotary: "⟳",
  "roundabout turn": "↩",
  notification: "ℹ",
  "exit roundabout": "↗",
};

function getStepIcon(step: DirectionStep): string {
  if (step.type === "turn" && step.modifier) {
    const mod = step.modifier;
    if (mod.includes("left")) return "↰";
    if (mod.includes("right")) return "↱";
    if (mod === "straight") return "↑";
    if (mod.includes("uturn")) return "↺";
  }
  return STEP_ICONS[step.type] ?? "→";
}

// ─── Component ───────────────────────────────────────────────────────────────

interface DirectionsViewProps {
  /** Pre-fill destination (e.g. from context-menu right-click) */
  initialTo?: string;
}

/**
 * DirectionsView — A→B routing form + results, content-only (no outer panel).
 * Designed to be rendered inside MapPOIPanel when mode === "directions".
 */
export function DirectionsView({ initialTo = "" }: DirectionsViewProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(initialTo);
  const { result, isLoading, error, getRoute } = useDirections();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (from.trim() && to.trim()) {
        getRoute(from.trim(), to.trim());
      }
    },
    [from, to, getRoute]
  );

  const handleSwap = useCallback(() => {
    setFrom(to);
    setTo(from);
  }, [from, to]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ── Form ── */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-4 border-b dark:border-gray-800 flex-shrink-0"
      >
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-[19px] top-[36px] bottom-[36px] w-0.5 bg-gray-200 dark:bg-gray-700" />

          {/* From */}
          <div className="relative mb-2">
            <CircleDot className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-500 z-10" />
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="Starting point…"
              autoComplete="off"
              className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          {/* Swap */}
          <button
            type="button"
            onClick={handleSwap}
            className="absolute right-0 top-1/2 -translate-y-1/2 mr-1 p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors z-10 shadow-sm"
            aria-label="Swap origin and destination"
            title="Swap"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
          </button>

          {/* To */}
          <div className="relative">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-red-500 z-10" />
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="Destination…"
              autoComplete="off"
              className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!from.trim() || !to.trim() || isLoading}
          className="mt-3 w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md shadow-blue-600/20"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculating route…
            </>
          ) : (
            <>
              <Route className="h-4 w-4" />
              Get Directions
            </>
          )}
        </button>
      </form>

      {/* ── Error ── */}
      {error && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 text-sm text-red-600 dark:text-red-400 flex-shrink-0">
          {error}
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Summary */}
          <div className="px-4 py-4 bg-blue-50 dark:bg-blue-950/30 border-b dark:border-gray-800">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Route className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-xl font-black text-gray-900 dark:text-white tabular-nums">
                    {formatDistance(result.distance)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Distance</div>
                </div>
              </div>
              <div className="h-8 w-px bg-blue-100 dark:bg-blue-900" />
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-xl font-black text-gray-900 dark:text-white tabular-nums">
                    {formatDuration(result.duration)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Est. time</div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                {result.from.name}
              </span>
              <MoveRight className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                {result.to.name}
              </span>
            </div>
          </div>

          {/* Turn-by-turn */}
          <div className="px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-2 mb-2">
              Turn-by-turn ({result.steps.length} steps)
            </p>
            <div className="space-y-0.5">
              {result.steps.map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                >
                  <span className="flex-shrink-0 w-6 text-center text-base leading-none mt-0.5">
                    {getStepIcon(step)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                      {step.modifier && step.type === "turn"
                        ? `Turn ${step.modifier}`
                        : step.name
                          ? `Continue on ${step.name}`
                          : step.type.charAt(0).toUpperCase() + step.type.slice(1)}
                    </div>
                    {step.distance > 0 && (
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {formatDistance(step.distance)}
                        {step.duration > 0 && (
                          <span> · {formatDuration(step.duration)}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!result && !error && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20">
            <Navigation2 className="h-8 w-8 text-blue-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Enter a starting point and destination to get turn-by-turn directions
            powered by OSRM.
          </p>
        </div>
      )}
    </div>
  );
}
