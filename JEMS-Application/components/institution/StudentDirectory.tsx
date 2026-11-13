"use client";

import { useState } from "react";
import { ChevronDown, Download, ExternalLink, Search, ShieldCheck, X } from "lucide-react";
import { Card } from "@/components/dashboard/student/ui";
import { downloadCsv } from "@/lib/csv";
import type { InstitutionStudentsData, PlacementStage } from "@/lib/db/institution";
import { InstitutionHead, STATUS_PILL, Select, StatTiles, distinct, fieldClass, fmtDate } from "./ui";

const STAGES: PlacementStage[] = ["Placed", "In process", "Applied", "Not applied"];
const BANDS: { label: string; min: number; max: number }[] = [
  { label: "0–39%", min: 0, max: 39 },
  { label: "40–59%", min: 40, max: 59 },
  { label: "60–79%", min: 60, max: 79 },
  { label: "80–100%", min: 80, max: 100 },
];
type SortKey = "readiness" | "verifiedSkills" | "modulesPassed" | "applications" | "name";

/**
 * Every student of the institution with readiness, verified skills, roadmap
 * progress, applications and program enrolments — filterable, sortable and
 * exportable for the placement cell. Rows expand to the full record.
 */
export default function StudentDirectory({ data }: { data: InstitutionStudentsData }) {
  const all = data.students;
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [stage, setStage] = useState("");
  const [band, setBand] = useState("");
  const [skill, setSkill] = useState("");
  const [company, setCompany] = useState("");
  const [inProgram, setInProgram] = useState(false);
  const [sort, setSort] = useState<SortKey>("readiness");
  const [open, setOpen] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const b = BANDS.find((x) => x.label === band);
  const visible = all
    .filter(
      (s) =>
        (!q || `${s.name} ${s.email} ${s.targetRole}`.toLowerCase().includes(q)) &&
        (!role || s.targetRole === role) &&
        (!stage || s.stage === stage) &&
        (!b || (s.readiness >= b.min && s.readiness <= b.max)) &&
        (!skill || s.skills.some((x) => x.verified && x.name === skill)) &&
        (!company || s.applications.some((a) => a.company === company)) &&
        (!inProgram || s.programs.length > 0),
    )
    .sort((x, y) => (sort === "name" ? x.name.localeCompare(y.name) : sort === "applications" ? y.applications.length - x.applications.length : y[sort] - x[sort]));

  const active = [query, role, stage, band, skill, company].filter(Boolean).length + Number(inProgram);
  const clear = () => { setQuery(""); setRole(""); setStage(""); setBand(""); setSkill(""); setCompany(""); setInProgram(false); };

  const exportCsv = () =>
    downloadCsv(
      `${data.institution.replace(/\W+/g, "-").toLowerCase()}-students.csv`,
      ["Name", "Email", "Target role", "Readiness %", "Verified skills", "Skills", "Modules passed", "Applications", "Best status", "Placement stage", "Programs", "Last active"],
      visible.map((s) => [
        s.name, s.email, s.targetRole, s.readiness, s.verifiedSkills, s.skills.map((x) => `${x.name}${x.verified ? " ✓" : ""}`), s.modulesPassed,
        s.applications.length, s.bestStatus, s.stage, s.programs.map((p) => `${p.title} (${p.status})`), fmtDate(s.lastActive),
      ]),
    );

  return (
    <div className="space-y-6">
      <InstitutionHead institution={data.institution} title="Students" hint="Your full cohort — skills, readiness, applications and program enrolments, live from student activity." />

      <StatTiles
        tiles={[
          { label: "Students", value: all.length, sub: `${all.filter((s) => s.targetRole !== "—").length} with a target role` },
          { label: "Avg. readiness", value: `${all.length ? Math.round(all.reduce((n, s) => n + s.readiness, 0) / all.length) : 0}%` },
          { label: "Placed", value: all.filter((s) => s.stage === "Placed").length, sub: `${all.filter((s) => s.stage === "In process").length} in process` },
          { label: "Not applied yet", value: all.filter((s) => s.stage === "Not applied").length, sub: "candidates for placement drives" },
        ]}
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-navy">Search</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mediumgray" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, email or target role" className={`${fieldClass} pl-9`} />
            </span>
          </label>
          <Select label="Target role" value={role} onChange={setRole} options={distinct(all.map((s) => s.targetRole))} all="Any role" />
          <Select label="Placement stage" value={stage} onChange={setStage} options={STAGES} all="Any stage" />
          <Select label="Readiness" value={band} onChange={setBand} options={BANDS.map((x) => x.label)} all="Any readiness" />
          <Select label="Verified skill" value={skill} onChange={setSkill} options={distinct(all.flatMap((s) => s.skills.filter((x) => x.verified).map((x) => x.name)))} all="Any skill" />
          <Select label="Applied to company" value={company} onChange={setCompany} options={distinct(all.flatMap((s) => s.applications.map((a) => a.company)))} all="Any company" />
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-navy">Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={fieldClass}>
              <option value="readiness">Readiness</option>
              <option value="verifiedSkills">Verified skills</option>
              <option value="modulesPassed">Modules passed</option>
              <option value="applications">Applications</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-lightgray pt-3">
          <label className="flex items-center gap-2 text-xs text-navy">
            <input type="checkbox" checked={inProgram} onChange={(e) => setInProgram(e.target.checked)} className="h-4 w-4 accent-[#ea580c]" /> In an industry program
          </label>
          {active > 0 && (
            <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-xs font-semibold text-slate hover:underline"><X className="h-3.5 w-3.5" /> Clear {active} filter{active > 1 ? "s" : ""}</button>
          )}
          <button type="button" onClick={exportCsv} disabled={visible.length === 0} className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-lightgray px-2.5 py-1.5 text-xs font-semibold text-navy hover:border-slate hover:text-slate disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </Card>

      <Card>
        <div className="border-b border-lightgray px-5 py-3.5 text-sm font-semibold text-navy">{visible.length} of {all.length} students</div>
        <ul className="divide-y divide-lightgray">
          {visible.length === 0 && <li className="px-5 py-8 text-center text-sm text-mediumgray">{all.length === 0 ? "No students are linked to this institution yet." : "No students match these filters."}</li>}
          {visible.map((s) => {
            const isOpen = open === s.id;
            return (
              <li key={s.id}>
                <button type="button" onClick={() => setOpen(isOpen ? null : s.id)} className="flex w-full flex-col gap-2 px-5 py-3 text-left hover:bg-surface-2 md:flex-row md:items-center">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <ChevronDown className={`h-4 w-4 shrink-0 text-mediumgray transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-navy">{s.name}</span>
                      <span className="block truncate text-[11px] text-mediumgray">{s.targetRole} · {s.email}</span>
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-4 text-xs text-navy">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-lightgray"><span className="block h-full rounded-r-[4px] bg-slate" style={{ width: `${s.readiness}%` }} /></span>
                      <span className="w-9 tabular-nums">{s.readiness}%</span>
                    </span>
                    <span className="inline-flex w-20 items-center gap-1 tabular-nums"><ShieldCheck className="h-3.5 w-3.5 text-emerald" />{s.verifiedSkills} verified</span>
                    <span className="w-20 tabular-nums">{s.modulesPassed} modules</span>
                    <span className="w-16 tabular-nums">{s.applications.length} apps</span>
                    <span className={`w-24 rounded-full px-2 py-0.5 text-center text-[10px] font-semibold ${STATUS_PILL(s.stage)}`}>{s.stage}</span>
                  </span>
                </button>
                {isOpen && (
                  <div className="grid grid-cols-1 gap-4 border-t border-lightgray bg-surface-2/50 px-5 py-4 lg:grid-cols-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate">Skills</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {s.skills.length === 0 && <span className="text-xs text-mediumgray">No skills listed.</span>}
                        {s.skills.map((x) => (
                          <span key={x.name} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${x.verified ? "bg-emerald/10 text-emerald" : "bg-white text-navy"}`}>{x.verified ? "✓ " : ""}{x.name}</span>
                        ))}
                      </div>
                      <a href={`/view/student/${s.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate hover:underline">Full profile & progress <ExternalLink className="h-3 w-3" /></a>
                      <p className="mt-1 text-[11px] text-mediumgray">Last active {fmtDate(s.lastActive)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate">Applications ({s.applications.length})</p>
                      <ul className="mt-2 space-y-1.5">
                        {s.applications.length === 0 && <li className="text-xs text-mediumgray">Hasn&apos;t applied anywhere yet.</li>}
                        {s.applications.map((a) => (
                          <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate text-navy">{a.role} <span className="text-mediumgray">· {a.company}</span></span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_PILL(a.status)}`}>{a.status}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate">Industry programs ({s.programs.length})</p>
                      <ul className="mt-2 space-y-1.5">
                        {s.programs.length === 0 && <li className="text-xs text-mediumgray">Not enrolled in any program.</li>}
                        {s.programs.map((p) => (
                          <li key={p.programId} className="flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate text-navy">{p.title} <span className="text-mediumgray">· {p.company}</span></span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_PILL(p.status)}`}>{p.status}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
