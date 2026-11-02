import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { agent } from "@/lib/agent/client";
import { getInstitutionDashboard, saveInstitutionInsights } from "@/lib/db/institution";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "institution") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getInstitutionDashboard(session.user.id);
  if (!data) {
    return NextResponse.json({ error: "Institution not found." }, { status: 404 });
  }

  try {
    const topSkills = data.demandTrends.slice(0, 10).map((d) => d.skill);
    const totalOpenings = data.demandTrends.reduce((acc, d) => acc + d.openings, 0);

    const insights = await agent.institutionInsights({
      institution_name: data.institution,
      cohort_summary: {
        total_students: data.kpis.students,
        avg_readiness: data.kpis.avgReadiness,
        top_roles: data.targetRoles.map((r) => r.role),
        top_verified_skills: data.skillGaps.filter((s) => s.coverage > 20).map((s) => s.skill),
        skill_gaps: data.skillGaps.slice(0, 10).map((s) => ({
          skill: s.skill,
          coverage: s.coverage,
          gap: s.gap,
        })),
      },
      market_demand: {
        top_skills: topSkills,
        total_openings: totalOpenings,
      },
    });

    await saveInstitutionInsights(data.institution, insights);
    return NextResponse.json({ ok: true, insights });
  } catch (err) {
    console.error("[institution-ai] error running insights:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to run AI placement insights." },
      { status: 502 }
    );
  }
}

