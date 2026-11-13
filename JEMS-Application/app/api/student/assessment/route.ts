import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listPapers } from "@/lib/ai/papers";
import { getAssessmentState } from "@/lib/db/assessment";

/** Returns live assessment state and AI papers for the authenticated student. */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (session.user.role !== "student") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  try {
    const [state, papers] = await Promise.all([
      getAssessmentState(userId),
      listPapers(userId, "skill"),
    ]);
    if (!state) return NextResponse.json({ error: "State not found." }, { status: 404 });
    return NextResponse.json({ state, papers });
  } catch (err) {
    console.error("[api/student/assessment] GET failed:", err);
    return NextResponse.json({ error: "Could not load assessment state." }, { status: 500 });
  }
}
