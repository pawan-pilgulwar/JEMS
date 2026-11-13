import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/api-session";
import { getCompanyProfile, updateCompanyProfile } from "@/lib/db/org-profiles";
import { readJsonLimited } from "@/lib/http";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { validateCompanyProfile } from "@/lib/validation/org-profile";

/** The signed-in company's own profile. */
export async function GET() {
  const s = await apiSession("company");
  if ("error" in s) return s.error;
  const profile = await getCompanyProfile(s.userId);
  return profile ? NextResponse.json({ profile }) : NextResponse.json({ error: "Profile not found." }, { status: 404 });
}

/** Saves edits to the signed-in company's profile. */
export async function PATCH(request: Request) {
  const s = await apiSession("company");
  if ("error" in s) return s.error;
  const limit = await rateLimit(`profile:${s.userId}`, 20, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const parsed = await readJsonLimited(request, 20_000);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const { value, error } = validateCompanyProfile(parsed.data);
  if (error || !value) return NextResponse.json({ error: error ?? "Invalid input." }, { status: 400 });

  const ok = await updateCompanyProfile(s.userId, value);
  if (!ok) return NextResponse.json({ error: "Could not save the profile." }, { status: 500 });
  return NextResponse.json({ ok: true, profile: await getCompanyProfile(s.userId) });
}
