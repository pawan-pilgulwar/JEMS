import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listPapers } from "@/lib/ai/papers";
import { getProfileAnalysis } from "@/lib/ai/profile";
import { listAiRoadmaps } from "@/lib/ai/roadmap";
import {
  getApplications,
  getDashboardData,
  getSavedJobs,
  getStoredStudentAdvisorReport,
  shortDate,
} from "@/lib/db/student-data";
import type { DashboardAiData } from "@/components/dashboard/student/StudentDashboard";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const [data, roadmaps, papers, analysis, applications, saved, advisorReport] = await Promise.all([
    getDashboardData(userId),
    listAiRoadmaps(userId),
    listPapers(userId),
    getProfileAnalysis(userId),
    getApplications(userId),
    getSavedJobs(userId),
    getStoredStudentAdvisorReport(userId),
  ]);

  const ai: DashboardAiData = {
    roadmaps: roadmaps.slice(0, 3),
    roadmapCount: roadmaps.length,
    openPapers: papers.filter((p) => p.status === "ready" || p.status === "in-progress").slice(0, 3),
    lastGraded: papers.find((p) => p.status === "graded") ?? null,
    codingSkills: analysis?.skills.length ?? null,
    codingAnalyzedAt: analysis?.updatedAt ? shortDate(analysis.updatedAt) : null,
    applications: applications.length,
    saved: saved.length,
  };

  return NextResponse.json({
    data,
    ai,
    advisorReport: advisorReport || data.latestAdvisorReport || null,
  });
}

