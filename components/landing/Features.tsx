import Image from "next/image";
import { Layers, MapPin, Compass } from "lucide-react";

const features = [
  {
    icon: Layers,
    iconColor: "text-sky-400",
    iconBg: "bg-sky-400/10 border-sky-400/20",
    glowColor: "group-hover:shadow-sky-500/15",
    title: "Multi-Layer Mapping",
    description:
      "Switch seamlessly between standard, satellite, and dark map layers. Customize tile providers for any use case - from urban planning to field operations.",
    image: "/map-satellite.png",
    imageAlt: "Satellite map layer view",
  },
  {
    icon: MapPin,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-400/10 border-amber-400/20",
    glowColor: "group-hover:shadow-amber-500/15",
    title: "Smart POI Management",
    description:
      "Create, organize, and manage thousands of points of interest with custom categories, metadata, and real-time search. Export to standard formats instantly.",
    image: "/map-basic.png",
    imageAlt: "Point of interest management interface",
  },
  {
    icon: Compass,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-400/10 border-emerald-400/20",
    glowColor: "group-hover:shadow-emerald-500/15",
    title: "Advanced Navigation",
    description:
      "GPS-powered live tracking, precision measurement tools, and contextual map controls - everything field teams need in one unified platform.",
    image: "/map-dark.png",
    imageAlt: "Dark mode navigation interface",
  },
];

/**
 * Features section - Server Component
 * Showcases the 3 core platform capabilities
 */
export function Features() {
  return (
    <section
      className="relative py-24 px-6 bg-[#080808]"
      aria-labelledby="features-heading"
    >
      {/* Subtle top separator */}
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl">
        {/* ── Section header ── */}
        <header className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 mb-6">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
              Platform Capabilities
            </span>
          </div>

          <h2
            id="features-heading"
            className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.1]"
          >
            Everything you need to{" "}
            <span className="text-white/35">map the world</span>
          </h2>

          <p className="mt-5 max-w-lg mx-auto text-base text-white/40 leading-relaxed">
            A complete geospatial toolkit designed for precision, performance,
            and scalability across any geography.
          </p>
        </header>

        {/* ── Feature cards grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5" role="list">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                role="listitem"
                className={`group relative flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-sm transition-all duration-400 hover:border-white/15 hover:bg-white/[0.055] hover:-translate-y-1.5 hover:shadow-2xl ${feature.glowColor}`}
              >
                {/* Map preview image */}
                <div className="relative h-52 w-full overflow-hidden bg-black/60 flex-shrink-0">
                  <Image
                    src={feature.image}
                    alt={feature.imageAlt}
                    fill
                    className="object-cover opacity-75 transition-all duration-500 group-hover:scale-105 group-hover:opacity-90"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  {/* Bottom fade into card */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-transparent" />
                </div>

                {/* Content */}
                <div className="flex flex-col gap-4 p-6 pt-5">
                  {/* Icon */}
                  <div
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border ${feature.iconBg} transition-transform duration-200 group-hover:scale-105`}
                    aria-hidden="true"
                  >
                    <Icon
                      className={`h-5 w-5 ${feature.iconColor}`}
                      strokeWidth={1.75}
                    />
                  </div>

                  {/* Text */}
                  <div>
                    <h3 className="text-[17px] font-bold text-white mb-2 leading-snug">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-white/45 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
