"use client";

import { GraduationCap } from "lucide-react";
import { Card } from "@/components/dashboard/student/ui";
import LiveRefresh from "@/components/portal/LiveRefresh";

/** Shared bits for the institution portal screens. */

export const fieldClass =
  "h-10 w-full rounded-lg border border-lightgray bg-white px-3 text-sm text-navy outline-none transition-colors placeholder:text-mediumgray focus:border-slate";

export function InstitutionHead({ institution, title, hint }: { institution: string; title: string; hint: string }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate/10 px-2.5 py-1 text-xs font-semibold text-slate">
          <GraduationCap className="h-3.5 w-3.5" /> {institution}
        </span>
        <h1 className="mt-3 text-2xl font-bold text-navy">{title}</h1>
        <p className="mt-1 text-sm text-mediumgray">{hint}</p>
      </div>
      <LiveRefresh />
    </div>
  );
}

export function StatTiles({ tiles }: { tiles: { label: string; value: string | number; sub?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label} className="p-4">
          <p className="text-xs font-medium text-mediumgray">{t.label}</p>
          <p className="mt-2 text-2xl font-bold text-navy">{t.value}</p>
          {t.sub && <p className="text-[11px] text-mediumgray">{t.sub}</p>}
        </Card>
      ))}
    </div>
  );
}

export function Select({ label, value, onChange, options, all = "All" }: { label: string; value: string; onChange: (v: string) => void; options: string[]; all?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-navy">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
        <option value="">{all}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

/** Distinct, non-empty, sorted values. */
export const distinct = (values: string[]) => [...new Set(values.filter((v) => v && v !== "—"))].sort((a, b) => a.localeCompare(b));

export const STATUS_PILL = (s: string) =>
  /offer|selected|placed|accepted|completed/i.test(s)
    ? "bg-emerald/10 text-emerald"
    : /interview|shortlist|review|in process|waitlist/i.test(s)
      ? "bg-slate/10 text-slate"
      : /reject|declined/i.test(s)
        ? "bg-red-50 text-red-600"
        : "bg-surface text-mediumgray";

export const fmtDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
