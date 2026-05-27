import Link from "next/link";
import { MapPin } from "lucide-react";

function GithubSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

/**
 * Footer — Server Component
 */
export function Footer() {
  return (
    <footer
      className="relative bg-[#080808] border-t border-white/[0.07]"
      role="contentinfo"
    >
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* ── Brand ── */}
          <Link
            href="/"
            className="flex items-center gap-2.5 transition-opacity duration-200 hover:opacity-80"
            aria-label="SBCMap"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
              <MapPin className="h-4 w-4 text-amber-400" strokeWidth={2} />
            </div>
            <span className="text-sm font-semibold text-white/50">
              SBC<span className="text-amber-400/60">Map</span>
            </span>
          </Link>

          {/* ── Copyright ── */}
          <p className="order-3 sm:order-2 text-xs text-white/20 text-center">
            © {new Date().getFullYear()} SBCMap · Built for Oman and beyond.
          </p>

          {/* ── Navigation links ── */}
          <nav
            className="order-2 sm:order-3 flex items-center gap-6"
            aria-label="Footer navigation"
          >
            <a
              href="https://github.com/sbc-om/map"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-white/30 transition-colors duration-200 hover:text-white/65"
              aria-label="GitHub repository"
            >
              <GithubSvg className="h-3.5 w-3.5" />
              GitHub
            </a>
            <Link
              href="/map"
              className="text-xs font-medium text-white/30 transition-colors duration-200 hover:text-white/65"
            >
              Open Map
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
