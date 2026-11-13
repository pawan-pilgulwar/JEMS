import type { Metadata } from "next";
import { redirect } from "next/navigation";
import StudentDirectory from "@/components/institution/StudentDirectory";
import { requireRole } from "@/lib/auth/require-role";
import { getInstitutionStudents } from "@/lib/db/institution";

export const metadata: Metadata = { title: "Students — Jems" };

export default async function InstitutionStudentsPage() {
  const session = await requireRole("institution");
  const data = await getInstitutionStudents(session.user.id);
  if (!data) redirect("/login");
  return <StudentDirectory data={data} />;
}
