"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, Download, GraduationCap, Handshake, LoaderCircle, Lock, LockOpen, Mail, MapPin, Plus, Search, ShieldCheck, Users, X } from "lucide-react";
import { Card } from "@/components/dashboard/student/ui";
import LiveRefresh from "@/components/portal/LiveRefresh";
import { COLLABORATION_TYPES, ENROLLMENT_STATUSES, INTEREST_STATUSES, PROGRAM_TYPES } from "@/lib/company/constants";
import { downloadCsv } from "@/lib/csv";
import type { CompanyCollaborationView } from "@/lib/db/collaborations";
import type { CompanyProgramView } from "@/lib/db/programs";
import { Field, PageHead, fmtDate, inputClass, primaryBtn, secondaryBtn, textareaClass } from "./ui";

type Kind = "program" | "collaboration";
const EMPTY = { title: "", type: "", skills: "", domain: "", duration: "", mode: "Online", location: "", seats: "50", startsAt: "", description: "" };

const ENROLL_STYLE = (s: string) =>
  /accepted|completed/i.test(s) ? "bg-emerald/10 text-emerald" : /waitlist/i.test(s) ? "bg-amber-50 text-amber-700" : /reject|declined/i.test(s) ? "bg-red-50 text-red-600" : "bg-slate/10 text-slate";
const smallSelect = "h-8 rounded-md border border-lightgray bg-white px-2 text-xs text-navy outline-none focus:border-slate disabled:opacity-60";

async function patch(url: string, status: string) {
  const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Could not update.");
}

/**
 * What the company publishes beyond openings: learning programs students
 * apply to (with the applicant list, seat tracking and decisions) and
 * collaboration formats for academicians (with every faculty member who
 * expressed interest, accept / decline).
 */
export default function Programs({
  company,
  programs,
  collaborations,
  initialTab,
  focus,
}: {
  company: string;
  programs: CompanyProgramView[];
  collaborations: CompanyCollaborationView[];
  initialTab: Kind;
  /** Program / collaboration to open on load (deep link from a notification). */
  focus: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Kind>(initialTab);
  const [kind, setKind] = useState<Kind>(initialTab);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY, type: (initialTab === "program" ? PROGRAM_TYPES[0] : COLLABORATION_TYPES[0]) as string });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(focus);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const switchKind = (k: Kind) => { setKind(k); setForm((f) => ({ ...f, type: k === "program" ? PROGRAM_TYPES[0] : COLLABORATION_TYPES[0] })); };
  const switchTab = (k: Kind) => { setTab(k); setStatusFilter(""); setQuery(""); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/company/programs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, ...form, seats: Number(form.seats) }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not publish.");
      setForm({ ...EMPTY, type: kind === "program" ? PROGRAM_TYPES[0] : COLLABORATION_TYPES[0] });
      setShowForm(false);
      setTab(kind);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish.");
    } finally {
      setSaving(false);
    }
  };

  const act = async (id: string, url: string, status: string) => {
    setBusy(id);
    setActionError("");
    try {
      await patch(url, status);
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update.");
    } finally {
      setBusy(null);
    }
  };

  const totals = {
    programApplicants: programs.reduce((n, p) => n + p.applicants.length, 0),
    accepted: programs.reduce((n, p) => n + p.accepted, 0),
    interested: collaborations.reduce((n, c) => n + c.people.length, 0),
    facultyAccepted: collaborations.reduce((n, c) => n + c.accepted, 0),
  };

  const q = query.trim().toLowerCase();
  const statuses = tab === "program" ? ENROLLMENT_STATUSES : INTEREST_STATUSES;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHead company={company} title="Programs & collaborations" hint="See who applied to your learning programs and which academicians are interested in your collaborations — and decide on each." />
        <div className="flex flex-wrap items-center gap-2">
          <LiveRefresh />
          <button type="button" onClick={() => setShowForm((v) => !v)} className={showForm ? secondaryBtn : primaryBtn}>
            {showForm ? <><X className="h-4 w-4" /> Cancel</> : <><Plus className="h-4 w-4" /> Publish</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Learning programs", value: programs.length, sub: `${programs.filter((p) => p.status === "open").length} open`, icon: GraduationCap },
          { label: "Student applicants", value: totals.programApplicants, sub: `${totals.accepted} accepted`, icon: Users },
          { label: "Collaborations", value: collaborations.length, sub: `${collaborations.filter((c) => c.status === "open").length} open`, icon: Handshake },
          { label: "Faculty interested", value: totals.interested, sub: `${totals.facultyAccepted} accepted`, icon: ShieldCheck },
        ].map((t) => (
          <Card key={t.label} className="p-4">
            <div className="flex items-center justify-between"><p className="text-xs font-medium text-mediumgray">{t.label}</p><t.icon className="h-4 w-4 text-slate" /></div>
            <p className="mt-2 text-2xl font-bold text-navy">{t.value}</p>
            <p className="text-[11px] text-mediumgray">{t.sub}</p>
          </Card>
        ))}
      </div>

      {showForm && (
        <Card className="p-6">
          <div className="flex flex-wrap gap-2">
            {([["program", "Student learning program", GraduationCap], ["collaboration", "Academia collaboration", Handshake]] as const).map(([k, label, Icon]) => (
              <button key={k} type="button" onClick={() => switchKind(k)} className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${kind === k ? "bg-navy text-white" : "border border-lightgray text-mediumgray hover:text-navy"}`}><Icon className="h-4 w-4" /> {label}</button>
            ))}
          </div>
          <form onSubmit={submit} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Title *"><input required value={form.title} onChange={set("title")} placeholder={kind === "program" ? "Java & Spring Boot Bootcamp" : "FDP: Cloud-Native Architecture"} className={inputClass} /></Field>
            <Field label="Type *">
              <select value={form.type} onChange={set("type")} className={inputClass}>
                {(kind === "program" ? PROGRAM_TYPES : COLLABORATION_TYPES).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            {kind === "program" ? (
              <>
                <Field label="Skills taught *" hint="Comma-separated; these feed the Learning Agent's recommendations."><input required value={form.skills} onChange={set("skills")} placeholder="Java, Spring Boot, REST APIs" className={inputClass} /></Field>
                <Field label="Mode"><input value={form.mode} onChange={set("mode")} placeholder="Online · live / Self-paced / On campus" className={inputClass} /></Field>
              </>
            ) : (
              <>
                <Field label="Domain" hint="Comma-separated"><input value={form.domain} onChange={set("domain")} placeholder="Cloud Computing, Microservices" className={inputClass} /></Field>
                <Field label="Location"><input value={form.location} onChange={set("location")} placeholder="Bengaluru campus / Remote" className={inputClass} /></Field>
              </>
            )}
            <Field label="Duration"><input value={form.duration} onChange={set("duration")} placeholder="6 weeks / 2 days" className={inputClass} /></Field>
            <Field label="Start date *"><input required type="date" value={form.startsAt} onChange={set("startsAt")} className={inputClass} /></Field>
            <Field label="Seats" hint={kind === "program" ? "Accepted students are capped at this. 0 = unlimited." : undefined}><input type="number" min={0} value={form.seats} onChange={set("seats")} className={inputClass} /></Field>
            {kind === "collaboration" && <div className="md:col-span-2"><Field label="Description"><textarea value={form.description} onChange={set("description")} className={textareaClass} /></Field></div>}
            {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}
            <div className="md:col-span-2"><button type="submit" disabled={saving} className={primaryBtn}>{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Publish</button></div>
          </form>
        </Card>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2">
          {([["program", `Learning programs (${programs.length})`, GraduationCap], ["collaboration", `Academia collaborations (${collaborations.length})`, Handshake]] as const).map(([k, label, Icon]) => (
            <button key={k} type="button" onClick={() => switchTab(k)} className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${tab === k ? "bg-navy text-white" : "border border-lightgray bg-white text-mediumgray hover:text-navy"}`}><Icon className="h-4 w-4" /> {label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mediumgray" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tab === "program" ? "Search applicants" : "Search faculty / institution"} className={`${inputClass} w-60 pl-9`} />
          </span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} w-40`} aria-label="Filter by status">
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {tab === "program" ? (
        <div className="space-y-4">
          {programs.length === 0 && <Card className="p-8 text-center text-sm text-mediumgray">No learning programs yet — publish one so students can apply.</Card>}
          {programs.map((p) => {
            const people = p.applicants.filter((a) => (!statusFilter || a.status === statusFilter) && (!q || `${a.name} ${a.institution} ${a.targetRole}`.toLowerCase().includes(q)));
            const isOpen = open === p.id || (!!q || !!statusFilter) && people.length > 0;
            return (
              <Card key={p.id} className={p.status === "closed" ? "opacity-80" : ""}>
                <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                  <button type="button" onClick={() => setOpen(open === p.id ? null : p.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                    <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-mediumgray transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-navy">{p.title}</span>
                        <span className="rounded-full bg-slate/10 px-2 py-0.5 text-[10px] font-semibold text-slate">{p.type}</span>
                        {p.status === "closed" && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">Closed</span>}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-mediumgray">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{fmtDate(p.startsAt)}</span><span>{p.duration}</span><span>{p.mode}</span>
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1">{p.skills.map((s) => <span key={s} className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium text-navy">{s}</span>)}</span>
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-4 text-center">
                    <div><p className="text-lg font-bold text-navy">{p.applicants.length}</p><p className="text-[10px] text-mediumgray">applied</p></div>
                    <div><p className="text-lg font-bold text-emerald">{p.accepted}</p><p className="text-[10px] text-mediumgray">accepted</p></div>
                    <div><p className="text-lg font-bold text-navy">{p.seats > 0 ? p.seatsLeft : "∞"}</p><p className="text-[10px] text-mediumgray">seats left</p></div>
                    <button type="button" disabled={busy === p.id} onClick={() => act(p.id, `/api/company/programs/${p.id}`, p.status === "open" ? "closed" : "open")} className="inline-flex items-center gap-1.5 rounded-md border border-lightgray px-2.5 py-1.5 text-xs font-semibold text-navy hover:border-slate hover:text-slate disabled:opacity-60">
                      {p.status === "open" ? <><Lock className="h-3.5 w-3.5" /> Close</> : <><LockOpen className="h-3.5 w-3.5" /> Reopen</>}
                    </button>
                  </div>
                </div>
                {p.seats > 0 && (
                  <div className="mx-5 mb-3 h-1.5 overflow-hidden rounded-full bg-lightgray"><div className="h-full rounded-full bg-emerald" style={{ width: `${Math.min(100, (p.accepted / p.seats) * 100)}%` }} /></div>
                )}
                {isOpen && (
                  <div className="border-t border-lightgray">
                    <div className="flex items-center justify-between px-5 py-2.5">
                      <span className="text-xs font-semibold text-navy">Applicants ({people.length}{people.length !== p.applicants.length ? ` of ${p.applicants.length}` : ""})</span>
                      <button type="button" disabled={people.length === 0} onClick={() => downloadCsv(`${p.title.replace(/\W+/g, "-").toLowerCase()}-applicants.csv`, ["Name", "Email", "Institution", "Target role", "Skill fit %", "Readiness %", "Verified skills", "Status", "Applied on", "Motivation"], people.map((a) => [a.name, a.email, a.institution, a.targetRole, a.fit, a.readiness, a.verifiedSkills, a.status, fmtDate(a.appliedAt), a.motivation]))} className="inline-flex items-center gap-1 text-xs font-semibold text-slate hover:underline disabled:opacity-50"><Download className="h-3.5 w-3.5" /> CSV</button>
                    </div>
                    <ul className="divide-y divide-lightgray">
                      {people.length === 0 && <li className="px-5 py-5 text-center text-xs text-mediumgray">{p.applicants.length === 0 ? "No students have applied yet." : "No applicants match these filters."}</li>}
                      {people.map((a) => (
                        <li key={a.enrollmentId} className="flex flex-col gap-2 px-5 py-3 md:flex-row md:items-center">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <a href={`/view/student/${a.studentId}`} className="text-sm font-semibold text-navy hover:text-slate hover:underline">{a.name}</a>
                              <span className="text-[11px] text-mediumgray">{a.targetRole}{a.institution ? ` · ${a.institution}` : ""}</span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-mediumgray">
                              Skill fit {a.fit}% · readiness {a.readiness}% · {a.verifiedSkills} verified skills · applied {fmtDate(a.appliedAt)}
                            </p>
                            {a.motivation && <p className="mt-1 text-xs italic text-navy/80">“{a.motivation}”</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ENROLL_STYLE(a.status)}`}>{a.status}</span>
                            <select value={a.status} disabled={busy === a.enrollmentId} onChange={(e) => act(a.enrollmentId, `/api/company/enrollments/${a.enrollmentId}`, e.target.value)} className={smallSelect} aria-label="Update applicant status">
                              {ENROLLMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {collaborations.length === 0 && <Card className="p-8 text-center text-sm text-mediumgray">No collaborations yet — publish an FDP, guest lecture or research call for academicians.</Card>}
          {collaborations.map((c) => {
            const people = c.people.filter((p) => (!statusFilter || p.status === statusFilter) && (!q || `${p.name} ${p.institution} ${p.department}`.toLowerCase().includes(q)));
            const isOpen = open === c.id || (!!q || !!statusFilter) && people.length > 0;
            return (
              <Card key={c.id} className={c.status === "closed" ? "opacity-80" : ""}>
                <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                  <button type="button" onClick={() => setOpen(open === c.id ? null : c.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                    <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-mediumgray transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-navy">{c.title}</span>
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">{c.type}</span>
                        {c.status === "closed" && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">Closed</span>}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-mediumgray">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{fmtDate(c.startsAt)}</span><span>{c.duration}</span>
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{c.location}</span>
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-4 text-center">
                    <div><p className="text-lg font-bold text-navy">{c.interested}</p><p className="text-[10px] text-mediumgray">interested</p></div>
                    <div><p className="text-lg font-bold text-emerald">{c.accepted}</p><p className="text-[10px] text-mediumgray">accepted</p></div>
                    <div><p className="text-lg font-bold text-navy">{c.seats || "∞"}</p><p className="text-[10px] text-mediumgray">seats</p></div>
                    <button type="button" disabled={busy === c.id} onClick={() => act(c.id, `/api/company/collaborations/${c.id}`, c.status === "open" ? "closed" : "open")} className="inline-flex items-center gap-1.5 rounded-md border border-lightgray px-2.5 py-1.5 text-xs font-semibold text-navy hover:border-slate hover:text-slate disabled:opacity-60">
                      {c.status === "open" ? <><Lock className="h-3.5 w-3.5" /> Close</> : <><LockOpen className="h-3.5 w-3.5" /> Reopen</>}
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-lightgray">
                    <div className="flex items-center justify-between px-5 py-2.5">
                      <span className="text-xs font-semibold text-navy">Interested academicians ({people.length}{people.length !== c.people.length ? ` of ${c.people.length}` : ""})</span>
                      <button type="button" disabled={people.length === 0} onClick={() => downloadCsv(`${c.title.replace(/\W+/g, "-").toLowerCase()}-interest.csv`, ["Name", "Email", "Designation", "Department", "Institution", "Status", "Expressed on"], people.map((p) => [p.name, p.email, p.designation, p.department, p.institution, p.status, fmtDate(p.expressedAt)]))} className="inline-flex items-center gap-1 text-xs font-semibold text-slate hover:underline disabled:opacity-50"><Download className="h-3.5 w-3.5" /> CSV</button>
                    </div>
                    <ul className="divide-y divide-lightgray">
                      {people.length === 0 && <li className="px-5 py-5 text-center text-xs text-mediumgray">{c.people.length === 0 ? "No faculty have expressed interest yet." : "No one matches these filters."}</li>}
                      {people.map((p) => (
                        <li key={p.interestId} className="flex flex-col gap-2 px-5 py-3 md:flex-row md:items-center">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-navy"><a href={`/view/${p.role}/${p.userId}`} className="hover:text-slate hover:underline">{p.name}</a> <span className="ml-1 rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium text-mediumgray">{p.role === "faculty" ? "Faculty" : "Institution"}</span></p>
                            <p className="mt-0.5 text-[11px] text-mediumgray">{[p.designation, p.department, p.institution].filter(Boolean).join(" · ")} · interested {fmtDate(p.expressedAt)}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {p.email && <a href={`mailto:${p.email}?subject=${encodeURIComponent(c.title)}`} className="inline-flex items-center gap-1 rounded-md border border-lightgray px-2 py-1 text-xs font-semibold text-navy hover:border-slate hover:text-slate"><Mail className="h-3.5 w-3.5" /> Contact</a>}
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ENROLL_STYLE(p.status)}`}>{p.status}</span>
                            <select value={p.status} disabled={busy === p.interestId} onChange={(e) => act(p.interestId, `/api/company/interests/${p.interestId}`, e.target.value)} className={smallSelect} aria-label="Update interest status">
                              {INTEREST_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
