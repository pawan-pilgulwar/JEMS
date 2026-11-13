import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/api-session";
import { applyToJob, RESUME_MAX_BYTES, withdrawApplication } from "@/lib/db/student-actions";
import { getApplications } from "@/lib/db/student-data";
import { readJsonLimited } from "@/lib/http";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { validateJobRef } from "@/lib/validation/student-actions";

/** The student's applications and their pipeline status. */
export async function GET() {
  const s = await apiSession("student");
  if ("error" in s) return s.error;
  return NextResponse.json({ applications: await getApplications(s.userId) });
}

/**
 * Applies to `{ jobId, resume }` where `resume` is a built version
 * (`{ type: "built", resumeId }`) or an upload (`{ type: "manual", fileName,
 * fileData: dataURL }`). The resume is validated and stored server-side; the
 * company and the student are both notified.
 */
export async function POST(request: Request) {
  const s = await apiSession("student");
  if ("error" in s) return s.error;
  const limit = await rateLimit(`apply:${s.userId}`, 20, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  // A base64 data URL is ~4/3 the file size, plus the JSON around it.
  const parsed = await readJsonLimited(request, Math.ceil(RESUME_MAX_BYTES * 1.4) + 4_000);
  if (parsed.error) return NextResponse.json({ error: parsed.status === 413 ? "Resume files must be 2 MB or smaller." : parsed.error }, { status: parsed.status });
  const { value, error } = validateJobRef(parsed.data);
  if (error || !value?.jobId) return NextResponse.json({ error: error ?? "Invalid job." }, { status: 400 });

  const resume = parsed.data && typeof parsed.data === "object" ? (parsed.data as Record<string, unknown>).resume : undefined;
  const res = await applyToJob(s.userId, value.jobId, resume);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, id: res.id }, { status: 201 });
}

/** Withdraws an application (the company is notified). */
export async function DELETE(request: Request) {
  const s = await apiSession("student");
  if ("error" in s) return s.error;
  const parsed = await readJsonLimited(request, 2000);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const data = parsed.data as Record<string, unknown> | null;
  const id = typeof data?.applicationId === "string" ? data.applicationId : typeof data?.id === "string" ? data.id : null;
  if (!id) return NextResponse.json({ error: "Application ID is required." }, { status: 400 });

  const ok = await withdrawApplication(s.userId, id);
  if (!ok) return NextResponse.json({ error: "Could not withdraw application." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
