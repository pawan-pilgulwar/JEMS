import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ProgramUptake from "@/components/institution/ProgramUptake";
import { requireRole } from "@/lib/auth/require-role";
import { getInstitutionStudents } from "@/lib/db/institution";

export const metadata: Metadata = { title: "Industry Programs — Jems" };

export default async function InstitutionIndustryProgramsPage() {
  const session = await requireRole("institution");
  const data = await getInstitutionStudents(session.user.id);
  if (!data) redirect("/login");
  return <ProgramUptake data={data} />;
}
