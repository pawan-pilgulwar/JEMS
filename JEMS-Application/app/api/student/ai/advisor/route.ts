import { NextResponse } from "next/server";
import { ObjectId, type Document } from "mongodb";
import { auth } from "@/auth";
import { agent, AgentError } from "@/lib/agent/client";
import { getDatabase } from "@/lib/db/mongodb";
import { saveStudentAdvisorReport } from "@/lib/db/student-data";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid student identifier." }, { status: 400 });
  }

  const db = await getDatabase();
  const _id = new ObjectId(userId);

  const [profile, resume, interviews, roadmaps, jobPostings] = await Promise.all([
    db.collection("studentProfiles").findOne({ userId: _id }),
    db.collection("resumes").findOne({ userId: _id }),
    db.collection("mockInterviews").find({ studentId: _id }).toArray(),
    db.collection("aiRoadmaps").find({ studentId: _id }).toArray(),
    db.collection("jobPostings").find({ status: { $ne: "closed" } }).sort({ postedAt: -1 }).limit(40).toArray(),
  ]);

  const rawSkills: Array<{ name?: unknown; verified?: unknown }> = Array.isArray(profile?.skills) ? profile!.skills : [];
  const verifiedSkills = rawSkills.filter((s) => Boolean(s?.verified)).map((s) => String(s?.name || "")).filter(Boolean);
  const unverifiedSkills = rawSkills.filter((s) => !s?.verified).map((s) => String(s?.name || "")).filter(Boolean);

  const interviewScores = interviews.map((i: Document) => Number(i.score) || 0);
  const interviewsAvg = interviewScores.length
    ? Math.round(interviewScores.reduce((a: number, b: number) => a + b, 0) / interviewScores.length)
    : 0;

  // Aggregate real in-demand skills across live active jobs
  const demandCount = new Map<string, number>();
  for (const job of (jobPostings as Document[])) {
    const req = Array.isArray(job.requiredSkills) ? job.requiredSkills : [];
    for (const r of req) {
      const s = String(r).trim();
      if (s) demandCount.set(s, (demandCount.get(s) ?? 0) + 1);
    }
  }
  const topMarketSkills = Array.from(demandCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([skill]) => skill);

  try {
    const report = await agent.studentAdvisor({
      student_name: session.user.name || "Student",
      target_role: typeof profile?.targetRole === "string" ? profile.targetRole : "Software Engineer",
      verified_skills: verifiedSkills,
      unverified_skills: unverifiedSkills,
      resume_ats_score: typeof resume?.atsScore === "number" ? resume.atsScore : null,
      interviews_completed: interviews.length,
      interviews_avg_score: interviewsAvg,
      roadmaps_in_progress: roadmaps.map((r: Document) => String(r.skill || "")).filter(Boolean),
      market_demand_skills: topMarketSkills,
    });

    await saveStudentAdvisorReport(userId, report);

    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error("[student/ai/advisor] agent failure:", err);
    const msg = err instanceof AgentError ? err.message : "AI career advisor is currently unavailable.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
