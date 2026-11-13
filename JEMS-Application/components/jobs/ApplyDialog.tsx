"use client";

import CompanyLink from "@/components/profile/CompanyLink";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, FileText, LoaderCircle, Sparkles, TriangleAlert, Upload, X } from "lucide-react";
import type { ResumeSummary } from "@/lib/db/student-data";

/** Mirrors the server's limit in `lib/db/student-actions.ts`. */
const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = ".pdf,.doc,.docx";
const norm = (s: string) => s.trim().toLowerCase();

export interface ApplyTarget {
  id: string;
  role: string;
  company: string;
  companyId?: string;
  location?: string;
  /** The opening's required skills; when known, each resume is checked against them. */
  requiredSkills?: string[];
}

/** How well a resume version fits the role: share of required skills it lists, plus a headline match. */
function fitOf(r: ResumeSummary, job: ApplyTarget) {
  const have = new Set(r.skills.map(norm));
  const req = job.requiredSkills ?? [];
  const covered = req.filter((s) => have.has(norm(s)));
  const titleMatch = !!r.title && (norm(job.role).includes(norm(r.title)) || norm(r.title).includes(norm(job.role)));
  const score = req.length ? Math.round((covered.length / req.length) * 100) : titleMatch ? 100 : 0;
  return { score, covered, missing: req.filter((s) => !have.has(norm(s))), titleMatch };
}

/**
 * Apply flow shared by Job Matches and Saved Jobs: checks each built resume
 * against the role's required skills, preselects the best fit, warns when
 * none fits, and lets the student upload a PDF / Word resume instead. The
 * chosen resume is sent to the company with the application.
 */
export default function ApplyDialog({
  job,
  resumes,
  onClose,
  onApplied,
}: {
  job: ApplyTarget;
  resumes: ResumeSummary[];
  onClose: () => void;
  onApplied: (message: string) => void;
}) {
  const ranked = useMemo(
    () => resumes.map((r) => ({ r, fit: fitOf(r, job) })).sort((a, b) => b.fit.score - a.fit.score || Number(b.fit.titleMatch) - Number(a.fit.titleMatch)),
    [resumes, job],
  );
  const best = ranked[0];
  const [source, setSource] = useState<"built" | "manual">(resumes.length ? "built" : "manual");
  const [resumeId, setResumeId] = useState(best?.r.id ?? "");
  const [file, setFile] = useState<{ name: string; data: string; size: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const chosen = ranked.find((x) => x.r.id === resumeId) ?? best;
  const hasRequirements = (job.requiredSkills?.length ?? 0) > 0;
  const goodFit = (x: typeof best) => !!x && (hasRequirements ? x.fit.score >= 60 : x.fit.titleMatch);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    setError("");
    if (!f) return;
    if (!/\.(pdf|docx?)$/i.test(f.name)) return setError("Upload a PDF or Word (.doc, .docx) resume.");
    if (f.size > MAX_BYTES) return setError("Resume files must be 2 MB or smaller.");
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && setFile({ name: f.name, data: reader.result, size: f.size });
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    setError("");
    const resume =
      source === "built"
        ? chosen && { type: "built", resumeId: chosen.r.id }
        : file && { type: "manual", fileName: file.name, fileData: file.data };
    if (!resume) return setError(source === "built" ? "Choose a resume version." : "Choose a resume file to upload.");
    setBusy(true);
    try {
      const res = await fetch("/api/student/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, resume }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 409) return onApplied(`You've already applied to ${job.role}.`);
      if (!res.ok) throw new Error(data.error || "Could not apply.");
      onApplied(`Applied to ${job.role} at ${job.company} — ${job.company} has your resume.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label={`Apply for ${job.role}`}>
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-lightgray bg-white p-6 shadow-2xl" style={{ animation: "fade-in 0.2s ease-out" }}>
        <div className="flex items-center justify-between border-b border-lightgray pb-4">
          <div>
            <h3 className="text-base font-bold text-navy">Apply for {job.role}</h3>
            <p className="text-xs text-mediumgray">
              <CompanyLink id={job.companyId} name={job.company} className="font-medium text-navy" />
              {job.location ? ` · ${job.location}` : ""}
              {job.companyId && <> · <a href={`/view/company/${job.companyId}`} target="_blank" rel="noreferrer" className="font-semibold text-slate hover:underline">About the company ↗</a></>}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-mediumgray hover:bg-surface hover:text-navy">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Resume check for this role */}
          <div className={`rounded-xl border p-3.5 ${best && goodFit(best) ? "border-emerald/30 bg-emerald/5" : "border-amber-200 bg-amber-50"}`}>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-navy">
              {best && goodFit(best) ? <Sparkles className="h-4 w-4 text-emerald" /> : <TriangleAlert className="h-4 w-4 text-amber-600" />}
              Resume check for {job.role}
            </p>
            <p className="mt-1 text-xs text-mediumgray">
              {resumes.length === 0 ? (
                <>You haven&apos;t built a resume yet. Upload one below, or <Link href="/student/resume" className="font-semibold text-slate hover:underline">build a 1-page resume</Link> first.</>
              ) : best && goodFit(best) ? (
                <>
                  <strong>{best.r.name}</strong> fits best
                  {hasRequirements ? ` — lists ${best.fit.covered.length} of ${job.requiredSkills!.length} required skills.` : " — its headline matches this role."}
                </>
              ) : (
                <>
                  None of your resumes is tailored to this role
                  {hasRequirements && best ? ` (best covers ${best.fit.covered.length} of ${job.requiredSkills!.length} required skills)` : ""}. Consider{" "}
                  <Link href="/student/resume" className="font-semibold text-slate hover:underline">tailoring a version</Link> or uploading one.
                </>
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-1">
            {([["built", `Built resume (${resumes.length})`, FileText], ["manual", "Upload file", Upload]] as const).map(([k, label, Icon]) => (
              <button
                key={k}
                type="button"
                disabled={k === "built" && resumes.length === 0}
                onClick={() => { setSource(k); setError(""); }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all disabled:opacity-40 ${source === k ? "bg-white text-navy shadow-xs" : "text-mediumgray hover:text-navy"}`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          {source === "built" ? (
            <ul className="space-y-2">
              {ranked.map(({ r, fit }) => (
                <li key={r.id}>
                  <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${resumeId === r.id ? "border-slate bg-slate/5" : "border-lightgray hover:bg-surface-2"}`}>
                    <input type="radio" name="resume" checked={resumeId === r.id} onChange={() => setResumeId(r.id)} className="mt-0.5 accent-[#ea580c]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-navy">{r.name}</span>
                        {r.title && <span className="text-[11px] text-mediumgray">{r.title}</span>}
                        {hasRequirements && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${fit.score >= 60 ? "bg-emerald/10 text-emerald" : fit.score >= 30 ? "bg-amber-50 text-amber-700" : "bg-surface text-mediumgray"}`}>
                            {fit.score}% skills match
                          </span>
                        )}
                      </span>
                      {resumeId === r.id && hasRequirements && fit.missing.length > 0 && (
                        <span className="mt-1 block text-[11px] text-mediumgray">Not on this resume: {fit.missing.join(", ")}</span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2">
              <input type="file" ref={input} onChange={pick} accept={ACCEPT} className="hidden" />
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-lightgray bg-surface-2 p-4 text-xs font-medium text-navy transition-colors hover:border-slate"
              >
                <Upload className="h-4 w-4 text-slate" /> {file ? "Choose a different file" : "Choose a PDF or Word resume (max 2 MB)"}
              </button>
              {file && (
                <p className="flex items-center gap-1 text-xs font-semibold text-emerald">
                  <Check className="h-3.5 w-3.5" /> {file.name} · {(file.size / 1024).toFixed(0)} KB
                </p>
              )}
            </div>
          )}

          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-2 border-t border-lightgray pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-lightgray px-4 py-2.5 text-xs font-semibold text-navy hover:bg-surface">
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || (source === "manual" && !file)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-gradient px-5 py-2.5 text-xs font-semibold text-white shadow-[0_4px_12px_rgba(234,88,12,0.25)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Send application to {job.company}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
