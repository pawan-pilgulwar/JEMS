"use client";

import CompanyLink from "@/components/profile/CompanyLink";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building, CalendarDays, Check, Clock, GraduationCap, LoaderCircle, MonitorPlay, Search, Send, Users, X } from "lucide-react";
import DashboardShell, { DashboardContainer } from "@/components/dashboard/student/DashboardShell";
import { Card, EmptyState } from "@/components/dashboard/student/ui";
import type { StudentProgramView } from "@/lib/db/programs";

const STATUS_STYLE = (s: string) =>
  /accepted|completed/i.test(s) ? "bg-emerald/10 text-emerald" : /waitlist/i.test(s) ? "bg-amber-50 text-amber-700" : /reject/i.test(s) ? "bg-red-50 text-red-600" : "bg-slate/10 text-slate";
const fmt = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "TBA");

type View = "all" | "gaps" | "mine";

/**
 * Training, certifications, workshops and mentorship published by industry
 * partners. Students apply here; the company sees the application in its
 * Programs screen and its decision comes back as a status + notification.
 */
export default function IndustryPrograms({ programs }: { programs: StudentProgramView[] }) {
  const router = useRouter();
  const [view, setView] = useState<View>("all");
  const [type, setType] = useState("");
  const [query, setQuery] = useState("");
  const [applying, setApplying] = useState<string | null>(null);
  const [motivation, setMotivation] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  const call = async (id: string, method: "POST" | "DELETE", body: object) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/student/programs", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Something went wrong.");
      setApplying(null);
      setMotivation("");
      router.refresh();
    } catch (err) {
      setError({ id, message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(null);
    }
  };

  const types = [...new Set(programs.map((p) => p.type).filter(Boolean))];
  const q = query.trim().toLowerCase();
  const visible = programs.filter(
    (p) =>
      (view === "all" || (view === "mine" ? !!p.myEnrollment : p.gaps.length > 0 && p.status === "open")) &&
      (!type || p.type === type) &&
      (!q || `${p.title} ${p.company} ${p.skills.join(" ")}`.toLowerCase().includes(q)),
  );
  const mine = programs.filter((p) => p.myEnrollment);

  if (programs.length === 0) {
    return (
      <DashboardShell>
        <DashboardContainer>
          <EmptyState icon={GraduationCap} title="No industry programs yet" hint="When companies publish training, certifications, workshops or mentorship, they appear here for you to apply." ctaLabel="Back to learning" ctaHref="/student/learning" />
        </DashboardContainer>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <DashboardContainer className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Industry programs</h1>
          <p className="mt-1 text-sm text-mediumgray">Training and certifications run by hiring companies. Programs that teach skills you&apos;re missing are flagged for you.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Open programs", value: programs.filter((p) => p.status === "open").length },
            { label: "Fill your gaps", value: programs.filter((p) => p.gaps.length > 0 && p.status === "open").length },
            { label: "My applications", value: mine.length },
            { label: "Accepted", value: mine.filter((p) => /accepted|completed/i.test(p.myEnrollment!.status)).length },
          ].map((t) => (
            <Card key={t.label} className="p-4">
              <p className="text-xs font-medium text-mediumgray">{t.label}</p>
              <p className="mt-2 text-2xl font-bold text-navy">{t.value}</p>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {([["all", "All"], ["gaps", "Fills my skill gaps"], ["mine", `My applications (${mine.length})`]] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setView(k)} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${view === k ? "bg-navy text-white" : "border border-lightgray bg-white text-mediumgray hover:text-navy"}`}>{label}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <span className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mediumgray" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search programs, companies, skills" className="h-10 w-full rounded-lg border border-lightgray bg-white pl-9 pr-3 text-sm text-navy outline-none focus:border-slate md:w-64" />
            </span>
            <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 rounded-lg border border-lightgray bg-white px-3 text-sm text-navy outline-none focus:border-slate" aria-label="Program type">
              <option value="">All types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {visible.length === 0 && <Card className="p-8 text-center text-sm text-mediumgray">No programs match these filters.</Card>}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => {
            const full = p.seats > 0 && p.seatsLeft === 0;
            const closed = p.status === "closed";
            const e = p.myEnrollment;
            const canWithdraw = e && !/accepted|completed/i.test(e.status);
            return (
              <Card key={p.id} className={`flex flex-col p-5 ${e ? "border-slate/30" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full bg-slate/10 px-2 py-0.5 text-[10px] font-semibold text-slate">{p.type}</span>
                  {e ? (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE(e.status)}`}>{e.status}</span>
                  ) : closed ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">Closed</span>
                  ) : full ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Full</span>
                  ) : null}
                </div>
                <h3 className="mt-3 text-base font-bold text-navy">{p.title}</h3>
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-mediumgray"><Building className="h-3 w-3" /> <CompanyLink id={p.companyId} name={p.company} /></p>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-mediumgray">
                  <dd className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{fmt(p.startsAt)}</dd>
                  <dd className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{p.duration}</dd>
                  <dd className="inline-flex items-center gap-1"><MonitorPlay className="h-3 w-3" />{p.mode}</dd>
                  <dd className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{p.seats > 0 ? `${p.seatsLeft} of ${p.seats} seats left` : "Open seats"}</dd>
                </dl>
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.skills.map((s) => (
                    <span key={s} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${p.matched.includes(s) ? "bg-emerald/10 text-emerald" : "bg-orange/10 text-orange"}`} title={p.matched.includes(s) ? "You already have this" : "New skill for you"}>
                      {p.matched.includes(s) ? "✓" : "+"} {s}
                    </span>
                  ))}
                </div>
                {p.gaps.length > 0 && <p className="mt-2 text-[11px] text-mediumgray">Teaches {p.gaps.length} skill{p.gaps.length > 1 ? "s" : ""} you don&apos;t have yet.</p>}

                <div className="mt-auto pt-4">
                  {applying === p.id ? (
                    <div className="space-y-2">
                      <textarea value={motivation} onChange={(ev) => setMotivation(ev.target.value)} maxLength={600} placeholder="Why do you want to join? (optional)" className="min-h-20 w-full rounded-lg border border-lightgray px-3 py-2 text-sm text-navy outline-none focus:border-slate" />
                      <div className="flex gap-2">
                        <button type="button" disabled={busy === p.id} onClick={() => call(p.id, "POST", { programId: p.id, motivation })} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-gradient py-2 text-sm font-semibold text-white disabled:opacity-60">
                          {busy === p.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit
                        </button>
                        <button type="button" onClick={() => setApplying(null)} className="rounded-lg border border-lightgray px-3 text-sm text-navy"><X className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ) : e ? (
                    <div className="flex items-center justify-between gap-2 text-[11px] text-mediumgray">
                      <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-emerald" /> Applied {fmt(e.appliedAt)}</span>
                      {canWithdraw && (
                        <button type="button" disabled={busy === p.id} onClick={() => call(p.id, "DELETE", { programId: p.id })} className="font-semibold text-red-600 hover:underline disabled:opacity-60">Withdraw</button>
                      )}
                    </div>
                  ) : (
                    <button type="button" disabled={closed || full} onClick={() => { setApplying(p.id); setMotivation(""); setError(null); }} className="w-full rounded-lg bg-primary-gradient py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(234,88,12,0.25)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-none disabled:bg-lightgray disabled:text-mediumgray disabled:shadow-none disabled:hover:translate-y-0">
                      {closed ? "Applications closed" : full ? "All seats filled" : "Apply"}
                    </button>
                  )}
                  {error?.id === p.id && <p className="mt-2 text-xs text-red-600">{error.message}</p>}
                </div>
              </Card>
            );
          })}
        </div>
      </DashboardContainer>
    </DashboardShell>
  );
}
