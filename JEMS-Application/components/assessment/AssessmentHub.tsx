"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  ClipboardList,
  LoaderCircle,
  Lock,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import TaskStatus from "@/components/ai/TaskStatus";
import DashboardShell, { DashboardContainer } from "@/components/dashboard/student/DashboardShell";
import { Card } from "@/components/dashboard/student/ui";
import type { PaperSummary } from "@/lib/ai/papers-shared";
import { isActive } from "@/lib/ai-tasks/types";
import { startAiTask, useAiTasks } from "@/lib/ai-tasks/use-tasks";
import { LIKERT, SELF_RATINGS, SITUATIONAL } from "@/lib/assessment/engine";
import type { AssessmentState } from "@/lib/db/assessment";

const norm = (s: string) => s.trim().toLowerCase();

export default function AssessmentHub({
  state: initialLiveState,
  papers: initialLivePapers,
  take,
}: {
  state: AssessmentState;
  papers: PaperSummary[];
  /** A skill another page asked the student to test (`?take=`), shown as a call-out. */
  take?: string;
}) {
  const [state, setState] = useState<AssessmentState>(initialLiveState);
  const [papers, setPapers] = useState<PaperSummary[]>(initialLivePapers);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(!state.questionnaireAt);

  // Dynamic refresh from API
  const refreshDynamicState = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/student/assessment", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setState(data.state);
        if (data.papers) setPapers(data.papers);
      }
    } catch (e) {
      console.error("Failed to dynamically refresh assessment:", e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const ai = useAiTests(papers, refreshDynamicState);
  const verified = state.skills.filter((s) => s.verified);
  const claimed = state.skills.filter((s) => !s.verified);
  const step = !state.questionnaireAt ? 1 : verified.length === 0 ? 2 : 3;

  return (
    <DashboardShell>
      <DashboardContainer className="space-y-6">
        {/* Header with Dynamic Refresh */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate/10 px-2.5 py-1 text-xs font-semibold text-slate">
              <ShieldCheck className="h-3.5 w-3.5" /> Skill assessment
            </span>
            <h1 className="mt-3 text-2xl font-bold text-navy">Assess first, then it counts</h1>
            <p className="mt-1 max-w-2xl text-sm text-mediumgray">
              Industry skills verified with tests appear on your resume, portfolio, and company matches.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start">
            <button
              type="button"
              onClick={refreshDynamicState}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-lightgray bg-white px-3.5 py-2 text-xs font-semibold text-navy transition-colors hover:border-slate hover:text-slate disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-slate" : ""}`} />
              {refreshing ? "Updating…" : "Refresh State"}
            </button>
          </div>
        </div>

        {/* Steps Tracker */}
        <div data-tour="assessment-steps" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { n: 1, title: "Questionnaire", desc: "Self-rate skills & soft skills", icon: ClipboardList, done: !!state.questionnaireAt },
            { n: 2, title: "Skill tests", desc: "Verify skills via tests & quizzes", icon: Timer, done: verified.length > 0 },
            { n: 3, title: "Verified profile", desc: "Powers ATS resume & job matching", icon: BadgeCheck, done: verified.length > 0 && claimed.length === 0 },
          ].map((s) => (
            <div
              key={s.n}
              className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${
                step === s.n
                  ? "border-slate bg-slate/5"
                  : s.done
                    ? "border-emerald/30 bg-emerald/5"
                    : "border-lightgray bg-white"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  s.done
                    ? "bg-emerald/10 text-emerald"
                    : step === s.n
                      ? "bg-slate/10 text-slate"
                      : "bg-surface text-mediumgray"
                }`}
              >
                {s.done ? <CircleCheck className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
              </span>
              <span>
                <span className="block text-sm font-semibold text-navy">
                  {s.n}. {s.title}
                </span>
                <span className="text-[11px] text-mediumgray">{s.desc}</span>
              </span>
            </div>
          ))}
        </div>

        {take && !editing && (
          <Card className="flex flex-col gap-3 border-orange/30 bg-orange/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-navy">
              Verify <strong>{take}</strong> with a fresh AI test — pass 70% and it shows as verified on your resume and job matches.
            </p>
            <AiTestAction ai={ai} skill={take} />
          </Card>
        )}

        {editing ? (
          <Questionnaire
            state={state}
            onSaved={() => {
              setEditing(false);
              refreshDynamicState();
            }}
            onCancel={state.questionnaireAt ? () => setEditing(false) : undefined}
          />
        ) : (
          <>
            {/* Skills & Verification Grid */}
            <Card data-tour="assessment-skills">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-lightgray px-5 py-3.5">
                <div>
                  <h2 className="text-sm font-semibold text-navy">Your Skills Verification Hub</h2>
                  <p className="text-[11px] text-mediumgray">
                    {verified.length} verified · {claimed.length} claimed, awaiting a test
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate hover:underline"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit questionnaire
                </button>
              </div>

              <ul className="divide-y divide-lightgray">
                {state.skills.length === 0 && (
                  <li className="px-5 py-8 text-center text-sm text-mediumgray">
                    No skills claimed yet. Click &quot;Edit questionnaire&quot; to begin.
                  </li>
                )}
                {[...verified, ...claimed].map((s) => {
                  const cat = state.catalogue.find((c) => norm(c.name) === norm(s.name));
                  const result = state.results.find((r) => norm(r.skill) === norm(s.name) || norm(r.skill) === norm(cat?.name ?? ""));
                  const locked = result?.lockedUntil && new Date(result.lockedUntil) > new Date();

                  return (
                    <li key={s.name} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          s.verified ? "bg-emerald/10 text-emerald" : "bg-surface text-mediumgray"
                        }`}
                      >
                        {s.verified ? <BadgeCheck className="h-5 w-5" /> : <CircleDashed className="h-5 w-5" />}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-navy">{s.name}</span>
                          {s.verified ? (
                            <span className="rounded-full bg-emerald/10 px-2.5 py-0.5 text-xs font-semibold text-emerald">
                              Verified
                            </span>
                          ) : (
                            <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-mediumgray">
                              Claimed ({s.level}%)
                            </span>
                          )}
                          {cat && cat.demand > 0 && (
                            <span className="text-xs text-mediumgray">· {cat.demand} open job{cat.demand === 1 ? "" : "s"} ask for it</span>
                          )}
                        </div>

                        {result && (
                          <p className="mt-1 text-xs text-mediumgray">
                            Last test score:{" "}
                            <span className={`font-semibold ${result.passed ? "text-emerald" : "text-amber-600"}`}>
                              {result.score}%
                            </span>{" "}
                            {locked ? "(locked for 24 hours)" : ""}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {s.verified ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald">
                            <Check className="h-4 w-4" /> Ready for Resume
                          </span>
                        ) : locked ? (
                          <span className="inline-flex items-center gap-1 text-xs text-mediumgray">
                            <Lock className="h-3.5 w-3.5" /> Cooldown
                          </span>
                        ) : (
                          <AiTestAction ai={ai} skill={s.name} />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>

            {/* AI Generated Tests Card */}
            <AiTestsCard ai={ai} papers={papers} />
          </>
        )}
      </DashboardContainer>
    </DashboardShell>
  );
}

// ── AI tests helper ─────────────────────────────────────────────

function useAiTests(papers: PaperSummary[], onRefresh: () => void) {
  const router = useRouter();
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const tasks = useAiTasks(["assessment.generate", "assessment.grade"], {
    onSettled: () => {
      onRefresh();
      router.refresh();
    },
  });

  const paperFor = (skill: string) =>
    papers.find((p) => p.purpose === "skill" && norm(p.subject) === norm(skill)) ?? null;

  const start = async (skill: string) => {
    setError("");
    setStarting(skill);
    try {
      tasks.track(await startAiTask("/api/student/ai/papers", { purpose: "skill", skill }));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the AI test.");
      return false;
    } finally {
      setStarting(null);
    }
  };

  return { ...tasks, paperFor, start, starting, error };
}

type AiTests = ReturnType<typeof useAiTests>;

/**
 * The single "Take test" action per skill. Every click generates a brand-new
 * AI test (the agent is told which questions this student has already seen),
 * so a retake never repeats the last paper. While a generated paper is
 * waiting or half-done, the same button opens it instead.
 */
function AiTestAction({ ai, skill }: { ai: AiTests; skill: string }) {
  const task = ai.latestFor(skill, "assessment.generate");
  const paper = ai.paperFor(skill);
  const cls =
    "inline-flex items-center gap-1.5 rounded-lg bg-primary-gradient px-3.5 py-2 text-xs font-semibold text-white shadow-[0_4px_12px_rgba(234,88,12,0.25)] transition-transform hover:-translate-y-0.5 disabled:opacity-60";

  if ((task && isActive(task.status)) || ai.starting === skill) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-lightgray px-3.5 py-2 text-xs font-semibold text-mediumgray">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Generating your test…
      </span>
    );
  }
  if (paper && (paper.status === "ready" || paper.status === "in-progress")) {
    return (
      <Link href={`/student/assessment/ai/${paper.id}`} className={cls}>
        <Sparkles className="h-3.5 w-3.5" /> {paper.status === "ready" ? "Start test" : "Continue test"}
      </Link>
    );
  }
  if (paper?.status === "submitted") {
    return (
      <Link href={`/student/assessment/ai/${paper.id}`} className={cls}>
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Grading…
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => ai.start(skill)} className={cls}>
      <Sparkles className="h-3.5 w-3.5" /> Take test
    </button>
  );
}

const PAPER_STATUS: Record<PaperSummary["status"], { label: string; tone: string }> = {
  ready: { label: "Ready to start", tone: "bg-slate/10 text-slate" },
  "in-progress": { label: "In progress", tone: "bg-gold/15 text-amber-700" },
  submitted: { label: "Grading…", tone: "bg-slate/10 text-slate" },
  graded: { label: "Graded", tone: "bg-emerald/10 text-emerald" },
};

function AiTestsCard({ ai, papers }: { ai: AiTests; papers: PaperSummary[] }) {
  const [skill, setSkill] = useState("");
  const skillPapers = papers.filter((p) => p.purpose === "skill");
  const generating = ai.tasks.filter(
    (t) =>
      t.type === "assessment.generate" &&
      (isActive(t.status) || (t.status === "failed" && ai.latestFor(t.subject, "assessment.generate")?.id === t.id)),
  );

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-lightgray px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
            <Sparkles className="h-4 w-4 text-slate" /> AI-generated comprehensive tests
          </h2>
          <p className="text-[11px] text-mediumgray">
            Every test is freshly written by AI — new questions each time — with multiple choice, written answers and code. Pass 70% to verify.
          </p>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (skill.trim() && (await ai.start(skill.trim()))) setSkill("");
          }}
          className="flex gap-2"
        >
          <input
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            maxLength={80}
            placeholder="Type any skill (e.g. Docker, Python)"
            className="h-9 w-full rounded-lg border border-lightgray px-3 text-sm text-navy outline-none focus:border-slate sm:w-56"
          />
          <button
            type="submit"
            disabled={!skill.trim() || !!ai.starting}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-navy px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#1f2937] disabled:opacity-60"
          >
            Take test
          </button>
        </form>
      </div>
      {(ai.error || generating.length > 0) && (
        <div className="space-y-2 border-b border-lightgray px-5 py-3">
          {ai.error && <p className="text-sm text-red-600">{ai.error}</p>}
          {generating.map((t) => (
            <TaskStatus key={t.id} task={t} />
          ))}
        </div>
      )}
      <ul className="divide-y divide-lightgray">
        {skillPapers.length === 0 && (
          <li className="px-5 py-6 text-sm text-mediumgray">
            No custom AI tests taken yet. Type any skill above or select a skill from your profile.
          </li>
        )}
        {skillPapers.map((p) => (
          <li key={p.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-navy">{p.subject}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PAPER_STATUS[p.status].tone}`}>
                  {PAPER_STATUS[p.status].label}
                </span>
                {p.percent != null && (
                  <span className={`text-xs font-semibold ${p.passed ? "text-emerald" : "text-amber-600"}`}>
                    {p.percent}%{p.pendingReview ? " · review pending" : ""}
                  </span>
                )}
              </span>
              <span className="text-[11px] text-mediumgray">
                {p.questionCount} questions · {p.minutes} min
              </span>
            </span>
            <Link
              href={`/student/assessment/ai/${p.id}`}
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate hover:underline"
            >
              {p.status === "graded" ? "View results" : p.status === "ready" ? "Start" : "Open"}{" "}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── REDESIGNED CLEAN MULTI-STEP QUESTIONNAIRE ───────────────────

function Questionnaire({
  state,
  onSaved,
  onCancel,
}: {
  state: AssessmentState;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Every skill the student can rate: the live catalogue plus anything they
  // already claimed or added themselves that the catalogue doesn't list.
  const [custom, setCustom] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const allSkills = useMemo(() => {
    const known = new Set(state.catalogue.map((c) => norm(c.name)));
    const extra = [...state.skills.map((s) => s.name), ...custom]
      .filter((n) => !known.has(norm(n)) && (known.add(norm(n)), true))
      .map((name) => ({ name, demand: 0, testable: false, moduleId: null, moduleTitle: null }));
    return [...state.catalogue, ...extra];
  }, [state.catalogue, state.skills, custom]);

  const initialRatings = useMemo(() => {
    // Key ratings by the catalogue's spelling so "react" on the profile lights up "React".
    const byKey = new Map(state.catalogue.map((c) => [norm(c.name), c.name]));
    const r: Record<string, number> = {};
    for (const s of state.skills) {
      if (s.verified) continue;
      r[byKey.get(norm(s.name)) ?? s.name] = s.level >= 75 ? 4 : s.level >= 60 ? 3 : s.level >= 45 ? 2 : 1;
    }
    return r;
  }, [state.skills, state.catalogue]);

  const [ratings, setRatings] = useState<Record<string, number>>(initialRatings);
  const [likert, setLikert] = useState<Record<string, number>>(state.answers?.likert ?? {});
  const [situational, setSituational] = useState<Record<string, number>>(state.answers?.situational ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const verifiedNames = useMemo(
    () => new Set(state.skills.filter((s) => s.verified).map((s) => norm(s.name))),
    [state.skills]
  );

  // Filter skills
  const catalogue = useMemo(() => {
    return allSkills.filter((c) => {
      const matchesSearch = !filter || norm(c.name).includes(norm(filter));
      if (!matchesSearch) return false;
      if (categoryFilter === "claimed") return !!ratings[c.name];
      if (categoryFilter === "verified") return verifiedNames.has(norm(c.name));
      return true;
    });
  }, [allSkills, filter, categoryFilter, ratings, verifiedNames]);

  const addCustomSkill = () => {
    const name = newSkill.trim().slice(0, 40);
    if (!name) return;
    const existing = allSkills.find((c) => norm(c.name) === norm(name));
    if (!existing) setCustom((c) => [...c, name]);
    const key = existing?.name ?? name;
    if (!verifiedNames.has(norm(key))) setRatings((r) => ({ ...r, [key]: r[key] ?? 2 }));
    setNewSkill("");
    setFilter("");
  };

  const completeLikert = LIKERT.every((l) => likert[l.id] != null);
  const completeSituational = SITUATIONAL.every((s) => situational[s.id] != null);
  const claimedCount = Object.values(ratings).filter((v) => v >= 1).length;
  const isAllComplete = completeLikert && completeSituational && claimedCount > 0;
  const missing = [
    claimedCount === 0 && "rate at least one technical skill",
    !completeLikert && `answer ${LIKERT.length - LIKERT.filter((l) => likert[l.id] != null).length} more soft-skill statement(s)`,
    !completeSituational && `answer ${SITUATIONAL.length - SITUATIONAL.filter((x) => situational[x.id] != null).length} more scenario(s)`,
  ].filter(Boolean) as string[];

  const toggleRating = (name: string, value: number) => {
    setRatings((prev) => {
      if (prev[name] === value) {
        const next = { ...prev };
        delete next[name];
        return next;
      }
      return { ...prev, [name]: value };
    });
  };

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAllComplete) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/student/assessment/questionnaire", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: ratings, likert, situational }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not save.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const LIKERT_CHOICES = [
    { val: 1, label: "Strongly Disagree" },
    { val: 2, label: "Disagree" },
    { val: 3, label: "Neutral" },
    { val: 4, label: "Agree" },
    { val: 5, label: "Strongly Agree" },
  ];

  return (
    <div className="space-y-6">
      {/* Questionnaire Step Tabs */}
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-1.5">
        <button
          type="button"
          onClick={() => setCurrentStep(1)}
          className={`flex items-center justify-center gap-2 rounded-lg py-3 text-xs font-bold transition-all ${
            currentStep === 1
              ? "bg-white text-navy shadow-sm"
              : "text-mediumgray hover:text-navy"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate/10 text-[11px] text-slate">
            1
          </span>
          Technical Skills ({claimedCount})
        </button>
        <button
          type="button"
          onClick={() => setCurrentStep(2)}
          className={`flex items-center justify-center gap-2 rounded-lg py-3 text-xs font-bold transition-all ${
            currentStep === 2
              ? "bg-white text-navy shadow-sm"
              : "text-mediumgray hover:text-navy"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate/10 text-[11px] text-slate">
            2
          </span>
          Soft Skills ({Object.keys(likert).length}/{LIKERT.length})
        </button>
        <button
          type="button"
          onClick={() => setCurrentStep(3)}
          className={`flex items-center justify-center gap-2 rounded-lg py-3 text-xs font-bold transition-all ${
            currentStep === 3
              ? "bg-white text-navy shadow-sm"
              : "text-mediumgray hover:text-navy"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate/10 text-[11px] text-slate">
            3
          </span>
          Situational Aptitude ({Object.keys(situational).length}/{SITUATIONAL.length})
        </button>
      </div>

      {/* STEP 1: Technical Skills */}
      {currentStep === 1 && (
        <Card className="p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-lightgray pb-4">
            <div>
              <h2 className="text-base font-bold text-navy">1 · Technical Skills Self-Rating</h2>
              <p className="mt-1 text-xs text-mediumgray max-w-xl">
                Rate skills you have learned. They become claimed skills which you can verify with tests to show on your ATS resume.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search skills…"
                className="h-9 w-44 rounded-lg border border-lightgray px-3 text-xs text-navy outline-none focus:border-slate"
              />
              <div className="flex rounded-lg border border-lightgray bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setCategoryFilter("all")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    categoryFilter === "all" ? "bg-navy text-white" : "text-mediumgray hover:text-navy"
                  }`}
                >
                  All ({allSkills.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter("claimed")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    categoryFilter === "claimed" ? "bg-navy text-white" : "text-mediumgray hover:text-navy"
                  }`}
                >
                  Claimed ({claimedCount})
                </button>
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addCustomSkill();
            }}
            className="mt-4 flex flex-wrap items-center gap-2"
          >
            <input
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              maxLength={40}
              placeholder="Don't see a skill? Add it (e.g. Figma)"
              className="h-9 w-64 rounded-lg border border-lightgray px-3 text-xs text-navy outline-none focus:border-slate"
            />
            <button type="submit" disabled={!newSkill.trim()} className="h-9 rounded-lg border border-lightgray px-3 text-xs font-semibold text-navy hover:border-slate hover:text-slate disabled:opacity-50">
              Add skill
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-mediumgray">
            <span className="font-semibold text-navy">Proficiency scale:</span>
            {SELF_RATINGS.map((r) => (
              <span key={r.value} className="rounded bg-surface px-2 py-0.5">
                <span className="font-semibold text-navy">{r.value}:</span> {r.label}
              </span>
            ))}
          </div>

          <ul className="mt-4 grid max-h-[32rem] grid-cols-1 gap-2.5 overflow-y-auto pr-1 md:grid-cols-2">
            {catalogue.length === 0 && (
              <li className="col-span-full rounded-xl border border-dashed border-lightgray p-6 text-center text-xs text-mediumgray">
                No skills match. Add it above and rate it.
              </li>
            )}
            {catalogue.map((c) => {
              const isVerified = verifiedNames.has(norm(c.name));
              const currentVal = ratings[c.name];

              return (
                <li
                  key={c.name}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${
                    isVerified
                      ? "border-emerald/30 bg-emerald/5"
                      : currentVal
                        ? "border-slate/40 bg-slate/5"
                        : "border-lightgray bg-white hover:border-lightgray"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-navy">
                      {c.name}
                      {isVerified && <BadgeCheck className="h-4 w-4 text-emerald" />}
                    </p>
                    <p className="text-[11px] text-mediumgray">
                      {c.demand > 0 ? `${c.demand} open job${c.demand === 1 ? "" : "s"} ask for it` : c.moduleTitle ? `On your roadmap · ${c.moduleTitle}` : "Your skill"}
                    </p>
                  </div>

                  {isVerified ? (
                    <span className="rounded-md bg-emerald/10 px-2 py-1 text-xs font-semibold text-emerald">
                      Verified
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      {SELF_RATINGS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => toggleRating(c.name, r.value)}
                          title={`${r.label} — ${r.hint}`}
                          className={`h-7 w-7 rounded-md text-xs font-bold transition-all ${
                            currentVal === r.value
                              ? "bg-slate text-white shadow-xs"
                              : "bg-surface text-mediumgray hover:bg-lightgray hover:text-navy"
                          }`}
                        >
                          {r.value}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex items-center justify-between border-t border-lightgray pt-4">
            <span className="text-xs font-medium text-navy">
              {claimedCount} skill{claimedCount === 1 ? "" : "s"} selected
            </span>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#1f2937]"
            >
              Continue to Soft Skills <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </Card>
      )}

      {/* STEP 2: Soft Skills */}
      {currentStep === 2 && (
        <Card className="p-6">
          <div className="border-b border-lightgray pb-4">
            <h2 className="text-base font-bold text-navy">2 · Soft Skills Assessment</h2>
            <p className="mt-1 text-xs text-mediumgray">
              Select how accurately each behavioral statement reflects your working style.
            </p>
          </div>

          <div className="mt-5 space-y-4">
            {LIKERT.map((l, idx) => (
              <div key={l.id} className="rounded-xl border border-lightgray bg-white p-4">
                <p className="text-sm font-semibold text-navy">
                  <span className="text-slate mr-1.5 font-bold">{idx + 1}.</span> {l.text}
                </p>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {LIKERT_CHOICES.map((choice) => {
                    const isSelected = likert[l.id] === choice.val;
                    return (
                      <button
                        key={choice.val}
                        type="button"
                        onClick={() => setLikert((prev) => ({ ...prev, [l.id]: choice.val }))}
                        className={`rounded-lg py-2.5 px-2 text-xs font-medium text-center transition-all ${
                          isSelected
                            ? "bg-slate text-white shadow-xs font-bold"
                            : "bg-surface-2 text-mediumgray hover:bg-surface hover:text-navy"
                        }`}
                      >
                        {choice.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-lightgray pt-4">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-mediumgray hover:text-navy"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Technical Skills
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#1f2937]"
            >
              Continue to Aptitude Scenarios <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </Card>
      )}

      {/* STEP 3: Situational & Aptitude */}
      {currentStep === 3 && (
        <Card className="p-6">
          <div className="border-b border-lightgray pb-4">
            <h2 className="text-base font-bold text-navy">3 · Aptitude & Practical Scenarios</h2>
            <p className="mt-1 text-xs text-mediumgray">
              Choose the response that best describes your approach to these real-world engineering scenarios.
            </p>
          </div>

          <div className="mt-5 space-y-6">
            {SITUATIONAL.map((s, idx) => (
              <div key={s.id} className="rounded-xl border border-lightgray bg-white p-5">
                <p className="text-sm font-bold text-navy">
                  <span className="text-slate mr-1.5">Scenario {idx + 1}:</span> {s.text}
                </p>
                <div className="mt-3.5 space-y-2">
                  {s.options.map((option, optIdx) => {
                    const isSelected = situational[s.id] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => setSituational((prev) => ({ ...prev, [s.id]: optIdx }))}
                        className={`flex w-full items-start gap-3 rounded-lg border p-3.5 text-left text-xs transition-all ${
                          isSelected
                            ? "border-slate bg-slate/5 text-navy font-semibold ring-1 ring-slate"
                            : "border-lightgray text-navy hover:bg-surface-2"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            isSelected ? "border-slate bg-slate text-white" : "border-lightgray bg-white"
                          }`}
                        >
                          {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        <span>{option.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="mt-4 text-xs font-semibold text-red-600">{error}</p>}
          {!isAllComplete && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              To save, {missing.join(", ")}.{" "}
              {claimedCount === 0 && (
                <button type="button" onClick={() => setCurrentStep(1)} className="font-semibold underline">Go to skills</button>
              )}
              {claimedCount > 0 && !completeLikert && (
                <button type="button" onClick={() => setCurrentStep(2)} className="font-semibold underline">Go to soft skills</button>
              )}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-lightgray pt-4">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-mediumgray hover:text-navy"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Soft Skills
            </button>

            <div className="flex items-center gap-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-lg border border-lightgray bg-white px-4 py-2.5 text-xs font-semibold text-navy hover:border-slate hover:text-slate"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={() => submit()}
                disabled={saving || !isAllComplete}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-gradient px-6 py-2.5 text-xs font-bold text-white shadow-[0_4px_12px_rgba(234,88,12,0.25)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save & Complete Assessment
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
