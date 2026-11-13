import type { Metadata } from "next";
import Candidates from "@/components/company/Candidates";
import { getMatchExplanations } from "@/lib/ai/match";
import { requireRole } from "@/lib/auth/require-role";
import { getCandidatesForOpening, getCompanyContext, listCompanyApplicants, listOpenings } from "@/lib/db/company";

export const metadata: Metadata = { title: "Candidates — Jems" };

/** `?job=<id>` ranks every student for one opening; no job (or `all`) lists every applicant across openings. */
export default async function CandidatesPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const session = await requireRole("company");
  const { job } = await searchParams;
  const jobId = job && job !== "all" ? job : null;
  const [company, openings] = await Promise.all([getCompanyContext(session.user.id), listOpenings(session.user.id)]);

  const [result, insights] = jobId
    ? await Promise.all([getCandidatesForOpening(session.user.id, jobId), getMatchExplanations(session.user.id, jobId)])
    : [null, {}];

  // No opening picked (or one that isn't this company's): show every applicant.
  if (!result) {
    const applicants = await listCompanyApplicants(session.user.id);
    return <Candidates key="all" company={company?.name ?? "Company"} openings={openings} selected={null} candidates={applicants} insights={{}} />;
  }

  return (
    <Candidates
      key={result.opening.id}
      company={company?.name ?? "Company"}
      openings={openings}
      selected={result?.opening ?? null}
      candidates={result?.candidates ?? []}
      insights={insights}
    />
  );
}
