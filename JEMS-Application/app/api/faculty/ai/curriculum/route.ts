import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { agent } from "@/lib/agent/client";
import { getDatabase } from "@/lib/db/mongodb";
import { saveFacultyCurriculumReview } from "@/lib/db/faculty";
import { readJsonLimited } from "@/lib/http";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "faculty") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await readJsonLimited(request, 10_000);
  if (parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const subject = String(body.subject ?? "").trim();
  if (!subject) {
    return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  }

  const currentSyllabus = Array.isArray(body.current_syllabus)
    ? (body.current_syllabus as unknown[]).map(String)
    : String(body.current_syllabus ?? "")
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

  const targetRole = String(body.target_role ?? "").trim();

  try {
    const db = await getDatabase();
    const jobs = await db.collection("jobPostings").find({ status: { $ne: "closed" } }).toArray();
    const demand = new Map<string, number>();
    for (const j of jobs) {
      for (const s of (Array.isArray(j.requiredSkills) ? j.requiredSkills : []) as string[]) {
        demand.set(s, (demand.get(s) ?? 0) + 1);
      }
    }
    const marketDemandSkills = Array.from(demand.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([s]) => s);

    const review = await agent.curriculum({
      subject,
      current_syllabus: currentSyllabus,
      target_role: targetRole,
      market_demand_skills: marketDemandSkills,
    });

    await saveFacultyCurriculumReview(session.user.id, subject, review);
    return NextResponse.json({ ok: true, review });
  } catch (err) {
    console.error("[faculty-ai] curriculum analysis failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Curriculum analysis failed." },
      { status: 502 }
    );
  }
}

