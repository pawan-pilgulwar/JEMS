"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Download, Mail, Search } from "lucide-react";
import { Card } from "@/components/dashboard/student/ui";
import { downloadCsv } from "@/lib/csv";
import type { InstitutionFacultyRow } from "@/lib/db/institution";
import { InstitutionHead, STATUS_PILL, Select, StatTiles, distinct, fieldClass, fmtDate } from "./ui";

/**
 * The institution's faculty and their industry engagement: which FDPs,
 * internships, research and consultancy calls each has expressed interest in,
 * and whether the company accepted.
 */
export default function FacultyEngagement({ institution, departments, faculty }: { institution: string; departments: string[]; faculty: InstitutionFacultyRow[] }) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [type, setType] = useState("");
  const [engagement, setEngagement] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const visible = faculty.filter(
    (f) =>
      (!q || `${f.name} ${f.email} ${f.designation} ${f.interests.join(" ")}`.toLowerCase().includes(q)) &&
      (!department || f.department === department) &&
      (!type || f.collaborations.some((c) => c.type === type)) &&
      (!engagement ||
        (engagement === "Engaged" ? f.collaborations.length > 0 : engagement === "Accepted by industry" ? f.collaborations.some((c) => c.status === "Accepted") : f.collaborations.length === 0)),
  );
  const all = faculty.flatMap((f) => f.collaborations);

  const deptStats = distinct([...departments, ...faculty.map((f) => f.department)]).map((d) => {
    const list = faculty.filter((f) => f.department === d);
    return { department: d, faculty: list.length, engaged: list.filter((f) => f.collaborations.length > 0).length };
  });

  return (
    <div className="space-y-6">
      <InstitutionHead institution={institution} title="Faculty" hint="Your academicians' industry engagement — interest they've expressed and what companies accepted." />

      <StatTiles
        tiles={[
          { label: "Faculty", value: faculty.length, sub: `${deptStats.filter((d) => d.faculty > 0).length} departments` },
          { label: "Engaged with industry", value: faculty.filter((f) => f.collaborations.length > 0).length },
          { label: "Interests expressed", value: all.length },
          { label: "Accepted by industry", value: all.filter((c) => c.status === "Accepted").length, sub: `${all.filter((c) => c.status === "Declined").length} declined` },
        ]}
      />

      {deptStats.length > 0 && (
        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold text-navy">By department</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {deptStats.map((d) => (
              <button key={d.department} type="button" onClick={() => setDepartment(department === d.department ? "" : d.department)} className={`rounded-lg border p-3 text-left transition-colors ${department === d.department ? "border-slate bg-slate/5" : "border-lightgray hover:border-slate"}`}>
                <p className="truncate text-xs font-semibold text-navy">{d.department}</p>
                <p className="mt-1 text-[11px] text-mediumgray">{d.faculty} faculty · {d.engaged} engaged</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-lightgray"><div className="h-full rounded-full bg-slate" style={{ width: `${d.faculty ? (d.engaged / d.faculty) * 100 : 0}%` }} /></div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-navy">Search</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mediumgray" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, designation, research interest" className={`${fieldClass} pl-9`} />
            </span>
          </label>
          <Select label="Department" value={department} onChange={setDepartment} options={deptStats.map((d) => d.department)} all="All departments" />
          <Select label="Collaboration type" value={type} onChange={setType} options={distinct(all.map((c) => c.type))} all="Any type" />
          <Select label="Engagement" value={engagement} onChange={setEngagement} options={["Engaged", "Accepted by industry", "Not engaged"]} all="Everyone" />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-lightgray px-5 py-3.5">
          <span className="text-sm font-semibold text-navy">{visible.length} of {faculty.length} faculty</span>
          <button
            type="button"
            disabled={visible.length === 0}
            onClick={() => downloadCsv(`${institution.replace(/\W+/g, "-").toLowerCase()}-faculty.csv`, ["Name", "Email", "Designation", "Department", "Research interests", "Collaborations", "Accepted", "Curriculum reviews"], visible.map((f) => [f.name, f.email, f.designation, f.department, f.interests, f.collaborations.map((c) => `${c.title} (${c.status})`), f.collaborations.filter((c) => c.status === "Accepted").length, f.curriculumReviews]))}
            className="inline-flex items-center gap-1.5 rounded-md border border-lightgray px-2.5 py-1.5 text-xs font-semibold text-navy hover:border-slate hover:text-slate disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
        <ul className="divide-y divide-lightgray">
          {visible.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-mediumgray">
              {faculty.length === 0 ? "No faculty are linked to this institution yet — faculty appear once the institution on their profile matches this name." : "No faculty match these filters."}
            </li>
          )}
          {visible.map((f) => {
            const isOpen = open === f.id;
            return (
              <li key={f.id}>
                <button type="button" onClick={() => setOpen(isOpen ? null : f.id)} className="flex w-full flex-col gap-2 px-5 py-3 text-left hover:bg-surface-2 md:flex-row md:items-center">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <ChevronDown className={`h-4 w-4 shrink-0 text-mediumgray transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-navy">{f.name}</span>
                      <span className="block truncate text-[11px] text-mediumgray">{[f.designation, f.department].filter(Boolean).join(" · ")}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-4 text-xs text-navy">
                    <span className="tabular-nums">{f.collaborations.length} interests</span>
                    <span className="tabular-nums text-emerald">{f.collaborations.filter((c) => c.status === "Accepted").length} accepted</span>
                    <span className="tabular-nums text-mediumgray">{f.curriculumReviews} curriculum reviews</span>
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-lightgray bg-surface-2/50 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {f.interests.map((i) => <span key={i} className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-navy">{i}</span>)}
                      <span className="ml-auto flex items-center gap-3">
                        <Link href={`/view/faculty/${f.id}`} className="text-xs font-semibold text-slate hover:underline">View profile</Link>
                        {f.email && <a href={`mailto:${f.email}`} className="inline-flex items-center gap-1 text-xs font-semibold text-slate hover:underline"><Mail className="h-3.5 w-3.5" /> {f.email}</a>}
                      </span>
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {f.collaborations.length === 0 && <li className="text-xs text-mediumgray">No industry interest expressed yet. <Link href="/institution/collaborations" className="font-semibold text-slate hover:underline">See open collaborations</Link></li>}
                      {f.collaborations.map((c) => (
                        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-xs">
                          <span className="min-w-0">
                            <span className="font-semibold text-navy">{c.title}</span>
                            <span className="text-mediumgray"> · {c.company} · {c.type} · starts {fmtDate(c.startsAt)}</span>
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_PILL(c.status)}`}>{c.status}</span>
                        </li>
                      ))}
                    </ul>
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
