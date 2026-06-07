"use client";

import { ArrowLeft } from "lucide-react";

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
  return (
    <div className="pointer-events-auto absolute left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[1000] max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-zinc-900/85 p-4 shadow-2xl backdrop-blur-xl sm:left-4 sm:w-[calc(100%-2rem)] sm:translate-x-0">
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
      {children}
    </div>
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
      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-amber-400/60 focus:outline-none"
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
