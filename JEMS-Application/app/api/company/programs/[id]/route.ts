import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/api-session";
import { setProgramStatus } from "@/lib/db/programs";
import { readJsonLimited } from "@/lib/http";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { validateListingStatus } from "@/lib/validation/company";

/** Opens or closes one of the company's own programs to new applications. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("company");
  if ("error" in s) return s.error;
  const limit = await rateLimit(`company-program-status:${s.userId}`, 60, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const { id } = await params;
  const parsed = await readJsonLimited(request, 1_000);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const { value, error } = validateListingStatus(parsed.data);
  if (error || !value) return NextResponse.json({ error: error ?? "Invalid input." }, { status: 400 });

  const ok = await setProgramStatus(s.userId, String(id), value);
  if (!ok) return NextResponse.json({ error: "Program not found." }, { status: 404 });
  return NextResponse.json({ ok: true, status: value });
}
