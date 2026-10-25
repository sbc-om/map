"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Drawer } from "vaul";

/** Floating glass panel shell used by both passenger and driver flows. */
export function Panel({
  title,
  subtitle,
  badge,
  footer,
  onExit,
  children,
}: {
  title: string;
  /** Secondary line under the title (context or live status). */
  subtitle?: string;
  /** Compact element pinned to the right of the header, e.g. a StatusPill. */
  badge?: React.ReactNode;
  /** Primary actions, pinned below the scrolling content. */
  footer?: React.ReactNode;
  onExit: () => void;
  children: React.ReactNode;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  // The lowest snap keeps the header peeking above the pinned footer.
  const snapPoints = ["200px", 0.5, 0.92];
  const [snap, setSnap] = useState<number | string | null>(snapPoints[1]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncViewport = () => {
      const vv = window.visualViewport;
      setViewportHeight(vv ? Math.round(vv.height) : window.innerHeight);
    };

    syncViewport();
    const vv = window.visualViewport;
    window.addEventListener("resize", syncViewport);
    vv?.addEventListener("resize", syncViewport);
    vv?.addEventListener("scroll", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
      vv?.removeEventListener("resize", syncViewport);
      vv?.removeEventListener("scroll", syncViewport);
    };
  }, []);

  // The sheet is full height but only its top `snap` portion is on screen.
  // Sizing the inner layout to that portion keeps the footer at the visible
  // bottom edge at every snap point.
  const activeSnap = snap ?? snapPoints[0];
  const visibleHeight =
    viewportHeight === null
      ? null
      : typeof activeSnap === "string"
        ? parseFloat(activeSnap)
        : Math.round(activeSnap * viewportHeight);

  const header = (
    <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.07] px-4 pb-3 pt-3.5">
      <button
        type="button"
        onClick={onExit}
        aria-label="Exit"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 transition hover:bg-white/10 hover:text-white active:scale-95"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[15px] font-semibold tracking-tight text-white">
          {title}
        </h2>
        {subtitle && (
          <p className="truncate text-xs text-white/45">{subtitle}</p>
        )}
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
    </header>
  );

  const footerBar = footer ? (
    <div
      className="shrink-0 space-y-2 border-t border-white/[0.07] bg-zinc-950/70 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4"
    >
      {footer}
    </div>
  ) : null;

  if (isMobile) {
    return (
      <Drawer.Root
        open
        onOpenChange={(open) => !open && onExit()}
        snapPoints={snapPoints}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}
        modal={false}
        noBodyStyles
      >
        <Drawer.Portal>
          <Drawer.Content
            className="pointer-events-auto fixed bottom-0 left-0 right-0 z-[1000] flex h-full max-h-[92dvh] flex-col rounded-t-[28px] border-t border-white/10 bg-zinc-950 pt-2.5 shadow-[0_-24px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
            aria-describedby={undefined}
            style={
              viewportHeight
                ? {
                    height: `${viewportHeight}px`,
                    maxHeight: `${viewportHeight}px`,
                  }
                : undefined
            }
          >
            <div
              className="flex min-h-0 flex-col transition-[height] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{ height: visibleHeight ? visibleHeight - 10 : "100%" }}
            >
              <div className="mx-auto h-1.5 w-12 shrink-0 rounded-full bg-white/15" />
              <Drawer.Title className="sr-only">{title}</Drawer.Title>
              {header}
              <div
                data-taxi-scroll-area="true"
                className="scrollbar-thin taxi-mobile-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
              >
                {children}
              </div>
              {footerBar}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-[1000] flex max-h-[calc(100dvh-2rem)] w-[min(24rem,calc(100%-2rem))] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-zinc-950/85 shadow-2xl backdrop-blur-2xl">
      {header}
      <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
        {children}
      </div>
      {footerBar}
    </div>
  );
}

const PILL_TONES = {
  green: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-400/25 bg-amber-500/10 text-amber-300",
  red: "border-red-400/25 bg-red-500/10 text-red-300",
  neutral: "border-white/10 bg-white/5 text-white/55",
} as const;

const PILL_DOTS = {
  green: "bg-emerald-400",
  amber: "bg-amber-400",
  red: "bg-red-400",
  neutral: "bg-white/35",
} as const;

/** Small status badge for panel headers, with an optional live pulse. */
export function StatusPill({
  label,
  tone = "neutral",
  pulse = false,
}: {
  label: string;
  tone?: keyof typeof PILL_TONES;
  pulse?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${PILL_TONES[tone]}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${PILL_DOTS[tone]}`}
          />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${PILL_DOTS[tone]}`} />
      </span>
      {label}
    </span>
  );
}

const SECTION_ACCENTS = {
  amber: "bg-amber-500/15 text-amber-300",
  green: "bg-emerald-500/15 text-emerald-300",
  blue: "bg-sky-500/15 text-sky-300",
} as const;

export function AccordionSection({
  title,
  subtitle,
  icon,
  defaultOpen = false,
  accent = "amber",
  children,
}: {
  title: string;
  subtitle?: string;
  /** Leading glyph, shown in an accent-tinted chip. */
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  accent?: keyof typeof SECTION_ACCENTS;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-white/[0.03]"
      >
        {icon && (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl [&>svg]:h-4 [&>svg]:w-4 ${SECTION_ACCENTS[accent]}`}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{title}</p>
          {subtitle && (
            <p className="truncate text-xs text-white/45">{subtitle}</p>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 ${
            open ? "rotate-180" : "rotate-0"
          }`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-3.5 pb-3.5 pt-0.5">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-white/50">
        {label}
      </span>
      {children}
    </label>
  );
}

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return (
    <input
      {...props}
      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-base text-white placeholder:text-white/35 focus:border-amber-400/60 focus:outline-none sm:text-sm"
    />
  );
}

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-bold text-black shadow-[0_8px_24px_-8px_rgba(245,158,11,0.6)] transition enabled:hover:bg-amber-400 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
    >
      {children}
    </button>
  );
}

/** Outlined destructive action, sized to sit beside a PrimaryButton. */
export function DangerButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/20 active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

export function SmallButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
        active
          ? "border-amber-400/60 bg-amber-500/15 text-amber-300"
          : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
      <p
        className={`mt-0.5 text-sm font-bold ${
          accent ? "text-amber-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function RideLine({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="line-clamp-2 text-xs text-white/70">{text}</span>
    </div>
  );
}
