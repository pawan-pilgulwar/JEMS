"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle, PlayCircle } from "lucide-react";
import { useTour } from "./TourProvider";
import type { TourId } from "./tours";

/**
 * Header help button for every portal. Guided tours are off by default; this
 * popover holds the switch that brings them back and, once on, replays the
 * tour for the current portal.
 */
export default function TourMenu({ tour, label }: { tour: TourId; label?: string }) {
  const { start, tourEnabled, setTourEnabled } = useTour();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Help & guided tours"
        title="Help & guided tours"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-tour="help"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-mediumgray transition-colors hover:bg-surface hover:text-navy"
      >
        <HelpCircle className="h-5 w-5" />
        {label && <span className="hidden sm:inline">{label}</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Guided tours"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-navy/[0.08] bg-white p-4 shadow-[var(--shadow-card)]"
          style={{ animation: "fade-in 0.18s ease-out" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-navy">Guided tours</p>
              <p className="text-[11px] text-mediumgray">{tourEnabled ? "On — tours start on first visit to each portal." : "Off — turn on to get step-by-step walkthroughs."}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={tourEnabled}
              aria-label="Enable guided tours"
              onClick={() => setTourEnabled(!tourEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${tourEnabled ? "bg-orange" : "bg-gray-200"}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${tourEnabled ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
          <button
            type="button"
            disabled={!tourEnabled}
            onClick={() => {
              setOpen(false);
              start(tour);
            }}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:bg-lightgray disabled:text-mediumgray"
          >
            <PlayCircle className="h-4 w-4" /> Start the tour
          </button>
        </div>
      )}
    </div>
  );
}
