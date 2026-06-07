"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Drawer } from "vaul";

/** Floating glass panel shell used by both passenger and driver flows. */
export function Panel({
  title,
  onExit,
  children,
}: {
  title: string;
  onExit: () => void;
  children: React.ReactNode;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const snapPoints = [0.16, 0.42, 0.88];
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

  const content = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-xs font-medium text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Exit
        </button>
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <span className="w-10" />
      </div>
      <div className="space-y-3">{children}</div>
    </>
  );

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
            className="pointer-events-auto fixed bottom-0 left-0 right-0 z-[1000] flex h-full max-h-[92dvh] flex-col rounded-t-[28px] border-t border-white/10 bg-zinc-950/92 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-24px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
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
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/15" />
            <Drawer.Title className="sr-only">{title}</Drawer.Title>
            <div
              data-taxi-scroll-area="true"
              className="scrollbar-thin taxi-mobile-scroll flex-1 overflow-y-auto overscroll-contain pb-4"
            >
              {content}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-[1000] max-h-[calc(100dvh-2rem)] w-[min(24rem,calc(100%-2rem))] overflow-y-auto overscroll-contain rounded-[28px] border border-white/10 bg-zinc-950/85 p-4 shadow-2xl backdrop-blur-2xl">
      {content}
    </div>
  );
}

export function AccordionSection({
  title,
  subtitle,
  defaultOpen = false,
  accent,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  accent?: "amber" | "green" | "blue";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const accents = {
    amber: "border-amber-400/20 bg-amber-500/[0.06]",
    green: "border-emerald-400/20 bg-emerald-500/[0.05]",
    blue: "border-sky-400/20 bg-sky-500/[0.05]",
  } as const;

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] ${
        accent ? accents[accent] : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-white/45">{subtitle}</p>}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/45 transition-transform duration-200 ${
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
          <div className="border-t border-white/10 px-4 py-3">{children}</div>
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
      className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-black transition enabled:hover:bg-amber-400 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
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
