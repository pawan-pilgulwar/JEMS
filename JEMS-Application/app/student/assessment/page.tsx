import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AssessmentHub from "@/components/assessment/AssessmentHub";
import { listPapers } from "@/lib/ai/papers";
import { getAssessmentState } from "@/lib/db/assessment";

export const metadata: Metadata = { title: "Skill Assessment — Jems" };

export default async function AssessmentPage({ searchParams }: { searchParams: Promise<{ take?: string }> }) {
  const [session, { take }] = await Promise.all([auth(), searchParams]);
  if (!session?.user?.id) redirect("/login");
  const [state, papers] = await Promise.all([
    getAssessmentState(session.user.id),
    listPapers(session.user.id, "skill"),
  ]);
  if (!state) redirect("/login");
  return <AssessmentHub state={state} papers={papers} take={take?.trim().slice(0, 80) || undefined} />;
}
