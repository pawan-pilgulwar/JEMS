"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, Download, ExternalLink, FileText, LoaderCircle, Search, ShieldCheck, Sparkles, ThumbsUp, TriangleAlert, X } from "lucide-react";
import TaskStatus from "@/components/ai/TaskStatus";
import { Card } from "@/components/dashboard/student/ui";
import LiveRefresh from "@/components/portal/LiveRefresh";
import type { MatchExplanationView } from "@/lib/ai/match";
import { isActive } from "@/lib/ai-tasks/types";
import { startAiTask, useAiTasks } from "@/lib/ai-tasks/use-tasks";
import { APPLICATION_STATUSES } from "@/lib/company/constants";
import { downloadCsv } from "@/lib/csv";
import type { ApplicantView, CandidateView, OpeningView } from "@/lib/db/company";
import { PageHead, STATUS_STYLE, TYPE_STYLE, fmtDate, inputClass } from "./ui";

type Row = CandidateView & { opening?: ApplicantView["opening"] };
type SortKey = "score" | "readiness" | "recent" | "name";

const NOT_APPLIED = "Not applied";
const ANY = "";

/** Distinct non-empty values with counts, most common first. */
function options(rows: Row[], pick: (r: Row) => string | string[]): { value: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) for (const v of ([] as string[]).concat(pick(r))) if (v && v !== "—") m.set(v, (m.get(v) ?? 0) + 1);
  return Array.from(m, ([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/**
 * Skill-based shortlisting. "All applicants" lists everyone who applied to
 * any opening, filterable by the opening / job role they applied to; picking
 * one opening ranks every student against it, applicants first. Pipeline
 * status is editable inline in both views.
 */
export default function Candidates({
  company,
  openings,
  selected,
  candidates,
  insights,
}: {
  company: string;
  openings: OpeningView[];
  /** The opening being ranked, or null for the all-applicants view. */
  selected: OpeningView | null;
  candidates: Row[];
  /** Stored match-agent explanations for this opening, keyed by studentId. */
  insights: Record<string, MatchExplanationView>;
}) {
  const router = useRouter();
  const allMode = !selected;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [insightError, setInsightError] = useState("");
  const ai = useAiTasks(["match.explain"], { onSettled: () => router.refresh(), idlePolling: false });

  const explain = async (studentId: string) => {
    if (!selected) return;
    setInsightError("");
    setExpanded(studentId);
    try {
      ai.track(await startAiTask("/api/company/ai/match", { jobId: selected.id, studentId }));
    } catch (err) {
      setInsightError(err instanceof Error ? err.message : "Could not start the insight.");
    }
  };

  // Server data is the source of truth; local overrides only hold status edits until the refresh lands.
  const [statusOverride, setStatusOverride] = useState<Record<string, string>>({});
  const rows = useMemo(
    () => candidates.map((c) => (c.application && statusOverride[c.application.id] ? { ...c, application: { ...c.application, status: statusOverride[c.application.id] } } : c)),
    [candidates, statusOverride],
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [statusError, setStatusError] = useState("");

  const [query, setQuery] = useState("");
  const [role, setRole] = useState(ANY);
  const [type, setType] = useState(ANY);
  const [status, setStatus] = useState(ANY);
  const [institution, setInstitution] = useState(ANY);
  const [targetRole, setTargetRole] = useState(ANY);
  const [skill, setSkill] = useState(ANY);
  const [minScore, setMinScore] = useState(0);
  const [minReadiness, setMinReadiness] = useState(0);
  const [sort, setSort] = useState<SortKey>(allMode ? "recent" : "score");

  const setPipelineStatus = async (applicationId: string, next: string) => {
    setBusy(applicationId);
    setStatusError("");
    try {
      const res = await fetch(`/api/company/applications/${applicationId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Could not update the status.");
      setStatusOverride((m) => ({ ...m, [applicationId]: next }));
      router.refresh();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Could not update the status.");
    } finally {
      setBusy(null);
    }
  };

  const statusOf = (c: Row) => c.application?.status ?? NOT_APPLIED;
  const opts = useMemo(
    () => ({
      roles: options(rows, (r) => r.opening?.role ?? ""),
      types: options(rows, (r) => r.opening?.type ?? ""),
      institutions: options(rows, (r) => r.institution),
      targetRoles: options(rows, (r) => r.targetRole),
      skills: selected ? [...selected.requiredSkills, ...selected.niceToHave].map((value) => ({ value, count: rows.filter((r) => r.matched.includes(value)).length })) : options(rows, (r) => r.matched),
      statuses: [...APPLICATION_STATUSES, ...(allMode ? [] : [NOT_APPLIED])].map((s) => ({ value: s, count: rows.filter((r) => statusOf(r) === s).length })),
    }),
    [rows, selected, allMode],
  );

  const q = query.trim().toLowerCase();
  const visible = rows
    .filter((c) =>
      (!q || c.name.toLowerCase().includes(q) || c.institution.toLowerCase().includes(q) || c.targetRole.toLowerCase().includes(q)) &&
      (!role || c.opening?.role === role) &&
      (!type || c.opening?.type === type) &&
      (!status || statusOf(c) === status) &&
      (!institution || c.institution === institution) &&
      (!targetRole || c.targetRole === targetRole) &&
      (!skill || c.matched.includes(skill)) &&
      c.score >= minScore &&
      c.readiness >= minReadiness,
    )
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "readiness") return b.readiness - a.readiness;
      if (sort === "recent") return (b.application?.appliedAt ?? "").localeCompare(a.application?.appliedAt ?? "");
      return (allMode ? 0 : Number(!!b.application) - Number(!!a.application)) || b.score - a.score;
    });

  const activeFilters = [query, role, type, status, institution, targetRole, skill].filter(Boolean).length + Number(minScore > 0) + Number(minReadiness > 0);
  const clear = () => {
    setQuery(""); setRole(ANY); setType(ANY); setStatus(ANY); setInstitution(ANY); setTargetRole(ANY); setSkill(ANY); setMinScore(0); setMinReadiness(0);
  };

  const exportCsv = () =>
    downloadCsv(
      `candidates-${selected ? selected.role.replace(/\W+/g, "-").toLowerCase() : "all-applicants"}.csv`,
      ["Name", "Applied for", "Type", "Status", "Applied on", "Match %", "Readiness %", "Verified skills", "Institution", "Target role", "Matched skills", "Missing skills"],
      visible.map((c) => [
        c.name, c.opening?.role ?? selected?.role ?? "", c.opening?.type ?? selected?.type ?? "", statusOf(c), c.application?.appliedAt ? fmtDate(c.application.appliedAt) : "",
        c.score, c.readiness, c.verifiedSkills, c.institution, c.targetRole, c.matched, c.missing,
      ]),
    );

  const select = (label: string, value: string, onChange: (v: string) => void, list: { value: string; count: number }[], all = "All") => (
    <label>
      <span className="mb-1.5 block text-xs font-semibold text-navy">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value={ANY}>{all}</option>
        {list.map((o) => <option key={o.value} value={o.value}>{o.value} ({o.count})</option>)}
      </select>
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHead
          company={company}
          title="Candidates"
          hint={allMode ? "Everyone who applied to your openings. Filter by the opening or job role they applied for, status, institution and skills." : "Students ranked by verified-skill compatibility with this opening. Applicants appear first; move them through your pipeline here."}
        />
        <LiveRefresh />
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-navy">View</span>
            <select value={selected?.id ?? "all"} onChange={(e) => router.push(`/company/candidates?job=${e.target.value}`)} className={inputClass}>
              <option value="all">All applicants · every opening ({openings.reduce((n, o) => n + o.applicants, 0)})</option>
              {openings.map((o) => <option key={o.id} value={o.id}>{o.role} · {o.type} — {o.applicants} applied{o.status !== "open" ? " · closed" : ""}</option>)}
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-navy">Search</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mediumgray" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, institution or target role" className={`${inputClass} pl-9`} />
            </span>
          </label>

          {allMode && select("Applied for (job role)", role, setRole, opts.roles, "All job roles")}
          {allMode && select("Opportunity type", type, setType, opts.types, "All types")}
          {select("Institution", institution, setInstitution, opts.institutions, "All institutions")}
          {select("Student's target role", targetRole, setTargetRole, opts.targetRoles, "Any target role")}
          {select("Has skill", skill, setSkill, opts.skills, "Any skill")}
          <label>
            <span className="mb-1.5 block text-xs font-semibold text-navy">Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={inputClass}>
              <option value="score">Best match</option>
              <option value="readiness">Readiness</option>
              <option value="recent">Most recent application</option>
              <option value="name">Name</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold text-navy">Min. compatibility: {minScore}%</span>
            <input type="range" min={0} max={100} step={10} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="mt-2 w-full accent-[#ea580c]" />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold text-navy">Min. readiness: {minReadiness}%</span>
            <input type="range" min={0} max={100} step={10} value={minReadiness} onChange={(e) => setMinReadiness(Number(e.target.value))} className="mt-2 w-full accent-[#ea580c]" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-lightgray pt-3">
          <span className="mr-1 text-xs font-semibold text-navy">Status</span>
          {[{ value: ANY, count: rows.length }, ...opts.statuses].map((s) => (
            <button
              key={s.value || "all"}
              type="button"
              onClick={() => setStatus(s.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${status === s.value ? "bg-navy text-white" : "border border-lightgray text-mediumgray hover:text-navy"}`}
            >
              {s.value || "All"} <span className="tabular-nums opacity-70">{s.count}</span>
            </button>
          ))}
          {activeFilters > 0 && (
            <button type="button" onClick={clear} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate hover:underline">
              <X className="h-3.5 w-3.5" /> Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
            </button>
          )}
        </div>

        {selected && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-lightgray pt-3">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_STYLE(selected.type)}`}>{selected.type}</span>
            <span className="text-xs text-mediumgray">Requires:</span>
            {selected.requiredSkills.map((s) => <span key={s} className="rounded bg-navy px-1.5 py-0.5 text-[10px] font-medium text-white">{s}</span>)}
            {selected.niceToHave.map((s) => <span key={s} className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium text-navy">+ {s}</span>)}
          </div>
        )}
      </Card>

      {openings.length === 0 ? (
        <Card className="p-8 text-center text-sm text-mediumgray">
          Post an opening first — <Link href="/company/opportunities" className="font-semibold text-slate hover:underline">Jobs / Internships</Link>.
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-lightgray px-5 py-3.5">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-navy">
              <Sparkles className="h-4 w-4 text-slate" /> {visible.length} of {rows.length} {allMode ? "applicants" : "candidates"}
            </h2>
            <div className="flex items-center gap-3">
              <span className="hidden text-[11px] text-mediumgray sm:inline">Scored by the Matching Agent</span>
              <button type="button" onClick={exportCsv} disabled={visible.length === 0} className="inline-flex items-center gap-1.5 rounded-md border border-lightgray px-2.5 py-1.5 text-xs font-semibold text-navy hover:border-slate hover:text-slate disabled:opacity-50">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>
          </div>
          {statusError && <p className="border-b border-lightgray px-5 py-2 text-xs text-red-600">{statusError}</p>}
          <ul className="divide-y divide-lightgray">
            {visible.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-mediumgray">
                {rows.length === 0 ? (allMode ? "No one has applied to your openings yet." : "No students to rank yet.") : "No candidates match these filters."}
              </li>
            )}
            {visible.map((c, i) => {
              const key = c.application?.id ?? c.studentId;
              const insight = selected ? insights[c.studentId] : undefined;
              const task = selected ? ai.latestFor(`${selected.id}:${c.studentId}`) : null;
              const working = !!task && isActive(task.status);
              const show = expanded === c.studentId;
              return (
                <li key={key} className="px-5 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <span className="w-6 text-xs font-semibold tabular-nums text-mediumgray">#{i + 1}</span>
                    <div className="flex w-16 shrink-0 flex-col items-center">
                      <span className={`text-xl font-bold ${c.score >= 70 ? "text-emerald" : c.score >= 40 ? "text-amber-600" : "text-mediumgray"}`}>{c.score}%</span>
                      <span className="text-[10px] text-mediumgray">match</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <a href={`/view/student/${c.studentId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-navy hover:text-slate hover:underline">{c.name} <ExternalLink className="h-3 w-3" /></a>
                        <span className="text-[11px] text-mediumgray">{c.targetRole}{c.institution ? ` · ${c.institution}` : ""}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald/10 px-2 py-0.5 text-[10px] font-semibold text-emerald"><ShieldCheck className="h-3 w-3" /> {c.verifiedSkills} verified</span>
                        <span className="text-[10px] text-mediumgray">readiness {c.readiness}%</span>
                      </div>
                      {c.opening && (
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-mediumgray">
                          Applied for
                          <Link href={`/company/candidates?job=${c.opening.id}`} className="font-semibold text-navy hover:text-slate hover:underline">{c.opening.role}</Link>
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_STYLE(c.opening.type)}`}>{c.opening.type}</span>
                          {c.application && <span>· {fmtDate(c.application.appliedAt)}</span>}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {c.matched.map((s) => <span key={s} className="rounded bg-emerald/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald">✓ {s}</span>)}
                        {c.missing.map((s) => <span key={s} className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">✗ {s}</span>)}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {c.application ? (
                        <div className="flex items-center gap-2">
                          {c.application.resume && (
                            <Link
                              href={`/company/applications/${c.application.id}/resume`}
                              title={c.application.resume.name}
                              className="inline-flex items-center gap-1 rounded-md border border-lightgray px-2 py-1 text-[11px] font-semibold text-navy hover:border-slate hover:text-slate"
                            >
                              <FileText className="h-3.5 w-3.5" /> Resume
                            </Link>
                          )}
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE(c.application.status)}`}>{c.application.status}</span>
                          <select
                            value={c.application.status}
                            disabled={busy === c.application.id}
                            onChange={(e) => setPipelineStatus(c.application!.id, e.target.value)}
                            className="h-8 rounded-md border border-lightgray bg-white px-2 text-xs text-navy outline-none focus:border-slate disabled:opacity-60"
                            aria-label="Update application status"
                          >
                            {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-mediumgray"><CircleCheck className="h-3.5 w-3.5" /> Not applied · recommended by skills</span>
                      )}
                    </div>
                    {selected && (
                      <button
                        type="button"
                        onClick={() => (insight && !show ? setExpanded(c.studentId) : insight && show ? setExpanded(null) : explain(c.studentId))}
                        disabled={working}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-lightgray px-2.5 py-1.5 text-xs font-semibold text-navy transition-colors hover:border-slate hover:text-slate disabled:opacity-60"
                        title="The match agent explains strengths, gaps and a recommendation for this score"
                      >
                        {working ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {working ? "Analysing…" : insight ? (show ? "Hide insight" : "AI insight") : "Explain match"}
                      </button>
                    )}
                  </div>
                  {selected && (show || working) && (
                    <div className="mt-3 rounded-lg border border-lightgray bg-surface-2/60 p-3 lg:ml-[5.5rem]">
                      {task && (working || task.status === "failed") && <TaskStatus task={task} />}
                      {show && insightError && <p className="text-xs text-red-600">{insightError}</p>}
                      {insight && !working && (
                        <div className="space-y-2 text-xs">
                          {insight.recommendation && <p className="text-sm text-navy">{insight.recommendation}</p>}
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <ul className="space-y-1">
                              {insight.strengths.map((x) => <li key={x} className="flex items-start gap-1.5 text-emerald"><ThumbsUp className="mt-0.5 h-3.5 w-3.5 shrink-0" />{x}</li>)}
                            </ul>
                            <ul className="space-y-1">
                              {insight.gaps.map((x) => <li key={x} className="flex items-start gap-1.5 text-amber-700"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{x}</li>)}
                            </ul>
                          </div>
                          <p className="flex items-center justify-between text-[11px] text-mediumgray">
                            <span>Explains a {insight.score}% score · {new Date(insight.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                            <button type="button" onClick={() => explain(c.studentId)} className="font-semibold text-slate hover:underline">Refresh</button>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
