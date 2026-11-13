import type { Metadata } from "next";
import { redirect } from "next/navigation";
import StudentDirectory from "@/components/institution/StudentDirectory";
import { requireRole } from "@/lib/auth/require-role";
import { getInstitutionStudents } from "@/lib/db/institution";

export const metadata: Metadata = { title: "Students — Jems" };

/** Faculty see the same student directory as their institution, scoped by the institution on their profile. */
export default async function FacultyStudentsPage() {
  const session = await requireRole("faculty");
  const data = await getInstitutionStudents(session.user.id);
  if (!data) redirect("/login");
  return <StudentDirectory data={data} />;
}
