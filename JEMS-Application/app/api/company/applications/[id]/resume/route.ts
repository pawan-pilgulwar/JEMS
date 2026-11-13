import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/api-session";
import { getApplicationResumeForCompany } from "@/lib/db/student-actions";

/** Streams an applicant's uploaded resume file to the company that owns the opening. `?download=1` forces a download. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("company");
  if ("error" in s) return s.error;
  const { id } = await params;
  const resume = await getApplicationResumeForCompany(s.userId, String(id));
  if (!resume) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  if (resume.type !== "manual") return NextResponse.json({ error: "This application has no uploaded file." }, { status: 404 });

  const download = new URL(request.url).searchParams.has("download");
  const safeName = resume.fileName.replace(/[^\w.\- ]+/g, "_") || "resume";
  return new NextResponse(new Uint8Array(resume.data), {
    headers: {
      "Content-Type": resume.mime,
      "Content-Disposition": `${download || resume.mime !== "application/pdf" ? "attachment" : "inline"}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
