"use client";

import CompanyLink from "@/components/profile/CompanyLink";
import { useCallback, useEffect, useState } from "react";
import {
  Briefcase,
  Check,
  FileText,
  MapPin,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import DashboardShell, { DashboardContainer } from "@/components/dashboard/student/DashboardShell";
import { Card, EmptyState } from "@/components/dashboard/student/ui";
import type { ApplicationView } from "@/lib/db/student-data";

const STAGES = ["Applied", "In review", "Shortlisted", "Interview", "Offer"] as const;
type Status = ApplicationView["status"];

function statusTone(s: Status) {
  if (s === "Offer") return "bg-emerald/10 text-emerald border border-emerald/30";
  if (s === "Rejected") return "bg-red-50 text-red-600 border border-red-200";
  if (s === "Interview" || s === "Shortlisted") return "bg-slate/10 text-slate border border-slate/30";
  return "bg-gold/15 text-amber-700 border border-amber-200";
}

const TABS = ["All", "Applied", "In review", "Shortlisted", "Interview", "Offer", "Rejected"] as const;

export default function Applications({ apps: initialApps }: { apps: ApplicationView[] }) {
  const [apps, setApps] = useState<ApplicationView[]>(initialApps);
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ApplicationView | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Dynamic fetch from server API
  const refreshApplications = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/student/applications", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.applications)) {
          setApps(data.applications);
        }
      }
    } catch (e) {
      console.error("Failed to dynamically fetch applications:", e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Poll for live status changes periodically (e.g. recruiter stage advancement)
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refreshApplications();
    }, 15000);
    return () => clearInterval(timer);
  }, [refreshApplications]);

  const handleWithdraw = async (applicationId: string) => {
    if (!confirm("Are you sure you want to withdraw this application?")) return;
    setWithdrawing(applicationId);
    try {
      const res = await fetch("/api/student/applications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      if (!res.ok) throw new Error("Could not withdraw.");

      setApps((prev) => prev.filter((a) => a.id !== applicationId));
      setSelectedApp(null);
      setActionMessage("Application successfully withdrawn.");
      setTimeout(() => setActionMessage(null), 4000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to withdraw.");
    } finally {
      setWithdrawing(null);
    }
  };

  const counts = {
    Applied: apps.filter((a) => a.status === "Applied").length,
    "In review": apps.filter((a) => a.status === "In review").length,
    Shortlisted: apps.filter((a) => a.status === "Shortlisted").length,
    Interview: apps.filter((a) => a.status === "Interview").length,
    Offer: apps.filter((a) => a.status === "Offer").length,
  };

  const q = query.trim().toLowerCase();
  const visible = apps.filter(
    (a) =>
      (tab === "All" || a.status === tab) &&
      (!q || a.role.toLowerCase().includes(q) || a.company.toLowerCase().includes(q)),
  );

  if (apps.length === 0) {
    return (
      <DashboardShell>
        <DashboardContainer className="space-y-6">
          <EmptyState
            icon={Briefcase}
            title="No applications yet"
            hint="When you apply to roles from Job Matches, they will show up here dynamically so you can track your hiring pipeline."
            ctaLabel="Browse Job Matches"
            ctaHref="/student/jobs"
          />
        </DashboardContainer>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <DashboardContainer className="space-y-6">
        {/* Action notification toast */}
        {actionMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-navy px-4 py-3 text-xs font-semibold text-white shadow-xl">
            <Check className="h-4 w-4 text-emerald" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Top Header with Dynamic Refresh */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-navy">Applications Pipeline</h1>
            <p className="mt-1 text-sm text-mediumgray">
              Track live status updates and interview invitations from employers.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshApplications}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-lightgray bg-white px-3.5 py-2 text-xs font-semibold text-navy transition-colors hover:border-slate hover:text-slate disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-slate" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh Pipeline"}
          </button>
        </div>

        {/* Pipeline Statistics */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {(Object.keys(counts) as (keyof typeof counts)[]).map((k) => (
            <Card key={k} className="p-5">
              <p className="text-xs font-semibold text-mediumgray uppercase tracking-wider">{k}</p>
              <p className="mt-2 text-2xl font-bold text-navy">{counts[k]}</p>
            </Card>
          ))}
        </div>

        {/* Search and Status Filter Tabs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t
                    ? "bg-navy text-white shadow-xs"
                    : "border border-lightgray bg-white text-mediumgray hover:text-navy"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mediumgray" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search application…"
              className="h-9 w-full rounded-lg border border-lightgray bg-white pl-8 pr-3 text-xs text-navy outline-none placeholder:text-mediumgray focus:border-slate"
            />
          </div>
        </div>

        {/* Dynamic Applications List */}
        <Card className="overflow-hidden">
          <ul className="divide-y divide-lightgray">
            {visible.map((a) => {
              const stageIndex = a.status === "Rejected" ? -1 : STAGES.indexOf(a.status);
              return (
                <li
                  key={a.id}
                  onClick={() => setSelectedApp(a)}
                  className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center cursor-pointer transition-colors hover:bg-surface-2"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface text-base font-bold text-navy">
                    {a.company.charAt(0)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-navy">{a.role}</p>
                      {a.resumeName && (
                        <span className="inline-flex items-center gap-1 rounded bg-slate/10 px-1.5 py-0.5 text-[10px] font-medium text-slate">
                          <FileText className="h-3 w-3" /> {a.resumeName}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-mediumgray flex flex-wrap items-center gap-x-2">
                      <CompanyLink id={a.companyId} name={a.company} />
                      <span>·</span>
                      <span>Applied {a.applied}</span>
                      {a.location && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" /> {a.location}
                          </span>
                        </>
                      )}
                    </p>

                    {/* Hiring Stage Progress Bar */}
                    <div className="mt-2.5 flex max-w-xs items-center gap-1">
                      {STAGES.map((s, i) => (
                        <div key={s} className="flex-1">
                          <span
                            className={`block h-1.5 w-full rounded-full transition-colors ${
                              a.status === "Rejected"
                                ? "bg-red-200"
                                : i <= stageIndex
                                  ? "bg-slate"
                                  : "bg-lightgray"
                            }`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-auto">
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusTone(
                        a.status,
                      )}`}
                    >
                      {a.status}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          {visible.length === 0 && (
            <p className="px-5 py-12 text-center text-sm text-mediumgray">
              No applications match the selected filter.
            </p>
          )}
        </Card>

        {/* ── Dynamic Application Detail Modal ── */}
        {selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div
              className="relative w-full max-w-md rounded-2xl border border-lightgray bg-white p-6 shadow-2xl"
              style={{ animation: "fade-in 0.2s ease-out" }}
            >
              <div className="flex items-start justify-between border-b border-lightgray pb-4">
                <div>
                  <h3 className="text-base font-bold text-navy">{selectedApp.role}</h3>
                  <p className="text-xs text-mediumgray">
                    <CompanyLink id={selectedApp.companyId} name={selectedApp.company} /> · Applied on {selectedApp.applied}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="rounded-lg p-1.5 text-mediumgray hover:bg-surface hover:text-navy"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Status and Details */}
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3.5">
                  <span className="text-xs font-semibold text-navy">Hiring Stage:</span>
                  <span
                    className={`rounded-full px-3 py-0.5 text-xs font-bold ${statusTone(
                      selectedApp.status,
                    )}`}
                  >
                    {selectedApp.status}
                  </span>
                </div>

                {/* Attached Resume */}
                <div className="rounded-xl border border-lightgray p-3.5 space-y-1">
                  <span className="text-xs font-semibold text-navy flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-slate" /> Submitted Resume:
                  </span>
                  <p className="text-xs text-mediumgray">
                    {selectedApp.resumeName || "JEMS 1-Page ATS Resume"}
                  </p>
                </div>

                {/* Pipeline Progression Milestones */}
                <div className="space-y-2 border-t border-lightgray pt-4">
                  <span className="block text-xs font-semibold text-navy mb-2">Stage Timeline:</span>
                  {STAGES.map((s, idx) => {
                    const isPassed =
                      selectedApp.status !== "Rejected" &&
                      idx <= STAGES.indexOf(selectedApp.status);
                    return (
                      <div key={s} className="flex items-center gap-2.5 text-xs">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                            isPassed
                              ? "bg-emerald text-white"
                              : "bg-surface text-mediumgray"
                          }`}
                        >
                          {isPassed ? <Check className="h-3 w-3" /> : idx + 1}
                        </span>
                        <span className={isPassed ? "font-semibold text-navy" : "text-mediumgray"}>
                          {s}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between border-t border-lightgray pt-4">
                  <button
                    type="button"
                    onClick={() => handleWithdraw(selectedApp.id)}
                    disabled={withdrawing === selectedApp.id}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {withdrawing === selectedApp.id ? "Withdrawing…" : "Withdraw Application"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedApp(null)}
                    className="rounded-lg bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-[#1f2937]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DashboardContainer>
    </DashboardShell>
  );
}
