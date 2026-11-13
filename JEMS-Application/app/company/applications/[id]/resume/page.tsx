import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText } from "lucide-react";
import ResumeSnapshot from "@/components/company/ResumeSnapshot";
import { Card } from "@/components/dashboard/student/ui";
import { requireRole } from "@/lib/auth/require-role";
import { getApplicationResumeForCompany } from "@/lib/db/student-actions";

export const metadata: Metadata = { title: "Applicant resume — Jems" };

/** The exact resume a candidate sent with their application. */
export default async function ApplicantResumePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("company");
  const { id } = await params;
  const resume = await getApplicationResumeForCompany(session.user.id, id);
  if (!resume) notFound();
  const fileUrl = `/api/company/applications/${id}/resume`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/company/candidates" className="inline-flex items-center gap-1 text-xs font-semibold text-slate hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Candidates
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-navy">{resume.studentName}</h1>
          <p className="text-sm text-mediumgray">
            Resume sent for <span className="font-medium text-navy">{resume.role}</span>
            {resume.type !== "none" && <> · {resume.name}</>}
          </p>
        </div>
        {resume.type === "manual" && (
          <a href={`${fileUrl}?download=1`} className="inline-flex items-center gap-1.5 rounded-lg border border-lightgray bg-white px-3.5 py-2 text-xs font-semibold text-navy hover:border-slate hover:text-slate">
            <Download className="h-4 w-4" /> Download {resume.fileName}
          </a>
        )}
      </div>

      {resume.type === "built" && <ResumeSnapshot data={resume.snapshot} />}
      {resume.type === "manual" &&
        (resume.mime === "application/pdf" ? (
          <Card className="overflow-hidden">
            <iframe src={fileUrl} title={`${resume.studentName} resume`} className="h-[80vh] w-full" />
          </Card>
        ) : (
          <Card className="flex flex-col items-center gap-3 p-10 text-center">
            <FileText className="h-8 w-8 text-slate" />
            <p className="text-sm text-navy">Word documents can&apos;t be previewed in the browser.</p>
            <a href={`${fileUrl}?download=1`} className="rounded-lg bg-navy px-4 py-2 text-xs font-semibold text-white">Download {resume.fileName}</a>
          </Card>
        ))}
      {resume.type === "none" && (
        <Card className="p-10 text-center text-sm text-mediumgray">
          This application was made before resumes were attached to applications. Use the candidate&apos;s portfolio link on the Candidates page instead.
        </Card>
      )}
    </div>
  );
}
