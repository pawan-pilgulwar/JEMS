"use client";

import CompanyLink from "@/components/profile/CompanyLink";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building, CalendarDays, Check, Clock, Handshake, MapPin, Search, Star, Users } from "lucide-react";
import { Card } from "@/components/dashboard/student/ui";
import LiveRefresh from "@/components/portal/LiveRefresh";
import type { CollaborationView } from "@/lib/db/collaborations";

const TYPES = ["All", "FDP", "Faculty Internship", "Industrial Training", "Guest Lecture", "Research", "Consultancy", "Innovation Challenge", "Live Project"];

const TYPE_STYLE: Record<string, string> = {
  FDP: "bg-violet-50 text-violet-700",
  "Faculty Internship": "bg-sky-50 text-sky-700",
  "Industrial Training": "bg-emerald/10 text-emerald",
  "Guest Lecture": "bg-gold/15 text-amber-700",
  Research: "bg-navy/10 text-navy",
  Consultancy: "bg-slate/10 text-slate",
  "Innovation Challenge": "bg-pink-50 text-pink-700",
  "Live Project": "bg-teal-50 text-teal-700",
};

const STATUS_STYLE = (s: string) => (s === "Accepted" ? "bg-emerald/10 text-emerald" : s === "Declined" ? "bg-red-50 text-red-600" : "bg-slate/10 text-slate");

/**
 * The academician's view of industry collaboration: browse FDPs, faculty
 * internships, industrial training, guest lectures, research and consultancy,
 * and express interest. The publishing company sees who is interested and
 * accepts or declines; that decision shows here. In the institution portal
 * each card also lists the institution's own interested faculty.
 */
export default function CollaborationBoard({
  items,
  who,
  headline,
}: {
  items: CollaborationView[];
  who: string;
  headline: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  // Optimistic toggles until the server refresh lands.
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const local = useMemo(
    () =>
      items.map((r) => {
        if (!(r.id in override) || override[r.id] === r.mine) return r;
        const mine = override[r.id];
        return { ...r, mine, myStatus: mine ? "Interested" : null, interested: r.interested + (mine ? 1 : -1) };
      }),
    [items, override],
  );
  const institutionView = items.some((c) => c.fromMyInstitution);

  const toggle = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/faculty/interest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collaborationId: id }) });
      const data = (await res.json().catch(() => ({}))) as { interested?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not update your interest.");
      setOverride((o) => ({ ...o, [id]: !!data.interested }));
      router.refresh();
    } catch (err) {
      setError({ id, message: err instanceof Error ? err.message : "Could not update your interest." });
    } finally {
      setBusy(null);
    }
  };

  const q = query.trim().toLowerCase();
  const visible = local.filter(
    (c) =>
      (filter === "All" || c.type === filter) &&
      (!onlyMine || c.mine || (c.fromMyInstitution?.length ?? 0) > 0) &&
      (!q || `${c.title} ${c.company} ${c.domain.join(" ")} ${c.description}`.toLowerCase().includes(q)),
  );
  const mine = local.filter((c) => c.mine);
  const available = TYPES.filter((t) => t === "All" || local.some((c) => c.type === t));
  const facultyEngaged = new Set(local.flatMap((c) => (c.fromMyInstitution ?? []).map((p) => p.name))).size;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate/10 px-2.5 py-1 text-xs font-semibold text-slate"><Handshake className="h-3.5 w-3.5" /> {who}</span>
          <h1 className="mt-3 text-2xl font-bold text-navy">{headline}</h1>
          <p className="mt-1 text-sm text-mediumgray">Faculty development programs, industrial training, guest lectures, research and consultancy published by industry partners. Your interest is visible to the company, which can accept it.</p>
        </div>
        <LiveRefresh />
      </div>

      <div data-tour="collab-stats" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Open opportunities", value: local.filter((c) => c.status === "open").length, icon: Handshake },
          { label: "FDPs & training", value: local.filter((c) => /FDP|Training|Internship/.test(c.type)).length, icon: Users },
          institutionView
            ? { label: "Faculty engaged", value: facultyEngaged, icon: Star }
            : { label: "Research & consultancy", value: local.filter((c) => /Research|Consultancy/.test(c.type)).length, icon: Star },
          { label: "My interests", value: `${mine.length}${mine.some((c) => c.myStatus === "Accepted") ? ` · ${mine.filter((c) => c.myStatus === "Accepted").length} accepted` : ""}`, icon: Check },
        ].map((t) => (
          <Card key={t.label} className="p-4">
            <div className="flex items-center justify-between"><p className="text-xs font-medium text-mediumgray">{t.label}</p><t.icon className="h-4 w-4 text-slate" /></div>
            <p className="mt-2 text-2xl font-bold text-navy">{t.value}</p>
          </Card>
        ))}
      </div>

      <div data-tour="collab-filters" className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {available.map((t) => (
            <button key={t} type="button" onClick={() => setFilter(t)} className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${filter === t ? "bg-navy text-white" : "border border-lightgray bg-white text-mediumgray hover:text-navy"}`}>{t}</button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-navy">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="h-4 w-4 accent-[#ea580c]" />
            {institutionView ? "With our interest" : "My interests only"}
          </label>
          <span className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mediumgray" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, company, domain" className="h-9 w-56 rounded-lg border border-lightgray bg-white pl-9 pr-3 text-xs text-navy outline-none focus:border-slate" />
          </span>
        </div>
      </div>

      {visible.length === 0 && <Card className="p-8 text-center text-sm text-mediumgray">No collaborations match these filters.</Card>}

      <div data-tour="collab-grid" className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((c) => {
          const closed = c.status === "closed";
          return (
            <Card key={c.id} className={`flex flex-col p-5 ${c.mine ? "border-emerald/40" : ""} ${closed && !c.mine ? "opacity-75" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_STYLE[c.type] ?? "bg-surface text-navy"}`}>{c.type}</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-mediumgray">
                  <Users className="h-3 w-3" /> {c.interested} interested{c.accepted ? ` · ${c.accepted} accepted` : ""}
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-navy">{c.title}</h3>
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-mediumgray"><Building className="h-3 w-3" /> <CompanyLink id={c.companyId} name={c.company} /></p>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-mediumgray">{c.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">{c.domain.map((d) => <span key={d} className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium text-navy">{d}</span>)}</div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-mediumgray">
                <dd className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{c.startsAt ? new Date(c.startsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "TBA"}</dd>
                <dd className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{c.duration}</dd>
                <dd className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{c.location}</dd>
                <dd className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{c.seats} seats</dd>
              </dl>
              {c.fromMyInstitution && c.fromMyInstitution.length > 0 && (
                <div className="mt-3 rounded-lg bg-surface/70 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate">Your faculty ({c.fromMyInstitution.length})</p>
                  <ul className="mt-1 space-y-1">
                    {c.fromMyInstitution.map((p) => (
                      <li key={p.name} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate text-navy">{p.name}{p.department ? <span className="text-mediumgray"> · {p.department}</span> : null}</span>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLE(p.status)}`}>{p.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {c.mine && c.myStatus && c.myStatus !== "Interested" && (
                <p className={`mt-3 rounded-md px-2 py-1.5 text-center text-xs font-semibold ${STATUS_STYLE(c.myStatus)}`}>
                  {c.company} {c.myStatus === "Accepted" ? "accepted your interest — expect them to reach out." : "declined this time."}
                </p>
              )}
              <button
                type="button"
                onClick={() => toggle(c.id)}
                disabled={busy === c.id || (closed && !c.mine)}
                className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                  c.mine ? "border border-emerald/40 bg-emerald/10 text-emerald" : closed ? "border border-lightgray bg-surface text-mediumgray" : "bg-primary-gradient text-white shadow-[0_4px_12px_rgba(234,88,12,0.25)] hover:-translate-y-0.5"
                }`}
              >
                {c.mine ? <><Check className="h-4 w-4" /> {c.myStatus ?? "Interested"} · withdraw</> : closed ? "Closed to new interest" : <><Star className="h-4 w-4" /> Express interest</>}
              </button>
              {error?.id === c.id && <p className="mt-2 text-xs text-red-600">{error.message}</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
