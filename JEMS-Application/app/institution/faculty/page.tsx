import type { Metadata } from "next";
import { redirect } from "next/navigation";
import FacultyEngagement from "@/components/institution/FacultyEngagement";
import { requireRole } from "@/lib/auth/require-role";
import { getInstitutionFaculty } from "@/lib/db/institution";

export const metadata: Metadata = { title: "Faculty — Jems" };

export default async function InstitutionFacultyPage() {
  const session = await requireRole("institution");
  const data = await getInstitutionFaculty(session.user.id);
  if (!data) redirect("/login");
  return <FacultyEngagement institution={data.institution} departments={data.departments} faculty={data.faculty} />;
}
