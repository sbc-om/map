import Link from "next/link";
import { ArrowUpRight, Globe } from "lucide-react";

/**
 * Hero — Server Component
 * Minimal: heading · one-liner · single CTA (Open Map)
 */
export function Hero() {
  return (
    <section className="flex flex-col items-center text-center px-6">
      {/* Heading */}
      <h1 className="animate-fadeInUp animation-delay-100 max-w-3xl text-5xl sm:text-6xl lg:text-[80px] font-black tracking-tight text-white leading-[1.02]">
        Intelligent Mapping
        <br />
        <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent animate-gradient-flow">
          for Oman
        </span>
      </h1>

      {/* One-liner */}
      <p className="animate-fadeInUp animation-delay-200 mt-5 text-base text-white/45 max-w-xs leading-relaxed">
        Interactive maps, real-time navigation,
        and precision geospatial tools.
      </p>

      {/* CTA — Open Map only */}
      <div className="animate-fadeInUp animation-delay-300 mt-10">
        <Link
          href="/map"
          className="group flex items-center gap-3 rounded-full bg-amber-500 px-9 py-4 text-sm font-bold text-black shadow-xl shadow-amber-500/20 transition-all duration-300 hover:bg-amber-400 hover:shadow-2xl hover:shadow-amber-500/40 hover:-translate-y-1 active:scale-95"
        >
          <Globe className="h-4 w-4" />
          Open Map
          <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </section>
  );
}
