import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { agent } from "@/lib/agent/client";
import { readJsonLimited } from "@/lib/http";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "company") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await readJsonLimited(request, 10_000);
  if (parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const role = String(body.role ?? "").trim();
  const description = String(body.description ?? "").trim();

  if (!role || !description) {
    return NextResponse.json({ error: "Role and job description are required." }, { status: 400 });
  }

  try {
    const result = await agent.jobSkills({ role, description });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    console.error("[company-ai] skill extraction failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to extract skills with AI." },
      { status: 502 }
    );
  }
}

