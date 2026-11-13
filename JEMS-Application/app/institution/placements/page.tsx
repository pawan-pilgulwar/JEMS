import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Placements from "@/components/institution/Placements";
import { requireRole } from "@/lib/auth/require-role";
import { getInstitutionStudents } from "@/lib/db/institution";

export const metadata: Metadata = { title: "Placements — Jems" };

export default async function InstitutionPlacementsPage() {
  const session = await requireRole("institution");
  const data = await getInstitutionStudents(session.user.id);
  if (!data) redirect("/login");
  return <Placements data={data} />;
}
