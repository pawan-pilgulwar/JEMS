import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/api-session";
import { applyToProgram, listProgramsForStudent, withdrawFromProgram } from "@/lib/db/programs";
import { readJsonLimited } from "@/lib/http";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const programIdOf = (data: unknown): string => {
  const v = data && typeof data === "object" ? (data as Record<string, unknown>).programId : undefined;
  return typeof v === "string" ? v : "";
};

/** Industry programs with the student's skill fit and application status. */
export async function GET() {
  const s = await apiSession("student");
  if ("error" in s) return s.error;
  return NextResponse.json({ programs: await listProgramsForStudent(s.userId) });
}

/** Applies to `{ programId, motivation? }`; the publishing company is notified. */
export async function POST(request: Request) {
  const s = await apiSession("student");
  if ("error" in s) return s.error;
  const limit = await rateLimit(`program-apply:${s.userId}`, 20, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const parsed = await readJsonLimited(request, 4_000);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const programId = programIdOf(parsed.data);
  if (!programId) return NextResponse.json({ error: "programId is required." }, { status: 400 });
  const raw = (parsed.data as Record<string, unknown>).motivation;
  const motivation = typeof raw === "string" ? raw.trim() : "";

  const res = await applyToProgram(s.userId, programId, motivation);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, id: res.id }, { status: 201 });
}

/** Withdraws a pending program application `{ programId }`. */
export async function DELETE(request: Request) {
  const s = await apiSession("student");
  if ("error" in s) return s.error;
  const parsed = await readJsonLimited(request, 1_000);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const programId = programIdOf(parsed.data);
  if (!programId) return NextResponse.json({ error: "programId is required." }, { status: 400 });

  const ok = await withdrawFromProgram(s.userId, programId);
  if (!ok) return NextResponse.json({ error: "Nothing to withdraw — accepted applications can't be withdrawn here." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
