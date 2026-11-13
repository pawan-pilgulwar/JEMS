"use client";

import { Download } from "lucide-react";
import ResumePreview from "@/components/resume/ResumePreview";
import { emptyResume, type ResumeData } from "@/components/resume/types";

/** Read-only render of a built resume snapshot, printable to PDF like the student's own download. */
export default function ResumeSnapshot({ data }: { data: unknown }) {
  const base = emptyResume();
  const d = (data && typeof data === "object" ? data : {}) as Partial<ResumeData>;
  const resume: ResumeData = {
    ...base,
    ...d,
    header: { ...base.header, ...(d.header ?? {}) },
    experience: Array.isArray(d.experience) ? d.experience : [],
    education: Array.isArray(d.education) ? d.education : [],
    skills: Array.isArray(d.skills) ? d.skills : [],
    certifications: Array.isArray(d.certifications) ? d.certifications : [],
    projects: Array.isArray(d.projects) ? d.projects : [],
  };
  return (
    <div className="space-y-3">
      <div className="no-print flex justify-end">
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-lightgray bg-white px-3.5 py-2 text-xs font-semibold text-navy hover:border-slate hover:text-slate">
          <Download className="h-4 w-4" /> Save as PDF
        </button>
      </div>
      <ResumePreview data={resume} />
    </div>
  );
}
