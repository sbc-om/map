import Image from "next/image";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";

/**
 * Landing page - Server Component
 * Minimal single-screen design: background + navbar + hero CTAs
 */
export default function Home() {
  return (
    <div className="relative h-screen overflow-hidden bg-black">
      {/* ── Background ── */}
      <div className="absolute inset-0" aria-hidden="true">
        <Image
          src="/vimal-s-GBg3jyGS-Ug-unsplash.jpg"
          alt="Aerial view of Oman"
          fill
          className="object-cover opacity-30"
          priority
          quality={90}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90" />

        {/* Ambient glow */}
        <div className="absolute top-1/3 left-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/8 blur-[160px]" />

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)
            `,
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      {/* ── Foreground ── */}
      <div className="relative flex h-full flex-col">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <Hero />
        </div>
      </div>
    </div>
  );
}
