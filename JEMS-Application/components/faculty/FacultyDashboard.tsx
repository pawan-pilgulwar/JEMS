"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Code2,
  GraduationCap,
  Handshake,
  Layers,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card } from "@/components/dashboard/student/ui";
import type { FacultyDashboardData } from "@/lib/db/faculty";
import type { CurriculumResponse } from "@/lib/agent/types";

const POPULAR_SUBJECTS = [
  "Full Stack Web Development",
  "Cloud Computing & Distributed Systems",
  "Database Management & Modern Data Stores",
  "Operating Systems & Container Architecture",
  "Software Engineering & Agile DevOps",
];

export default function FacultyDashboard({ initialData }: { initialData: FacultyDashboardData }) {
  const [data, setData] = useState<FacultyDashboardData>(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // AI Curriculum state
  const [subject, setSubject] = useState(POPULAR_SUBJECTS[0]);
  const [syllabusInput, setSyllabusInput] = useState(
    "HTML5, CSS basics, JavaScript fundamentals, PHP procedural, MySQL schema design, Apache server"
  );
  const [targetRole, setTargetRole] = useState("Full Stack Software Engineer");
  const [analyzing, setAnalyzing] = useState(false);
  const [curriculumReview, setCurriculumReview] = useState<CurriculumResponse | null>(data.latestReview);
  const [error, setError] = useState("");

  const refreshLive = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/faculty/dashboard");
      if (res.ok) {
        const fresh = (await res.json()) as FacultyDashboardData;
        setData(fresh);
        if (fresh.latestReview) setCurriculumReview(fresh.latestReview);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error("Failed to refresh faculty dashboard:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const runCurriculumAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    setAnalyzing(true);
    setError("");

    try {
      const res = await fetch("/api/faculty/ai/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          current_syllabus: syllabusInput,
          target_role: targetRole.trim(),
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        review?: CurriculumResponse;
        error?: string;
      };

      if (!res.ok || !payload.review) {
        throw new Error(payload.error || "Failed to analyze syllabus.");
      }

      setCurriculumReview(payload.review);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Curriculum analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const k = data.kpis;
  const tiles = [
    { label: "Department students", value: k.departmentStudents, sub: data.faculty.department, icon: Users },
    { label: "Active roadmap learners", value: k.activeLearners, sub: "hands-on skill builders", icon: BookOpen },
    { label: "Avg. placement readiness", value: `${k.avgReadiness}%`, sub: "industry threshold: 65%", icon: Target },
    { label: "Verified skills earned", value: k.verifiedSkills, sub: "backed by code & tests", icon: ShieldCheck },
    { label: "Industry collaborations", value: k.collaborationsCount, sub: `${k.myInterestsCount} expressed interests`, icon: Handshake },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate/10 px-2.5 py-1 text-xs font-semibold text-slate">
            <GraduationCap className="h-3.5 w-3.5" /> {data.faculty.institution} · {data.faculty.department}
          </span>
          <h1 className="mt-3 text-2xl font-bold text-navy">Academia & Curriculum Intelligence Portal</h1>
          <p className="mt-1 text-sm text-mediumgray">
            Welcome, {data.faculty.name}. Monitor student cohort skills in real time and modernize your course syllabus against live industry demands.
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
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

      {/* AI Curriculum Modernizer Section */}
      <Card className="border-orange/30 bg-gradient-to-r from-orange/5 via-transparent to-slate/5 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange/10 text-orange">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-navy">AI Course Syllabus Modernizer (Industry-Aligned)</h2>
            <p className="mt-1 text-xs text-mediumgray">
              Compare your academic course topics against live industry hiring requirements. Identify obsolete topics and integrate modern tools & lab assignments.
            </p>
          </div>
        </div>

        <form onSubmit={runCurriculumAnalysis} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy">Course / Subject Name</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Distributed Systems"
              className="w-full rounded-lg border border-lightgray bg-white px-3 py-2 text-xs text-navy focus:border-slate focus:outline-none"
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {POPULAR_SUBJECTS.slice(0, 3).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSubject(s)}
                  className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-mediumgray hover:text-navy"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-navy">Target Career Role</label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Cloud Engineer / Full Stack"
              className="w-full rounded-lg border border-lightgray bg-white px-3 py-2 text-xs text-navy focus:border-slate focus:outline-none"
            />
          </div>

          <div className="space-y-1.5 md:col-span-3">
            <label className="text-xs font-semibold text-navy">Current Syllabus Topics (Comma-separated or text)</label>
            <textarea
              rows={2}
              value={syllabusInput}
              onChange={(e) => setSyllabusInput(e.target.value)}
              placeholder="List current topics taught in lectures and labs…"
              className="w-full rounded-lg border border-lightgray bg-white px-3 py-2 text-xs text-navy focus:border-slate focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={analyzing}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-gradient px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
            >
              {analyzing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {analyzing ? "Evaluating Syllabus Alignment with vLLM…" : "Analyze Syllabus Alignment"}
            </button>
          </div>
        </form>

        {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}

        {curriculumReview && (
          <div className="mt-6 space-y-4 border-t border-lightgray pt-5">
            <div className="flex flex-col gap-4 rounded-lg border border-lightgray bg-white/90 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate">
                  {curriculumReview.subject}
                </span>
                <p className="mt-1 text-sm font-medium text-navy">{curriculumReview.summary}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3 rounded-xl border border-lightgray bg-surface/50 px-4 py-2.5">
                <Target className="h-6 w-6 text-orange" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-mediumgray">Industry Alignment</p>
                  <p className="text-xl font-bold text-navy">{curriculumReview.alignment_score}%</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Outdated Topics */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-xs">
                <h3 className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Outdated Topics to De-Emphasize
                </h3>
                <ul className="mt-2.5 space-y-1.5 text-amber-950">
                  {curriculumReview.outdated_topics.map((t, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-amber-500">•</span> {t}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Missing Skills */}
              <div className="rounded-lg border border-emerald/30 bg-emerald/5 p-4 text-xs">
                <h3 className="flex items-center gap-1.5 font-bold text-emerald">
                  <CheckCircle2 className="h-4 w-4 text-emerald" /> High-Demand Industry Skills to Add
                </h3>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {curriculumReview.missing_industry_skills.map((s, i) => (
                    <span key={i} className="rounded-md bg-white border border-emerald/30 px-2 py-0.5 font-medium text-navy">
                      + {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Recommended Modern Modules */}
            <div className="rounded-lg border border-lightgray bg-white/90 p-4">
              <h3 className="flex items-center gap-2 text-xs font-bold text-navy">
                <Layers className="h-4 w-4 text-slate" /> Recommended Modern Syllabus Modules
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {curriculumReview.modern_modules.map((m, i) => (
                  <div key={i} className="rounded-md border border-lightgray/80 bg-surface/50 p-3 text-xs">
                    <p className="font-semibold text-navy">{m.module_title}</p>
                    <p className="mt-1 text-mediumgray leading-relaxed">{m.industry_relevance}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.key_topics.map((topic, ti) => (
                        <span key={ti} className="rounded bg-white border border-lightgray px-1.5 py-0.5 text-[10px] text-navy">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hands-On Lab Projects */}
            <div className="rounded-lg border border-lightgray bg-white/90 p-4">
              <h3 className="flex items-center gap-2 text-xs font-bold text-navy">
                <Code2 className="h-4 w-4 text-orange" /> Recommended Practical Lab Projects
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {curriculumReview.practical_lab_projects.map((p, i) => (
                  <div key={i} className="rounded-md border border-lightgray/80 bg-surface/50 p-3 text-xs">
                    <p className="font-semibold text-navy">{p.title}</p>
                    <p className="mt-1 text-mediumgray leading-relaxed">{p.description}</p>
                    <p className="mt-2 text-[10px] text-slate font-medium">Tools: {p.tools_used.join(", ")}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Department Skills vs Industry Openings */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-navy">Department Skill Coverage</h2>
              <p className="text-[11px] text-mediumgray">Verified skills earned by students in your department</p>
            </div>
            <ShieldCheck className="h-4 w-4 text-slate" />
          </div>
          <ul className="space-y-3">
            {data.departmentSkills.length === 0 && <li className="text-xs text-mediumgray">No skills verified yet.</li>}
            {data.departmentSkills.map((s) => (
              <li key={s.skill}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-navy">{s.skill}</span>
                  <span className="text-mediumgray">{s.verifiedCount} students ({s.coverage}%)</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-lightgray">
                  <div className="h-full rounded-r-[4px] bg-slate" style={{ width: `${Math.max(4, s.coverage)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Live Industry Demand */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-navy">Live Industry Demand</h2>
              <p className="text-[11px] text-mediumgray">Top skills asked in active job postings</p>
            </div>
            <TrendingUp className="h-4 w-4 text-emerald" />
          </div>
          <ul className="space-y-3">
            {data.marketDemand.length === 0 && <li className="text-xs text-mediumgray">No active openings found.</li>}
            {data.marketDemand.map((m) => (
              <li key={m.skill}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-navy">{m.skill}</span>
                  <span className="text-mediumgray">{m.openings} active openings</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-lightgray">
                  <div
                    className="h-full rounded-r-[4px] bg-emerald"
                    style={{ width: `${Math.min(100, m.openings * 15)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Recent Student Cohort Table */}
      <Card>
        <div className="flex items-center justify-between border-b border-lightgray px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-navy">Department Students Cohort</h2>
            <p className="text-[11px] text-mediumgray">Real-time placement readiness & verified skills</p>
          </div>
          <Link href="/faculty/dashboard" className="text-xs font-semibold text-slate hover:underline">
            View All ({data.kpis.departmentStudents})
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-lightgray text-left text-[11px] uppercase tracking-wider text-mediumgray">
                <th className="px-5 py-2.5 font-semibold">Student</th>
                <th className="px-5 py-2.5 font-semibold">Target Career Role</th>
                <th className="px-5 py-2.5 font-semibold">Placement Readiness</th>
                <th className="px-5 py-2.5 font-semibold">Verified Skills</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lightgray">
              {data.recentStudentActivity.map((s) => (
                <tr key={s.studentId} className="hover:bg-surface-2">
                  <td className="px-5 py-2.5 font-medium text-navy">
                    <a href={`/p/${s.studentId}`} target="_blank" rel="noreferrer" className="hover:underline hover:text-slate">
                      {s.name}
                    </a>
                  </td>
                  <td className="px-5 py-2.5 text-mediumgray">{s.targetRole}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-lightgray">
                        <div className="h-full rounded-r-[4px] bg-slate" style={{ width: `${s.readiness}%` }} />
                      </div>
                      <span className="font-semibold text-navy">{s.readiness}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-2.5 font-semibold text-navy">{s.verifiedSkills}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

