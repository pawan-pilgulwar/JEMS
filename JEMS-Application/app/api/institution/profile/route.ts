import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/api-session";
import { getInstitutionProfile, updateInstitutionProfile } from "@/lib/db/org-profiles";
import { readJsonLimited } from "@/lib/http";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { validateInstitutionProfile } from "@/lib/validation/org-profile";

/** The signed-in institution's own profile. */
export async function GET() {
  const s = await apiSession("institution");
  if ("error" in s) return s.error;
  const profile = await getInstitutionProfile(s.userId);
  return profile ? NextResponse.json({ profile }) : NextResponse.json({ error: "Profile not found." }, { status: 404 });
}

/** Saves edits to the signed-in institution's profile. */
export async function PATCH(request: Request) {
  const s = await apiSession("institution");
  if ("error" in s) return s.error;
  const limit = await rateLimit(`profile:${s.userId}`, 20, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const parsed = await readJsonLimited(request, 20_000);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const { value, error } = validateInstitutionProfile(parsed.data);
  if (error || !value) return NextResponse.json({ error: error ?? "Invalid input." }, { status: 400 });

  const res = await updateInstitutionProfile(s.userId, value);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, profile: await getInstitutionProfile(s.userId) });
}
