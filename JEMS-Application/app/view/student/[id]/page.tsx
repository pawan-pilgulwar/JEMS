import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card, ProgressBar } from "@/components/dashboard/student/ui";
import PortfolioView from "@/components/portfolio/PortfolioView";
import { Empty, Section, STATUS_PILL, fmtDate } from "@/components/profile/ProfileBits";
import { getStudentView } from "@/lib/db/student-view";
import type { UserRole } from "@/lib/db/users";

export const metadata: Metadata = { title: "Student profile — Jems" };

/**
 * A student's profile as another user sees it. Everyone signed in sees the
 * verified portfolio; a company also sees what the student sent it; the
 * student's own institution and faculty also see the full progress record.
 */
export default async function StudentViewPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, auth()]);
  if (!session?.user?.id) redirect("/login");
  if (session.user.id === id) redirect("/student/profile?tab=portfolio");
  const view = await getStudentView({ id: session.user.id, role: session.user.role as UserRole }, id);
  if (!view) notFound();
  const { relation, progress } = view;

  return (
    <div className="space-y-6">
      {relation === "institution" && (
        <Card className="border-slate/20 bg-slate/5 p-4 text-sm text-navy">
          {view.portfolio.name} is a student of your institution — you can see their full progress below.
          {view.email && <> Contact: <a href={`mailto:${view.email}`} className="font-semibold text-slate hover:underline">{view.email}</a></>}
        </Card>
      )}
      {relation === "company" && view.email && (
        <Card className="border-slate/20 bg-slate/5 p-4 text-sm text-navy">
          Applied to your {view.applications.length ? "opening" : "program"} · contact <a href={`mailto:${view.email}`} className="font-semibold text-slate hover:underline">{view.email}</a>
        </Card>
      )}

      {relation === "company" && (view.applications.length > 0 || view.programs.length > 0) && (
        <Section title="With your company" count={view.applications.length + view.programs.length}>
          <ul className="divide-y divide-lightgray">
            {view.applications.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <span className="font-medium text-navy">{a.role}</span>
                  <span className="text-[11px] text-mediumgray"> · {a.type} · applied {fmtDate(a.appliedAt)}</span>
                </span>
                <span className="flex items-center gap-2">
                  {a.resumeHref && <Link href={a.resumeHref} className="text-xs font-semibold text-slate hover:underline">Resume</Link>}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_PILL(a.status)}`}>{a.status}</span>
                </span>
              </li>
            ))}
            {view.programs.map((p) => (
              <li key={p.title} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <span><span className="font-medium text-navy">{p.title}</span><span className="text-[11px] text-mediumgray"> · program · {fmtDate(p.appliedAt)}</span></span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_PILL(p.status)}`}>{p.status}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {progress && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {[
              { label: "Readiness", value: `${view.portfolio.readiness}%` },
              { label: "Verified skills", value: view.portfolio.stats.verifiedSkills },
              { label: "Roadmap modules passed", value: progress.modulesPassed },
              { label: "Mock interviews", value: progress.mockInterviews },
              { label: "Last active", value: progress.lastActive ? fmtDate(progress.lastActive) : "—" },
            ].map((t) => (
              <Card key={t.label} className="p-4">
                <p className="text-xs font-medium text-mediumgray">{t.label}</p>
                <p className="mt-2 text-xl font-bold text-navy">{t.value}</p>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Section title="Learning progress" count={progress.learning.length}>
              {progress.learning.length === 0 ? (
                <Empty>No learning paths started.</Empty>
              ) : (
                <ul className="space-y-3">
                  {progress.learning.map((l) => (
                    <li key={l.title}>
                      <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-navy">{l.title}</span><span className="text-mediumgray">{l.progress}%</span></div>
                      <ProgressBar value={l.progress} barClass={l.progress >= 100 ? "bg-emerald" : "bg-slate"} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="Skill tests" count={progress.tests.length}>
              {progress.tests.length === 0 ? (
                <Empty>No skill tests taken yet.</Empty>
              ) : (
                <ul className="divide-y divide-lightgray">
                  {progress.tests.map((t) => (
                    <li key={`${t.skill}-${t.takenAt}`} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-navy">{t.skill}</span>
                      <span className={`text-xs font-semibold ${t.passed ? "text-emerald" : "text-amber-600"}`}>{t.score}% · {t.passed ? "passed" : "not yet"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="Applications" count={view.applications.length}>
              {view.applications.length === 0 ? (
                <Empty>Hasn&apos;t applied anywhere yet.</Empty>
              ) : (
                <ul className="divide-y divide-lightgray">
                  {view.applications.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="min-w-0 truncate"><span className="text-navy">{a.role}</span><span className="text-[11px] text-mediumgray"> · {a.company}</span></span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_PILL(a.status)}`}>{a.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="Industry programs" count={view.programs.length}>
              {view.programs.length === 0 ? (
                <Empty>Not enrolled in any program.</Empty>
              ) : (
                <ul className="divide-y divide-lightgray">
                  {view.programs.map((p) => (
                    <li key={p.title} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="min-w-0 truncate"><span className="text-navy">{p.title}</span><span className="text-[11px] text-mediumgray"> · {p.company}</span></span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_PILL(p.status)}`}>{p.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      )}

      <PortfolioView data={view.portfolio} />
    </div>
  );
}
