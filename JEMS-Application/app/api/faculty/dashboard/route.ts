import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFacultyDashboard } from "@/lib/db/faculty";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "faculty") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getFacultyDashboard(session.user.id);
  if (!data) {
    return NextResponse.json({ error: "Faculty profile not found." }, { status: 404 });
  }

  return NextResponse.json(data);
}

