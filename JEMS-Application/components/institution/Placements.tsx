"use client";

import { useMemo, useState } from "react";
import { Download, Search, X } from "lucide-react";
import { Card } from "@/components/dashboard/student/ui";
import { downloadCsv } from "@/lib/csv";
import type { InstitutionStudentsData } from "@/lib/db/institution";
import { InstitutionHead, STATUS_PILL, Select, StatTiles, distinct, fieldClass, fmtDate } from "./ui";

const isOffer = (s: string) => /offer|selected/i.test(s);
const isActive = (s: string) => /review|shortlist|interview/i.test(s);

/**
 * Every application your students have made, across all companies: a
 * company-wise summary for the placement cell and the full, filterable log.
 */
export default function Placements({ data }: { data: InstitutionStudentsData }) {
  const apps = useMemo(() => data.students.flatMap((s) => s.applications.map((a) => ({ ...a, targetRole: s.targetRole, readiness: s.readiness }))), [data.students]);
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");

  const q = query.trim().toLowerCase();
  const visible = apps.filter(
    (a) =>
      (!q || `${a.studentName} ${a.company} ${a.role}`.toLowerCase().includes(q)) &&
      (!company || a.company === company) &&
      (!role || a.role === role) &&
      (!type || a.type === type) &&
      (!status || a.status === status),
  );

  const byCompany = useMemo(() => {
    const m = new Map<string, { company: string; applications: number; students: Set<string>; active: number; offers: number; roles: Set<string> }>();
    for (const a of visible) {
      const r = m.get(a.company) ?? { company: a.company, applications: 0, students: new Set<string>(), active: 0, offers: 0, roles: new Set<string>() };
      r.applications += 1;
      r.students.add(a.studentId);
      r.roles.add(a.role);
      if (isActive(a.status)) r.active += 1;
      if (isOffer(a.status)) r.offers += 1;
      m.set(a.company, r);
    }
    return Array.from(m.values()).sort((x, y) => y.offers - x.offers || y.applications - x.applications);
  }, [visible]);

  const placed = new Set(apps.filter((a) => isOffer(a.status)).map((a) => a.studentId)).size;
  const active = [query, company, role, type, status].filter(Boolean).length;
  const clear = () => { setQuery(""); setCompany(""); setRole(""); setType(""); setStatus(""); };

  return (
    <div className="space-y-6">
      <InstitutionHead institution={data.institution} title="Placements" hint="Where your students are applying, how far they've progressed, and who's been placed." />

      <StatTiles
        tiles={[
          { label: "Applications", value: apps.length, sub: `${new Set(apps.map((a) => a.studentId)).size} students applying` },
          { label: "Companies", value: new Set(apps.map((a) => a.company)).size },
          { label: "In interview stages", value: apps.filter((a) => isActive(a.status)).length },
          { label: "Students placed", value: placed, sub: `${data.students.length ? Math.round((placed / data.students.length) * 100) : 0}% of the cohort · ${apps.filter((a) => isOffer(a.status)).length} offers` },
        ]}
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <label className="block md:col-span-3 xl:col-span-1">
            <span className="mb-1.5 block text-xs font-semibold text-navy">Search</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mediumgray" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Student, company, role" className={`${fieldClass} pl-9`} />
            </span>
          </label>
          <Select label="Company" value={company} onChange={setCompany} options={distinct(apps.map((a) => a.company))} all="All companies" />
          <Select label="Job role" value={role} onChange={setRole} options={distinct(apps.filter((a) => !company || a.company === company).map((a) => a.role))} all="All roles" />
          <Select label="Type" value={type} onChange={setType} options={distinct(apps.map((a) => a.type))} all="All types" />
          <Select label="Status" value={status} onChange={setStatus} options={distinct(apps.map((a) => a.status))} all="All statuses" />
        </div>
        {active > 0 && (
          <button type="button" onClick={clear} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate hover:underline"><X className="h-3.5 w-3.5" /> Clear {active} filter{active > 1 ? "s" : ""}</button>
        )}
      </Card>

      <Card>
        <div className="border-b border-lightgray px-5 py-3.5 text-sm font-semibold text-navy">By company</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-mediumgray">
                <th className="px-5 py-2.5 font-semibold">Company</th>
                <th className="px-5 py-2.5 font-semibold">Roles</th>
                <th className="px-5 py-2.5 font-semibold">Applications</th>
                <th className="px-5 py-2.5 font-semibold">Students</th>
                <th className="px-5 py-2.5 font-semibold">In process</th>
                <th className="px-5 py-2.5 font-semibold">Offers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lightgray">
              {byCompany.length === 0 && <tr><td colSpan={6} className="px-5 py-6 text-center text-sm text-mediumgray">No applications yet.</td></tr>}
              {byCompany.map((r) => (
                <tr key={r.company} className="cursor-pointer hover:bg-surface-2" onClick={() => setCompany(company === r.company ? "" : r.company)}>
                  <td className="px-5 py-2.5 font-medium text-navy">{r.company}</td>
                  <td className="px-5 py-2.5 text-xs text-mediumgray">{[...r.roles].join(", ")}</td>
                  <td className="px-5 py-2.5 tabular-nums text-navy">{r.applications}</td>
                  <td className="px-5 py-2.5 tabular-nums text-navy">{r.students.size}</td>
                  <td className="px-5 py-2.5 tabular-nums text-slate">{r.active}</td>
                  <td className="px-5 py-2.5 tabular-nums font-semibold text-emerald">{r.offers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-lightgray px-5 py-3.5">
          <span className="text-sm font-semibold text-navy">Applications ({visible.length})</span>
          <button
            type="button"
            disabled={visible.length === 0}
            onClick={() => downloadCsv(`${data.institution.replace(/\W+/g, "-").toLowerCase()}-placements.csv`, ["Student", "Target role", "Readiness %", "Company", "Role", "Type", "Status", "Applied on"], visible.map((a) => [a.studentName, a.targetRole, a.readiness, a.company, a.role, a.type, a.status, fmtDate(a.appliedAt)]))}
            className="inline-flex items-center gap-1.5 rounded-md border border-lightgray px-2.5 py-1.5 text-xs font-semibold text-navy hover:border-slate hover:text-slate disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-mediumgray">
                <th className="px-5 py-2.5 font-semibold">Student</th>
                <th className="px-5 py-2.5 font-semibold">Company</th>
                <th className="px-5 py-2.5 font-semibold">Role</th>
                <th className="px-5 py-2.5 font-semibold">Type</th>
                <th className="px-5 py-2.5 font-semibold">Applied</th>
                <th className="px-5 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lightgray">
              {visible.length === 0 && <tr><td colSpan={6} className="px-5 py-6 text-center text-sm text-mediumgray">{apps.length === 0 ? "Your students haven't applied anywhere yet." : "No applications match these filters."}</td></tr>}
              {visible.map((a) => (
                <tr key={a.id} className="hover:bg-surface-2">
                  <td className="px-5 py-2.5">
                    <a href={`/view/student/${a.studentId}`} className="font-medium text-navy hover:text-slate hover:underline">{a.studentName}</a>
                    <span className="block text-[11px] text-mediumgray">{a.targetRole} · readiness {a.readiness}%</span>
                  </td>
                  <td className="px-5 py-2.5 text-navy">{a.company}</td>
                  <td className="px-5 py-2.5 text-navy">{a.role}</td>
                  <td className="px-5 py-2.5 text-xs text-mediumgray">{a.type}</td>
                  <td className="px-5 py-2.5 text-xs text-mediumgray">{fmtDate(a.appliedAt)}</td>
                  <td className="px-5 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_PILL(a.status)}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
