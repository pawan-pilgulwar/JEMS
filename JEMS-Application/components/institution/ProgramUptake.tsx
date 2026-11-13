"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, Search, Users } from "lucide-react";
import { Card } from "@/components/dashboard/student/ui";
import type { InstitutionStudentsData } from "@/lib/db/institution";
import { InstitutionHead, STATUS_PILL, Select, StatTiles, distinct, fieldClass, fmtDate } from "./ui";

/**
 * Industry learning programs and how your students are taking them up:
 * who applied, who was accepted, and how many could benefit from the skills
 * each program teaches — so the placement cell can nudge the right students.
 */
export default function ProgramUptake({ data }: { data: InstitutionStudentsData }) {
  const programs = data.programs;
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("");
  const [type, setType] = useState("");
  const [onlyOurs, setOnlyOurs] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const visible = programs
    .filter(
      (p) =>
        (!q || `${p.title} ${p.company} ${p.skills.join(" ")}`.toLowerCase().includes(q)) &&
        (!company || p.company === company) &&
        (!type || p.type === type) &&
        (!onlyOurs || p.ourStudents.length > 0),
    )
    .sort((a, b) => b.ourStudents.length - a.ourStudents.length || b.couldBenefit - a.couldBenefit);

  const enrolments = programs.flatMap((p) => p.ourStudents);
  const students = new Set(enrolments.map((e) => e.id));

  return (
    <div className="space-y-6">
      <InstitutionHead institution={data.institution} title="Industry programs" hint="Training, certifications and workshops from industry partners — and which of your students joined." />

      <StatTiles
        tiles={[
          { label: "Programs available", value: programs.filter((p) => p.status === "open").length, sub: `${distinct(programs.map((p) => p.company)).length} companies` },
          { label: "Student applications", value: enrolments.length },
          { label: "Students participating", value: students.size, sub: `${data.students.length ? Math.round((students.size / data.students.length) * 100) : 0}% of the cohort` },
          { label: "Accepted / completed", value: enrolments.filter((e) => /accepted|completed/i.test(e.status)).length },
        ]}
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-navy">Search</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mediumgray" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Program, company, skill" className={`${fieldClass} pl-9`} />
            </span>
          </label>
          <Select label="Company" value={company} onChange={setCompany} options={distinct(programs.map((p) => p.company))} all="All companies" />
          <Select label="Type" value={type} onChange={setType} options={distinct(programs.map((p) => p.type))} all="All types" />
          <label className="flex items-end gap-2 pb-2.5 text-xs text-navy">
            <input type="checkbox" checked={onlyOurs} onChange={(e) => setOnlyOurs(e.target.checked)} className="h-4 w-4 accent-[#ea580c]" /> Only with our students
          </label>
        </div>
      </Card>

      <div className="space-y-3">
        {visible.length === 0 && <Card className="p-8 text-center text-sm text-mediumgray">No programs match these filters.</Card>}
        {visible.map((p) => {
          const isOpen = open === p.id;
          return (
            <Card key={p.id}>
              <button type="button" onClick={() => setOpen(isOpen ? null : p.id)} className="flex w-full flex-col gap-3 px-5 py-4 text-left md:flex-row md:items-center">
                <span className="flex min-w-0 flex-1 items-start gap-2">
                  <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-mediumgray transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-navy">{p.title}</span>
                      <span className="rounded-full bg-slate/10 px-2 py-0.5 text-[10px] font-semibold text-slate">{p.type}</span>
                      {p.status === "closed" && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">Closed</span>}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-mediumgray">
                      <span>{p.company}</span>
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{fmtDate(p.startsAt)}</span>
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{p.seats || "Open"} seats</span>
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1">{p.skills.map((s) => <span key={s} className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium text-navy">{s}</span>)}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-5 text-center">
                  <span><span className="block text-lg font-bold text-navy">{p.ourStudents.length}</span><span className="text-[10px] text-mediumgray">our applicants</span></span>
                  <span><span className="block text-lg font-bold text-emerald">{p.ourStudents.filter((s) => /accepted|completed/i.test(s.status)).length}</span><span className="text-[10px] text-mediumgray">accepted</span></span>
                  <span title="Students missing at least one skill this program teaches"><span className="block text-lg font-bold text-orange">{p.couldBenefit}</span><span className="text-[10px] text-mediumgray">could benefit</span></span>
                </span>
              </button>
              {isOpen && (
                <ul className="divide-y divide-lightgray border-t border-lightgray">
                  {p.ourStudents.length === 0 && <li className="px-5 py-4 text-center text-xs text-mediumgray">None of your students have applied yet.</li>}
                  {p.ourStudents.map((s) => (
                    <li key={s.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                      <a href={`/view/student/${s.id}`} className="font-medium text-navy hover:text-slate hover:underline">{s.name}</a>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_PILL(s.status)}`}>{s.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
