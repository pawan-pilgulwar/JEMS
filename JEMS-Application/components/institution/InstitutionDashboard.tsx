"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  GraduationCap,
  Handshake,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Card } from "@/components/dashboard/student/ui";
import type { InstitutionDashboard as Data } from "@/lib/db/institution";
import type { InstitutionInsightsResponse } from "@/lib/agent/types";

/** Single-series horizontal bar list: label · bar · value. */
function Bars({
  rows,
  max,
  format = (v: number) => String(v),
}: {
  rows: { label: string; value: number; hint?: string }[];
  max?: number;
  format?: (v: number) => string;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.length === 0 && <li className="text-sm text-mediumgray">No data yet.</li>}
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${format(r.value)}${r.hint ? ` · ${r.hint}` : ""}`} className="group">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="truncate font-medium text-navy">{r.label}</span>
            <span className="ml-3 shrink-0 tabular-nums text-mediumgray">
              {format(r.value)}
              {r.hint && <span className="ml-1 text-[10px]">· {r.hint}</span>}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-lightgray">
            <div
              className="h-full rounded-r-[4px] bg-slate transition-[width] duration-500 group-hover:bg-orange"
              style={{ width: `${Math.max(2, (r.value / top) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Head({ icon: Icon, title, hint }: { icon: typeof Users; title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate/10 text-slate">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="text-sm font-semibold text-navy">{title}</h2>
        {hint && <p className="text-[11px] text-mediumgray">{hint}</p>}
      </div>
    </div>
  );
}

export default function InstitutionDashboard({ data: initialData }: { data: Data }) {
  const [data, setData] = useState<Data>(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [sort, setSort] = useState<"readiness" | "modulesPassed" | "applications">("readiness");

  // AI Placement & Curriculum Gap Intelligence
  const [aiInsights, setAiInsights] = useState<InstitutionInsightsResponse | null>(data.latestInsights || null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState("");

  const refreshLive = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/institution/dashboard");
      if (res.ok) {
        const fresh = (await res.json()) as Data;
        setData(fresh);
        if (fresh.latestInsights) setAiInsights(fresh.latestInsights);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error("Live dashboard refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const runAiAnalysis = async () => {
    setAnalyzing(true);
    setAiError("");
    try {
      const res = await fetch("/api/institution/ai/insights", { method: "POST" });
      const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; insights?: InstitutionInsightsResponse; error?: string };
      if (!res.ok || !payload.insights) {
        throw new Error(payload.error || "AI analysis failed. Please try again.");
      }
      setAiInsights(payload.insights);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const students = [...data.students].sort((a, b) => b[sort] - a[sort]);
  const k = data.kpis;

  const tiles = [
    { label: "Students", value: k.students, sub: `${k.withGoals} with career goals set`, icon: Users },
    { label: "Avg. placement readiness", value: `${k.avgReadiness}%`, sub: "across the cohort", icon: Target },
    { label: "Verified skills earned", value: k.verifiedSkills, sub: `${k.modulesPassed} roadmap modules passed`, icon: ShieldCheck },
    { label: "Applications", value: k.applications, sub: `${k.internshipApplications} to internships`, icon: Briefcase },
    { label: "Offers", value: k.offers, sub: `${k.placementRate}% of students placed`, icon: TrendingUp },
  ];

  const ratingColor =
    aiInsights?.cohort_health_rating === "Strong"
      ? "bg-emerald/10 text-emerald border-emerald/30"
      : aiInsights?.cohort_health_rating === "Moderate"
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : aiInsights?.cohort_health_rating === "Needs Attention"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-red-50 text-red-700 border-red-200";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate/10 px-2.5 py-1 text-xs font-semibold text-slate">
            <GraduationCap className="h-3.5 w-3.5" /> {data.institution}
          </span>
          <h1 className="mt-3 text-2xl font-bold text-navy">Skill development & placement analytics</h1>
          <p className="mt-1 text-sm text-mediumgray">
            Real-time live view of how your students are progressing from skill gaps to internships and placements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-mediumgray">
            Updated {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <button
            type="button"
            onClick={refreshLive}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-lightgray bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-sm transition hover:bg-surface disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Live Refresh
          </button>
        </div>
      </div>

      {/* KPI tiles */}
      <div data-tour="inst-kpis" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {tiles.map((t) => (
          <Card key={t.label} className="p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium text-mediumgray">{t.label}</p>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate/10 text-slate">
                <t.icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold text-navy">{t.value}</p>
            <p className="mt-1 text-xs text-mediumgray">{t.sub}</p>
          </Card>
        ))}
      </div>

      {/* AI Placement & Curriculum Gap Intelligence Section */}
      <Card className="border-orange/30 bg-gradient-to-r from-orange/5 via-transparent to-slate/5 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange/10 text-orange">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-navy">AI Placement & Curriculum Gap Intelligence</h2>
                {aiInsights && (
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ratingColor}`}>
                    Health: {aiInsights.cohort_health_rating}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-mediumgray">
                Deep LLM evaluation comparing your active student cohort against current live market openings.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={runAiAnalysis}
            disabled={analyzing}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-gradient px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
          >
            {analyzing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {analyzing ? "Analyzing Cohort with AI…" : aiInsights ? "Re-Run AI Analysis" : "Run AI Placement Analysis"}
          </button>
        </div>

        {aiError && <p className="mt-3 text-xs font-medium text-red-600">{aiError}</p>}

        {aiInsights ? (
          <div className="mt-5 space-y-4 border-t border-lightgray pt-4">
            <div className="rounded-lg bg-white/80 p-4 border border-lightgray">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate">Executive Summary for Deans & TPOs</h3>
              <p className="mt-1 text-sm leading-relaxed text-navy">{aiInsights.executive_summary}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Curriculum Bottlenecks */}
              <div className="rounded-lg bg-white/80 p-4 border border-lightgray">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-navy">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> High-Impact Curriculum Bottlenecks
                </h3>
                <ul className="mt-2.5 space-y-2">
                  {aiInsights.curriculum_bottlenecks.map((b) => (
                    <li key={b.skill} className="rounded-md border border-lightgray/60 bg-surface/50 p-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-navy">{b.skill}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            b.gap_severity === "High"
                              ? "bg-red-100 text-red-700"
                              : b.gap_severity === "Medium"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald/10 text-emerald"
                          }`}
                        >
                          {b.gap_severity} Gap
                        </span>
                      </div>
                      <p className="mt-1 text-mediumgray">{b.impact_on_placements}</p>
                      <p className="mt-1 font-medium text-slate">Action: {b.recommended_action}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Placement Risks & Action Plan */}
              <div className="space-y-4">
                <div className="rounded-lg bg-white/80 p-4 border border-lightgray">
                  <h3 className="text-xs font-semibold text-navy">Identified Placement Risk Factors</h3>
                  <ul className="mt-2 space-y-1.5">
                    {aiInsights.placement_risks.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-mediumgray">
                        <span className="mt-0.5 text-red-500">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg bg-white/80 p-4 border border-lightgray">
                  <h3 className="text-xs font-semibold text-navy">Intervention Action Plan</h3>
                  <ul className="mt-2 space-y-2">
                    {aiInsights.action_plan.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 rounded-md bg-surface p-2 text-xs">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-navy">{a.area}</span>
                            <span className="rounded bg-navy/10 px-1 text-[9px] text-navy font-medium">{a.priority}</span>
                          </div>
                          <p className="mt-0.5 text-mediumgray">{a.action}</p>
                          <p className="mt-0.5 text-[11px] text-slate italic">Outcome: {a.expected_outcome}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-mediumgray italic">
            Click &quot;Run AI Placement Analysis&quot; to evaluate your cohort&apos;s verified skills against current market job requirements.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card data-tour="inst-skill-gaps" className="p-6">
          <Head icon={Zap} title="Skill gap statistics" hint="Industry demand vs. share of students with the skill verified" />
          <Bars
            rows={data.skillGaps.slice(0, 8).map((g) => ({
              label: g.skill,
              value: g.coverage,
              hint: `${g.demand} openings ask for it`,
            }))}
            max={100}
            format={(v) => `${v}% verified`}
          />
        </Card>
        <Card data-tour="inst-demand" className="p-6">
          <Head icon={TrendingUp} title="Industry demand trends" hint="Skills most requested in current openings" />
          <Bars rows={data.demandTrends.map((d) => ({ label: d.skill, value: d.openings }))} format={(v) => `${v} openings`} />
        </Card>
        <div className="space-y-6">
          <Card data-tour="inst-readiness" className="p-6">
            <Head icon={Target} title="Placement readiness" hint="Students per readiness band" />
            <Bars rows={data.readinessBuckets.map((b) => ({ label: b.label, value: b.count }))} format={(v) => `${v} students`} />
          </Card>
          <Card data-tour="inst-pipeline" className="p-6">
            <Head icon={Briefcase} title="Application pipeline" />
            <Bars rows={data.applicationsByStatus.map((s) => ({ label: s.status, value: s.count }))} />
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card data-tour="inst-interests" className="p-6">
          <Head icon={Users} title="Career interests" hint="Target roles chosen by students" />
          <Bars rows={data.targetRoles.map((r) => ({ label: r.role, value: r.count }))} format={(v) => `${v}`} />
        </Card>
        <Card data-tour="inst-collab" className="p-6 xl:col-span-2">
          <Head icon={Handshake} title="Industry collaboration" hint="Upcoming FDPs, training and research programs open to your faculty" />
          <ul className="divide-y divide-lightgray">
            {data.collaborations.map((c) => (
              <li key={c.title} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-navy">{c.title}</span>
                  <span className="text-[11px] text-mediumgray">
                    {c.company} · {c.startsAt ? new Date(c.startsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                  </span>
                </span>
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">{c.type}</span>
                <span className="w-24 text-right text-xs text-mediumgray">{c.interested} faculty interested</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Students table */}
      <Card data-tour="inst-students">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-lightgray px-5 py-3.5">
          <h2 className="text-sm font-semibold text-navy">Students ({students.length})</h2>
          <div className="flex gap-1.5">
            {([["readiness", "Readiness"], ["modulesPassed", "Modules"], ["applications", "Applications"]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  sort === key ? "bg-navy text-white" : "border border-lightgray text-mediumgray hover:text-navy"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-mediumgray">
                <th className="px-5 py-2.5 font-semibold">Student</th>
                <th className="px-5 py-2.5 font-semibold">Target role</th>
                <th className="px-5 py-2.5 font-semibold">Readiness</th>
                <th className="px-5 py-2.5 font-semibold">Verified skills</th>
                <th className="px-5 py-2.5 font-semibold">Modules</th>
                <th className="px-5 py-2.5 font-semibold">Applications</th>
                <th className="px-5 py-2.5 font-semibold">Best status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lightgray">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-surface-2">
                  <td className="px-5 py-2.5 font-medium text-navy">
                    <a href={`/p/${s.id}`} target="_blank" rel="noreferrer" className="hover:text-slate hover:underline">
                      {s.name}
                    </a>
                  </td>
                  <td className="px-5 py-2.5 text-mediumgray">{s.targetRole}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-lightgray">
                        <div className="h-full rounded-r-[4px] bg-slate" style={{ width: `${s.readiness}%` }} />
                      </div>
                      <span className="tabular-nums text-xs text-navy">{s.readiness}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-2.5 tabular-nums text-navy">{s.verifiedSkills}</td>
                  <td className="px-5 py-2.5 tabular-nums text-navy">{s.modulesPassed}</td>
                  <td className="px-5 py-2.5 tabular-nums text-navy">{s.applications}</td>
                  <td className="px-5 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        /offer|selected/i.test(s.bestStatus)
                          ? "bg-emerald/10 text-emerald"
                          : /interview|shortlist/i.test(s.bestStatus)
                          ? "bg-slate/10 text-slate"
                          : "bg-surface text-mediumgray"
                      }`}
                    >
                      {s.bestStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
