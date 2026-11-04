"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Briefcase,
  Calendar,
  ChevronRight,
  ClipboardCheck,
  Code2,
  FileText,
  LoaderCircle,
  type LucideIcon,
  Mic,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import DashboardShell, { DashboardContainer } from "./DashboardShell";
import { Card } from "./ui";
import { useStudent } from "./StudentContext";
import type { AiRoadmapSummary } from "@/lib/ai/roadmap";
import type { PaperSummary } from "@/lib/ai/papers-shared";
import type { DashboardData } from "@/lib/db/student-data";
import type { StudentAdvisorResponse } from "@/lib/agent/types";

/** AI Agent results and job actions, loaded next to `DashboardData` by the page. */
export interface DashboardAiData {
  roadmaps: AiRoadmapSummary[];
  roadmapCount: number;
  /** AI tests / interviews generated but not yet submitted. */
  openPapers: PaperSummary[];
  lastGraded: PaperSummary | null;
  /** Skills the coding-profile analysis found; null = never analysed. */
  codingSkills: number | null;
  /** Already formatted on the server, e.g. "21 Oct". */
  codingAnalyzedAt: string | null;
  applications: number;
  saved: number;
}

const paperLabel = (p: PaperSummary) => (p.purpose === "interview" ? `${p.subject} interview` : `${p.subject} test`);

function matchTone(match: number): string {
  if (match >= 90) return "bg-emerald/10 text-emerald";
  if (match >= 80) return "bg-slate/10 text-slate";
  return "bg-gold/10 text-[#b45309]";
}

const STAT_META: { Icon: LucideIcon; chip: string }[] = [
  { Icon: Target, chip: "bg-slate/10 text-slate" },
  { Icon: FileText, chip: "bg-emerald/10 text-emerald" },
  { Icon: Mic, chip: "bg-gold/15 text-[#b45309]" },
  { Icon: Briefcase, chip: "bg-orange/10 text-orange" },
];

function SectionHead({
  title,
  action,
  href,
}: {
  title: string;
  action?: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-navy/[0.06] px-5 py-3.5">
      <h2 className="text-sm font-semibold text-navy">{title}</h2>
      {action && href && (
        <Link
          href={href}
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate transition-colors hover:text-[#c2410c]"
        >
          {action}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

interface NextStep {
  title: string;
  desc: string;
  action: string;
  href: string;
  progress?: number;
}

/** Builds a "what to do next" list from what the student is still missing. */
function buildNextSteps(data: DashboardData, ai: DashboardAiData): NextStep[] {
  const steps: NextStep[] = [];
  // An AI paper already generated is waiting on the student — finish it first.
  const open = ai.openPapers[0];
  if (open) {
    steps.push({
      title: open.status === "in-progress" ? `Finish your ${paperLabel(open)}` : `Take your ${paperLabel(open)}`,
      desc: `${open.questionCount} questions · about ${open.minutes} min`,
      action: open.status === "in-progress" ? "Resume" : "Start",
      href: `/student/assessment/ai/${open.id}`,
    });
  }
  if (!data.assessmentDone) {
    steps.push({
      title: "Complete your skill assessment",
      desc: "Rate industry skills, then verify them with skill tests",
      action: "Start",
      href: "/student/assessment",
      progress: 0,
    });
  } else if (data.verifiedSkills === 0) {
    steps.push({
      title: "Verify your first skill",
      desc: "Pass a skill test so it counts on your resume and in matching",
      action: "Take test",
      href: "/student/assessment",
      progress: 30,
    });
  }
  if (!data.hasResume) {
    steps.push({
      title: "Build your resume",
      desc: "Import your verified skills and projects in one click",
      action: "Start",
      href: "/student/resume",
      progress: 0,
    });
  }
  if (ai.roadmapCount === 0) {
    steps.push({
      title: "Generate an AI roadmap",
      desc: "Pick a skill and get a week-by-week syllabus of what you're missing",
      action: "Generate",
      href: "/student/roadmap",
    });
  }
  if (ai.codingSkills === null) {
    steps.push({
      title: "Analyse your coding profile",
      desc: "Connect GitHub or LeetCode so AI can show the skills your work proves",
      action: "Analyse",
      href: "/student/analysis",
    });
  }
  if (data.interviewsCompleted < 3) {
    steps.push({
      title: "Take a mock interview",
      desc: "Practice with instant AI feedback",
      action: "Start",
      href: "/student/interviews",
    });
  }
  if (data.skills.length < 5) {
    steps.push({
      title: "Add more skills",
      desc: "Boost your match score with employers",
      action: "Add skills",
      href: "/student/profile",
    });
  }
  if (data.readiness < 100) {
    steps.push({
      title: "Improve your job readiness",
      desc: `You're at ${data.readiness}% — keep building`,
      action: "View",
      href: "/student/progress",
      progress: data.readiness,
    });
  }
  return steps.slice(0, 4);
}

export default function StudentDashboard({
  data: initialData,
  ai: initialAi,
}: {
  data: DashboardData;
  ai: DashboardAiData;
}) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [ai, setAi] = useState<DashboardAiData>(initialAi);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // AI Placement & Career Advisor
  const [advisorReport, setAdvisorReport] = useState<StudentAdvisorResponse | null>(
    initialData.latestAdvisorReport || null,
  );
  const [advising, setAdvising] = useState(false);
  const [advisorError, setAdvisorError] = useState("");

  const refreshLive = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/student/dashboard");
      if (res.ok) {
        const json = await res.json();
        if (json.data) setData(json.data);
        if (json.ai) setAi(json.ai);
        if (json.advisorReport) setAdvisorReport(json.advisorReport);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error("Live student dashboard refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const runAdvisor = async () => {
    setAdvising(true);
    setAdvisorError("");
    try {
      const res = await fetch("/api/student/ai/advisor", { method: "POST" });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          res.status === 404
            ? "Advisor service endpoint not found."
            : `Advisor server response error (${res.status}). Please ensure the AI Agent is running on port 8080.`,
        );
      }
      const json = await res.json();
      if (!res.ok || !json.report) {
        throw new Error(json.error || "Failed to generate AI placement strategy.");
      }
      setAdvisorReport(json.report);
    } catch (err) {
      setAdvisorError(err instanceof Error ? err.message : "AI advisor is currently unavailable.");
    } finally {
      setAdvising(false);
    }
  };

  const student = useStudent();
  const subtitle = [student.title, student.location].filter(Boolean).join(" · ");
  const nextSteps = buildNextSteps(data, ai);

  const stats = [
    {
      label: "Job Readiness",
      value: `${data.readiness}%`,
      sub: data.readiness > 0 ? "Keep it up" : "Get started",
      trend: data.readiness > 0 ? "up" : "neutral",
    },
    {
      label: "ATS Resume Score",
      value: data.atsScore != null ? String(data.atsScore) : "—",
      sub: data.atsScore != null ? "out of 100" : "No resume yet",
      trend: "neutral",
    },
    {
      label: "Mock Interviews",
      value: `${data.interviewsCompleted} / 10`,
      sub: data.interviewsCompleted ? `Avg score ${data.interviewsAverage}%` : "Not started",
      trend: data.interviewsCompleted ? "up" : "neutral",
    },
    {
      label: "Job Matches",
      value: String(data.newMatches),
      sub:
        ai.applications || ai.saved
          ? `${ai.applications} applied · ${ai.saved} saved`
          : data.newMatches
            ? "View all matches"
            : "Complete profile",
      trend: "neutral",
    },
  ] as const;

  const workspace: { Icon: LucideIcon; chip: string; title: string; desc: string; action: string; href: string }[] = [
    ai.roadmaps[0]
      ? {
          Icon: Sparkles,
          chip: "bg-orange/10 text-orange",
          title: `${ai.roadmapCount} AI roadmap${ai.roadmapCount === 1 ? "" : "s"}`,
          desc: `Latest: ${ai.roadmaps[0].skill} · ${ai.roadmaps[0].steps} steps · about ${ai.roadmaps[0].totalWeeks} weeks`,
          action: "Open",
          href: `/student/roadmap/${ai.roadmaps[0].id}`,
        }
      : {
          Icon: Sparkles,
          chip: "bg-orange/10 text-orange",
          title: "AI roadmaps",
          desc: "No roadmap yet — generate a syllabus for any skill",
          action: "Generate",
          href: "/student/roadmap",
        },
    ai.openPapers[0]
      ? {
          Icon: ClipboardCheck,
          chip: "bg-slate/10 text-slate",
          title: `${ai.openPapers.length} AI test${ai.openPapers.length === 1 ? "" : "s"} waiting`,
          desc: `Next: ${paperLabel(ai.openPapers[0])} · ${ai.openPapers[0].questionCount} questions`,
          action: ai.openPapers[0].status === "in-progress" ? "Resume" : "Start",
          href: `/student/assessment/ai/${ai.openPapers[0].id}`,
        }
      : {
          Icon: ClipboardCheck,
          chip: "bg-slate/10 text-slate",
          title: "AI tests",
          desc:
            ai.lastGraded?.percent != null
              ? `Last: ${paperLabel(ai.lastGraded)} · ${ai.lastGraded.percent}%${ai.lastGraded.passed ? " · passed" : ""}`
              : "Verify a skill with an AI-written test",
          action: "New test",
          href: "/student/assessment",
        },
    {
      Icon: Code2,
      chip: "bg-emerald/10 text-emerald",
      title: "Coding profile",
      desc:
        ai.codingSkills === null
          ? "Not analysed — connect GitHub or LeetCode"
          : `${ai.codingSkills} skill${ai.codingSkills === 1 ? "" : "s"} proven by your code${ai.codingAnalyzedAt ? ` · updated ${ai.codingAnalyzedAt}` : ""}`,
      action: ai.codingSkills === null ? "Analyse" : "View",
      href: "/student/analysis",
    },
  ];

  return (
    <DashboardShell>
      <DashboardContainer className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-[1.75rem] font-bold tracking-[-0.02em] text-navy">
              Welcome back, {student.firstName}
            </h1>
            {subtitle && <p className="mt-1 text-sm text-mediumgray">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshLive}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-navy/15 bg-white px-3 py-2 text-xs font-semibold text-navy shadow-xs transition hover:bg-surface disabled:opacity-50"
              title="Fetch latest verified skills, test results, and live job postings from database"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-orange" : "text-slate"}`} />
              {refreshing ? "Syncing..." : "Live Refresh"}
              <span className="ml-1 text-[10px] font-normal text-mediumgray">
                ({lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })})
              </span>
            </button>
            <Link
              href="/student/roadmap"
              data-tour="dashboard-roadmap"
              className="group inline-flex items-center justify-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#1f2937]"
            >
              Open my roadmap
              <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* Stat tiles */}
        <div data-tour="dashboard-stats" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s, i) => {
            const meta = STAT_META[i];
            return (
              <Card key={s.label} className="p-5 transition-shadow duration-200 hover:shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-medium text-mediumgray">{s.label}</p>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.chip}`}>
                    <meta.Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="font-display mt-3 text-[1.75rem] font-bold leading-none tracking-tight text-navy tabular">
                  {s.value}
                </p>
                <p
                  className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${
                    s.trend === "up" ? "text-emerald" : "text-mediumgray"
                  }`}
                >
                  {s.trend === "up" && <TrendingUp className="h-3.5 w-3.5" />}
                  {s.sub}
                </p>
              </Card>
            );
          })}
        </div>

        {/* AI Career & Placement Advisor Banner */}
        <Card className="overflow-hidden border-orange/20 shadow-xs">
          <div className="flex flex-col gap-3 border-b border-navy/[0.06] bg-gradient-to-r from-orange/5 via-surface to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange/15 text-orange">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-navy">AI Placement & Career Advisor</h2>
                  {advisorReport?.readiness_badge && (
                    <span className="rounded-full bg-emerald/10 px-2 py-0.5 text-[10px] font-bold text-emerald">
                      {advisorReport.readiness_badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-mediumgray">
                  Real-time placement intelligence analyzing your verified skills against active industry job openings
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={runAdvisor}
              disabled={advising}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-navy px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:bg-slate disabled:opacity-50"
            >
              {advising ? (
                <>
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Analyzing with AI...
                </>
              ) : advisorReport ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-orange" />
                  Re-evaluate Strategy
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-orange" />
                  Get AI Career Advice
                </>
              )}
            </button>
          </div>

          {advisorError && (
            <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{advisorError}</span>
            </div>
          )}

          {!advisorReport && !advising && (
            <div className="px-5 py-6 text-center">
              <p className="text-xs text-mediumgray">
                Click <strong>Get AI Career Advice</strong> to analyze your skills, test scores, and ATS resume against
                current hiring trends to generate a personalized placement roadmap.
              </p>
            </div>
          )}

          {advisorReport && (
            <div className="space-y-4 p-5">
              <p className="text-xs leading-relaxed text-navy">{advisorReport.summary}</p>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Top Strengths */}
                <div className="rounded-lg border border-navy/[0.06] bg-surface/50 p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-navy">
                    <ShieldCheck className="h-4 w-4 text-emerald" />
                    <span>Competitive Strengths</span>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {advisorReport.top_strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-xs text-mediumgray">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald" />
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Critical Gaps */}
                <div className="rounded-lg border border-navy/[0.06] bg-surface/50 p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-navy">
                    <AlertTriangle className="h-4 w-4 text-orange" />
                    <span>Critical Skill Gaps for Open Jobs</span>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {advisorReport.critical_gaps.map((gap, idx) => (
                      <li key={idx} className="text-xs text-mediumgray">
                        <div className="font-medium text-navy">
                          {gap.skill}{" "}
                          <span
                            className={`text-[10px] font-semibold ${gap.importance === "High" ? "text-orange" : "text-slate"}`}
                          >
                            ({gap.importance} priority)
                          </span>
                        </div>
                        <p className="text-[11px] text-mediumgray">{gap.reason}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Immediate 1-2-3 Actions */}
              <div>
                <h3 className="text-xs font-semibold text-navy">Prioritized Action Plan</h3>
                <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {advisorReport.immediate_actions.map((act) => (
                    <div key={act.priority} className="rounded-lg border border-navy/[0.06] bg-white p-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">
                          {act.priority}
                        </span>
                        <span className="rounded-md bg-surface px-1.5 py-0.5 text-[9px] font-semibold text-slate">
                          {act.category}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-navy">{act.title}</p>
                      <p className="mt-1 text-[11px] leading-tight text-mediumgray">{act.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {advisorReport.motivation && (
                <div className="rounded-md border border-navy/[0.06] bg-surface/30 px-3 py-2 text-center text-[11px] italic text-mediumgray">
                  &ldquo;{advisorReport.motivation}&rdquo;
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Next steps */}
            <Card data-tour="dashboard-next-steps">
              <SectionHead title="Your next steps" />
              {nextSteps.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-mediumgray">
                  You&apos;re all caught up — nothing is waiting on you.
                </p>
              ) : (
                <ul className="divide-y divide-navy/[0.06]">
                  {nextSteps.map((step) => (
                    <li key={step.title} className="flex items-center gap-4 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-navy">{step.title}</p>
                        <p className="mt-0.5 text-xs text-mediumgray">{step.desc}</p>
                        {typeof step.progress === "number" && (
                          <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-lightgray">
                            <div className="h-full rounded-full bg-slate" style={{ width: `${step.progress}%` }} />
                          </div>
                        )}
                      </div>
                      <Link
                        href={step.href}
                        className="shrink-0 rounded-lg border border-navy/15 px-3.5 py-2 text-xs font-semibold text-navy transition-colors duration-200 hover:border-orange hover:text-orange"
                      >
                        {step.action}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* AI workspace */}
            <Card data-tour="dashboard-ai">
              <SectionHead title="AI workspace" action="Career analysis" href="/student/analysis" />
              <ul className="divide-y divide-navy/[0.06]">
                {workspace.map((w) => (
                  <li key={w.title} className="flex items-center gap-4 px-5 py-4">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${w.chip}`}>
                      <w.Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-navy">{w.title}</p>
                      <p className="mt-0.5 truncate text-xs text-mediumgray">{w.desc}</p>
                    </div>
                    <Link
                      href={w.href}
                      className="shrink-0 rounded-lg border border-navy/15 px-3.5 py-2 text-xs font-semibold text-navy transition-colors duration-200 hover:border-orange hover:text-orange"
                    >
                      {w.action}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Job matches */}
            <Card data-tour="dashboard-jobs">
              <SectionHead title="Top job matches" action="View all" href="/student/jobs" />
              {data.jobs.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-mediumgray">
                  No matches yet — complete your resume to get matched with roles.
                </p>
              ) : (
                <ul className="divide-y divide-navy/[0.06]">
                  {data.jobs.map((job) => (
                    <li key={job.id}>
                      <Link
                        href="/student/jobs"
                        className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-sm font-bold text-navy">
                          {job.company.charAt(0)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-navy">{job.role}</p>
                          <p className="mt-0.5 truncate text-xs text-mediumgray">
                            {job.company} · {job.location} · {job.salary}
                          </p>
                        </div>
                        <span
                          className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular sm:inline-block ${matchTone(job.match)}`}
                        >
                          {job.match}% match
                        </span>
                        <span className="hidden w-16 shrink-0 text-right text-xs text-mediumgray md:block">
                          {job.posted}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-mediumgray" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Profile completion */}
            <Card data-tour="dashboard-profile" className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-navy">Profile completion</h2>
                <span className="text-sm font-bold text-orange tabular">{data.readiness}%</span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-lightgray">
                <div className="h-full rounded-full bg-slate" style={{ width: `${data.readiness}%` }} />
              </div>
              <p className="mt-3 text-xs text-mediumgray">
                Complete your resume and add skills to reach 100% and unlock priority matching.
              </p>
            </Card>

            {/* Upcoming */}
            <Card data-tour="dashboard-upcoming">
              <SectionHead title="Upcoming" />
              {data.upcoming.length === 0 ? (
                <p className="px-5 py-6 text-center text-xs text-mediumgray">Nothing scheduled yet.</p>
              ) : (
                <ul className="divide-y divide-navy/[0.06]">
                  {data.upcoming.map((item) => (
                    <li key={item.title} className="flex items-start gap-3 px-5 py-3.5">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate/10 text-slate">
                        <Calendar className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy">{item.title}</p>
                        <p className="mt-0.5 text-xs text-mediumgray">{item.when}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Skills */}
            <Card data-tour="dashboard-skills" className="p-5">
              <h2 className="text-sm font-semibold text-navy">Your skills</h2>
              {data.skills.length === 0 ? (
                <p className="mt-3 text-xs text-mediumgray">
                  Take a{" "}
                  <Link href="/student/assessment" className="font-semibold text-slate">
                    skill assessment
                  </Link>{" "}
                  to earn verified skills here.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {data.skills.map((skill) => (
                    <li key={skill.name}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1 font-medium text-navy">
                          {skill.name}
                          {skill.verified && <BadgeCheck className="h-3.5 w-3.5 text-emerald" aria-label="Verified" />}
                        </span>
                        <span className="text-mediumgray tabular">{skill.level}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-lightgray">
                        <div className="h-full rounded-full bg-navy" style={{ width: `${skill.level}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Recent activity */}
            <Card data-tour="dashboard-activity">
              <SectionHead title="Recent activity" />
              {data.activity.length === 0 ? (
                <p className="px-5 py-6 text-center text-xs text-mediumgray">Your recent activity will appear here.</p>
              ) : (
                <ul className="px-5 py-2">
                  {data.activity.map((a, i) => (
                    <li key={i} className="flex gap-3 py-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate" />
                      <div>
                        <p className="text-sm text-navy">{a.text}</p>
                        <p className="text-xs text-mediumgray">{a.time}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </DashboardContainer>
    </DashboardShell>
  );
}
