import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCompanyDashboard } from "@/lib/db/company";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "company") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getCompanyDashboard(session.user.id);
  if (!data) {
    return NextResponse.json({ error: "Company profile not found." }, { status: 404 });
  }

  return NextResponse.json(data);
}

