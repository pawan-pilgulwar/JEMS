import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/api-session";
import { updateEnrollmentStatus } from "@/lib/db/programs";
import { readJsonLimited } from "@/lib/http";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { validateEnrollmentStatus } from "@/lib/validation/company";

/** Moves a student's program application along (own programs only; accepting respects seats). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("company");
  if ("error" in s) return s.error;
  const limit = await rateLimit(`company-enrollments:${s.userId}`, 60, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const { id } = await params;
  const parsed = await readJsonLimited(request, 1_000);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const { value, error } = validateEnrollmentStatus(parsed.data);
  if (error || !value) return NextResponse.json({ error: error ?? "Invalid input." }, { status: 400 });

  const res = await updateEnrollmentStatus(s.userId, String(id), value);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, status: value });
}
