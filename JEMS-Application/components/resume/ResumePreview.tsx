"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Check, FileText, TriangleAlert } from "lucide-react";
import type { ResumeData } from "./types";

function fmtMonth(value: string): string {
  if (!value) return "";
  const [y, m] = value.split("-");
  if (!y || !m) return value;
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function dateRange(start: string, end: string, current: boolean): string {
  const s = fmtMonth(start);
  const e = current ? "Present" : fmtMonth(end);
  if (!s && !e) return "";
  return [s, e].filter(Boolean).join(" – ");
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="mb-1.5 border-b border-gray-300 pb-0.5 text-[10.5px] font-bold uppercase tracking-wider text-gray-700">
      {children}
    </h2>
  );
}

/** A4 is 210 × 297 mm. */
const A4_RATIO = 297 / 210;
/** Below this the text stops being comfortably readable, so we warn instead of shrinking further. */
const MIN_ZOOM = 0.72;

/** Real-time single-page A4 preview of the resume. */
export default function ResumePreview({ data }: { data: ResumeData }) {
  const [onePageFit, setOnePageFit] = useState(true);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  // How much the content would still overflow one page at MIN_ZOOM (0 = fits).
  const [overflow, setOverflow] = useState(0);

  // Shrink the content until it fits one A4 page, re-measuring on every edit and resize.
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    const content = contentRef.current;
    if (!sheet || !content) return;
    const measure = () => {
      if (!onePageFit) {
        setZoom(1);
        setOverflow(0);
        return;
      }
      const style = getComputedStyle(sheet);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const page = sheet.clientWidth * A4_RATIO - padY;
      const current = Number(content.style.zoom) || 1;
      const natural = content.scrollHeight / current;
      const next = Math.max(MIN_ZOOM, Math.min(1, page / natural));
      setZoom((z) => (Math.abs(z - next) > 0.005 ? next : z));
      setOverflow(natural * MIN_ZOOM > page ? Math.round(((natural * MIN_ZOOM) / page - 1) * 100) : 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(sheet);
    return () => ro.disconnect();
  }, [data, onePageFit]);

  const h = data.header;
  const contact = [h.email, h.phone, h.location, h.portfolio, h.linkedin].filter(Boolean);

  const skills = data.skills.filter((s) => s.name.trim());
  const experience = data.experience.filter((e) => e.company.trim() || e.jobTitle.trim());
  const education = data.education.filter((e) => e.school.trim() || e.degree.trim());
  const certs = data.certifications.filter((c) => c.name.trim());
  const projects = data.projects.filter((p) => p.name.trim());

  return (
    <div className="space-y-3">
      {/* 1-Page Layout Controls */}
      <div className="no-print flex items-center justify-between rounded-lg border border-lightgray bg-white px-3.5 py-2 text-xs">
        <span className="flex items-center gap-1.5 font-medium text-navy">
          <FileText className="h-4 w-4 text-slate" />
          Single Page Layout
        </span>
        <button
          type="button"
          onClick={() => setOnePageFit((v) => !v)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition-colors ${
            onePageFit
              ? "bg-emerald/10 text-emerald border border-emerald/30"
              : "border border-lightgray text-mediumgray hover:text-navy"
          }`}
        >
          {onePageFit ? <Check className="h-3.5 w-3.5" /> : null}
          {onePageFit ? "1-Page Fit: Enabled" : "1-Page Fit: Off"}
        </button>
      </div>

      <div
        ref={sheetRef}
        data-one-page={onePageFit ? "true" : undefined}
        className={`resume-print mx-auto w-full max-w-[680px] bg-white text-gray-800 shadow-[0_4px_24px_rgba(0,0,0,0.12)] ${
          onePageFit ? "overflow-hidden p-6 sm:p-8 [aspect-ratio:210/297]" : "min-h-[1050px] p-10"
        }`}
      >
        <div ref={contentRef} style={{ zoom }}>
        {/* Header */}
        <header className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
            {h.fullName || "Your Name"}
          </h1>
          {h.title && <p className="mt-0.5 text-xs sm:text-sm font-medium text-slate">{h.title}</p>}
          {contact.length > 0 && (
            <p className="mt-1.5 text-[10.5px] leading-4 text-gray-600">
              {contact.join("  •  ")}
            </p>
          )}
        </header>

        {data.summary.trim() && (
          <section className="mt-3.5">
            <SectionTitle>Summary</SectionTitle>
            <p className="text-[11px] leading-4 text-gray-700">{data.summary}</p>
          </section>
        )}

        {experience.length > 0 && (
          <section className="mt-3.5">
            <SectionTitle>Experience</SectionTitle>
            <div className="space-y-2">
              {experience.map((e) => (
                <div key={e.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[11.5px] font-semibold text-gray-900">
                      {e.jobTitle || "Role"}
                      {e.company && <span className="font-normal text-gray-600"> · {e.company}</span>}
                    </p>
                    <p className="shrink-0 text-[10px] text-gray-500">
                      {dateRange(e.start, e.end, e.current)}
                    </p>
                  </div>
                  {e.description && (
                    <p className="mt-0.5 text-[10.5px] leading-4 text-gray-700">{e.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {education.length > 0 && (
          <section className="mt-3.5">
            <SectionTitle>Education</SectionTitle>
            <div className="space-y-1.5">
              {education.map((e) => (
                <div key={e.id} className="flex items-baseline justify-between gap-2">
                  <p className="text-[11px] text-gray-800">
                    <span className="font-semibold text-gray-900">{e.school || "School"}</span>
                    {(e.degree || e.field) && (
                      <span className="text-gray-600">
                        {" "}
                        — {[e.degree, e.field].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </p>
                  <p className="shrink-0 text-[10px] text-gray-500">{fmtMonth(e.gradDate)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {skills.length > 0 && (
          <section className="mt-3.5">
            <SectionTitle>Skills</SectionTitle>
            <div className="flex flex-wrap gap-1">
              {skills.map((s) => (
                <span
                  key={s.id}
                  title={s.verified ? "Verified by JEMS" : undefined}
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    s.verified
                      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {s.verified ? "✓ " : ""}{s.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {projects.length > 0 && (
          <section className="mt-3.5">
            <SectionTitle>Projects</SectionTitle>
            <div className="space-y-1.5">
              {projects.map((p) => (
                <div key={p.id}>
                  <p className="text-[11px] font-semibold text-gray-900">
                    {p.name}
                    {p.link && <span className="font-normal text-gray-500"> · {p.link}</span>}
                  </p>
                  {p.description && <p className="text-[10.5px] leading-4 text-gray-700">{p.description}</p>}
                  {p.tech && <p className="text-[9.5px] italic text-gray-500">{p.tech}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {certs.length > 0 && (
          <section className="mt-3.5">
            <SectionTitle>Certifications</SectionTitle>
            <div className="space-y-1">
              {certs.map((c) => (
                <div key={c.id} className="flex items-baseline justify-between gap-2">
                  <p className="text-[11px] text-gray-800">
                    <span className="font-medium text-gray-900">{c.name}</span>
                    {c.org && <span className="text-gray-600"> · {c.org}</span>}
                  </p>
                  <p className="shrink-0 text-[10px] text-gray-500">{fmtMonth(c.issueDate)}</p>
                </div>
              ))}
            </div>
          </section>
        )}
        </div>
      </div>

      {/* 1 Page boundary info banner */}
      {onePageFit && overflow > 0 ? (
        <p className="no-print flex items-center justify-center gap-1.5 text-center text-[11px] font-medium text-amber-700">
          <TriangleAlert className="h-3.5 w-3.5" /> About {overflow}% too long for one page — shorten descriptions or remove older items. The cut-off part won&apos;t print.
        </p>
      ) : (
        <div className="no-print text-center text-[11px] text-mediumgray">
          {onePageFit && zoom < 1 ? `Scaled to ${Math.round(zoom * 100)}% to fit one page • ` : ""}Single page ATS-friendly template • A4 (210mm × 297mm)
        </div>
      )}
    </div>
  );
}
