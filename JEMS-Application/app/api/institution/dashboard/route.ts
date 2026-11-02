import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInstitutionDashboard } from "@/lib/db/institution";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "institution") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getInstitutionDashboard(session.user.id);
  if (!data) {
    return NextResponse.json({ error: "Institution profile not found." }, { status: 404 });
  }

  return NextResponse.json(data);
}

