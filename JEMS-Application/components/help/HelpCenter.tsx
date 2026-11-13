"use client";

import { useState } from "react";
import {
  type LucideIcon,
  ArrowRight,
  Briefcase,
  ChevronDown,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LifeBuoy,
  Mic,
  Search,
  User,
} from "lucide-react";
import Link from "next/link";
import DashboardShell, { DashboardContainer } from "@/components/dashboard/student/DashboardShell";
import { Card } from "@/components/dashboard/student/ui";

interface Topic {
  key: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  /** The feature this topic is about. */
  href: string;
}

const TOPICS: Topic[] = [
  { key: "profile", title: "Profile & portfolio", desc: "Your public profile and goals", icon: User, href: "/student/profile" },
  { key: "assessment", title: "Skill assessment", desc: "Questionnaire, tests, verified skills", icon: ClipboardCheck, href: "/student/assessment" },
  { key: "resume", title: "Resume builder", desc: "1-page ATS resumes and versions", icon: FileText, href: "/student/resume" },
  { key: "learning", title: "Roadmap & learning", desc: "Modules, lessons, industry programs", icon: GraduationCap, href: "/student/learning" },
  { key: "jobs", title: "Jobs & applications", desc: "Matches, applying, tracking status", icon: Briefcase, href: "/student/jobs" },
  { key: "interviews", title: "Mock interviews", desc: "AI interview practice", icon: Mic, href: "/student/interviews" },
];

/** Answers describe how the app actually behaves — keep them in step with the features. */
const ARTICLES: { topic: string; q: string; a: string }[] = [
  { topic: "assessment", q: "What's the difference between a claimed and a verified skill?", a: "Skills you rate in the questionnaire are claimed. A skill becomes verified when you pass its quick MCQ test, an AI-generated test (70% or more), or the roadmap module quiz that covers it. Only verified skills count fully in job matching and can be imported into your resume as verified." },
  { topic: "assessment", q: "Can I change my questionnaire answers?", a: "Yes. Open Skill Assessment and choose \"Edit questionnaire\". Your earlier soft-skill and scenario answers are pre-filled, and you can add skills that aren't in the list. Verified skills are never downgraded by a new self-rating." },
  { topic: "assessment", q: "Why is a test locked?", a: "After a failed attempt a skill test has a 24-hour cooldown so the result reflects learning rather than retries. The lock time is shown next to the skill." },
  { topic: "resume", q: "How is my ATS resume score calculated?", a: "It's out of 100: contact details (25), a summary of 2–3 sentences (15), up to three experience entries (30), education (10), skills — about 8 for full marks (15) — and at least one project or certification (5). The suggestion under the score tells you the next thing to add." },
  { topic: "resume", q: "Can I keep several resume versions?", a: "Yes. Create a new version from scratch, as a copy of an existing one, or from an old resume (paste its text or upload a .txt/.json export). Name versions after the role they're tailored for — when you apply, JEMS recommends the version whose skills best match the job." },
  { topic: "resume", q: "How do I keep my resume to one page?", a: "Leave \"1-Page Fit\" on. The preview scales the content to fit an A4 page and warns you when it would still overflow, so you know to shorten older entries. \"Download as PDF\" prints exactly that page." },
  { topic: "jobs", q: "How do I improve my job match percentage?", a: "The match score compares the role's required skills with your skills — verified skills count fully, claimed ones count half. The missing skills are listed on each job card; verify them in Skill Assessment or learn them on your roadmap." },
  { topic: "jobs", q: "Which resume does the company receive?", a: "The one you pick in the apply dialog: a version from the resume builder (sent exactly as it is at that moment) or a PDF/Word file you upload (up to 2 MB). The company opens it from its Candidates page." },
  { topic: "jobs", q: "How do I know when my application status changes?", a: "Companies move you through Applied, In review, Shortlisted, Interview and Offer (or Rejected). Each change sends you a notification, and the Applications page refreshes on its own." },
  { topic: "learning", q: "What are industry programs?", a: "Training, certifications, workshops and mentorship published by hiring companies. Apply from Industry Programs; the company accepts, waitlists or rejects you and you're notified. Programs that teach skills you're missing are highlighted." },
  { topic: "learning", q: "Why does a lesson sometimes take a while to load?", a: "The first time anyone opens a lesson for a topic at your level, the learning agent writes it. After that it's served instantly from the cache, and video suggestions found for a topic are reused for every learner." },
  { topic: "profile", q: "Who can see my profile?", a: "Your public portfolio link shows your verified skills, projects and certificates. Companies see it when you apply or appear in their candidate rankings, and your institution sees your progress in its analytics." },
  { topic: "interviews", q: "How do mock interview scores work?", a: "Each AI interview is graded by the assessment agent into an overall percentage with written feedback. Your history, average and best score appear on the Mock Interviews page." },
];

export default function HelpCenter() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const visible = ARTICLES.filter((a) => (!topic || a.topic === topic) && (!q || `${a.q} ${a.a}`.toLowerCase().includes(q)));
  const current = TOPICS.find((t) => t.key === topic);

  return (
    <DashboardShell>
      <DashboardContainer className="space-y-6">
        {/* Search hero */}
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold text-navy">How can we help?</h2>
          <p className="mt-1 text-sm text-mediumgray">Search the answers below or pick a topic.</p>
          <div className="relative mx-auto mt-5 max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mediumgray" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. verified skills, resume, shortlisted…"
              aria-label="Search help"
              className="h-12 w-full rounded-xl border border-lightgray bg-white pl-11 pr-4 text-sm text-navy outline-none transition-colors placeholder:text-mediumgray focus:border-slate focus:ring-2 focus:ring-slate/15"
            />
          </div>
        </Card>

        {/* Topics */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {TOPICS.map((t) => {
            const Icon = t.icon;
            const count = ARTICLES.filter((a) => a.topic === t.key).length;
            const active = topic === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTopic(active ? null : t.key)}
                aria-pressed={active}
                className={`flex items-start gap-4 rounded-2xl border bg-white p-5 text-left shadow-[var(--shadow-soft)] transition-colors ${active ? "border-slate" : "border-navy/[0.06] hover:border-slate/40"}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate/10 text-slate">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-navy">{t.title}</span>
                  <span className="block text-xs text-mediumgray">{t.desc}</span>
                  <span className="mt-1 block text-[11px] font-medium text-slate">{count} answer{count === 1 ? "" : "s"}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Answers */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-lightgray px-5 py-3.5">
            <h2 className="text-sm font-semibold text-navy">
              {current ? current.title : q ? "Search results" : "All answers"} <span className="font-normal text-mediumgray">({visible.length})</span>
            </h2>
            {current && (
              <Link href={current.href} className="inline-flex items-center gap-1 text-xs font-semibold text-slate hover:underline">
                Open {current.title} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
          <ul className="divide-y divide-lightgray">
            {visible.length === 0 && <li className="px-5 py-8 text-center text-sm text-mediumgray">No answers match — try other words, or contact support below.</li>}
            {visible.map((a) => {
              const isOpen = open === a.q || (!!q && visible.length <= 3);
              return (
                <li key={a.q}>
                  <button
                    type="button"
                    onClick={() => setOpen(open === a.q ? null : a.q)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left text-sm font-medium text-navy hover:bg-surface-2"
                  >
                    {a.q}
                    <ChevronDown className={`h-4 w-4 shrink-0 text-mediumgray transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && <p className="px-5 pb-4 text-sm leading-6 text-mediumgray">{a.a}</p>}
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Still need help */}
        <Card className="flex flex-col items-center justify-between gap-4 p-6 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange/10 text-orange">
              <LifeBuoy className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-navy">Still need help?</p>
              <p className="text-xs text-mediumgray">Raise a ticket and track its status on the Support page.</p>
            </div>
          </div>
          <Link href="/student/support" className="rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1f2937]">
            Contact Support
          </Link>
        </Card>
      </DashboardContainer>
    </DashboardShell>
  );
}
