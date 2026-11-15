"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useDemoMode } from "@/components/tour/DemoMode";

/**
 * Re-renders the current server page on an interval (and on demand), so
 * portal screens pick up new applicants, interest and status changes made by
 * other users without a manual reload. Pauses while the tab is hidden.
 */
export default function LiveRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [at, setAt] = useState(() => new Date());
  const demo = useDemoMode();

  useEffect(() => {
    if (demo) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      start(() => router.refresh());
      setAt(new Date());
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, router, demo]);

  const refresh = () => {
    if (demo) return;
    start(() => router.refresh());
    setAt(new Date());
  };

  return (
    <div className="flex items-center gap-2">
      {/* Server and browser clocks/locales differ; the client value wins. */}
      <span suppressHydrationWarning className="text-[11px] text-mediumgray">
        Live · updated {at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
      <button
        type="button"
        onClick={refresh}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-lightgray bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-sm transition hover:bg-surface disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} /> Refresh
      </button>
    </div>
  );
}
