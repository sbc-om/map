"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { geocode } from "@/lib/taxi/routing";
import type { TaxiPlace } from "@/types/taxi";

interface AddressSearchProps {
  placeholder: string;
  value: string;
  /** Coloured dot shown on the left (e.g. green pickup / red destination). */
  dotColor?: string;
  onSelect: (place: TaxiPlace) => void;
  onChangeText?: (text: string) => void;
}

/**
 * Debounced address search box backed by Nominatim. Renders a results
 * dropdown and emits the selected {@link TaxiPlace}.
 */
export function AddressSearch({
  placeholder,
  value,
  dotColor = "#fbbf24",
  onSelect,
  onChangeText,
}: AddressSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<TaxiPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ensureVisibleOnMobile = () => {
    if (typeof window === "undefined") return;
    const run = () => {
      const input = inputRef.current;
      if (!input) return;
      input.scrollIntoView({ block: "center", behavior: "smooth" });
      const scroller = input.closest<HTMLElement>("[data-taxi-scroll-area='true']");
      if (!scroller) return;

      const inputRect = input.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const topGap = inputRect.top - scrollerRect.top;
      const bottomGap = scrollerRect.bottom - inputRect.bottom;

      if (topGap < 20) {
        scroller.scrollBy({ top: topGap - 28, behavior: "smooth" });
      } else if (bottomGap < 96) {
        scroller.scrollBy({ top: 96 - bottomGap, behavior: "smooth" });
      }
    };

    requestAnimationFrame(() => {
      run();
      window.setTimeout(run, 250);
      window.setTimeout(run, 500);
    });
  };

  // Keep the input in sync when the parent updates the value (e.g. reverse geocode).
  useEffect(() => setQuery(value), [value]);

  // Debounced geocoding.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        setResults(await geocode(trimmed));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query, open]);

  // Close dropdown on outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 focus-within:border-amber-400/60">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: dotColor }}
        />
        <input
          ref={inputRef}
          value={query}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true);
            ensureVisibleOnMobile();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            onChangeText?.(e.target.value);
            setOpen(true);
          }}
          className="w-full bg-transparent text-base text-white placeholder:text-white/35 focus:outline-none sm:text-sm"
        />
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white/40" />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-white/40" />
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-[1200] mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-white/10 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur">
          {results.map((place, i) => (
            <li key={`${place.lat}-${place.lng}-${i}`}>
              <button
                type="button"
                onClick={() => {
                  onSelect(place);
                  setQuery(place.address);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-white/80 transition hover:bg-white/10"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span className="line-clamp-2">{place.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
