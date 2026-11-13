import type { Metadata } from "next";
import Programs from "@/components/company/Programs";
import { requireRole } from "@/lib/auth/require-role";
import { listCompanyCollaborations } from "@/lib/db/collaborations";
import { getCompanyContext } from "@/lib/db/company";
import { listCompanyProgramsWithApplicants } from "@/lib/db/programs";

export const metadata: Metadata = { title: "Programs — Jems" };

/** `?tab=collaborations&item=<id>` / `?program=<id>` deep-link from notifications. */
export default async function ProgramsPage({ searchParams }: { searchParams: Promise<{ tab?: string; item?: string; program?: string }> }) {
  const session = await requireRole("company");
  const { tab, item, program } = await searchParams;
  const [company, programs, collaborations] = await Promise.all([
    getCompanyContext(session.user.id),
    listCompanyProgramsWithApplicants(session.user.id),
    listCompanyCollaborations(session.user.id),
  ]);
  return (
    <Programs
      company={company?.name ?? "Company"}
      programs={programs}
      collaborations={collaborations}
      initialTab={tab === "collaborations" ? "collaboration" : "program"}
      focus={item ?? program ?? null}
    />
  );
}
