import { NextResponse } from "next/server";
import { listInstitutions } from "@/lib/db/org-profiles";

/** Registered institutions (id, name, location) for the signup and profile pickers. Public: names only. */
export async function GET() {
  return NextResponse.json({ institutions: await listInstitutions() }, { headers: { "Cache-Control": "public, max-age=300" } });
}
