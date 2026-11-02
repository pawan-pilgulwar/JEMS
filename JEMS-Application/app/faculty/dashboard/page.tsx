import type { Metadata } from "next";
import { redirect } from "next/navigation";
import FacultyDashboard from "@/components/faculty/FacultyDashboard";
import TourAutostart from "@/components/tour/TourAutostart";
import { requireRole } from "@/lib/auth/require-role";
import { getFacultyDashboard } from "@/lib/db/faculty";

export const metadata: Metadata = { title: "Academia Dashboard — Jems" };

export default async function FacultyDashboardPage() {
  const session = await requireRole("faculty");
  const data = await getFacultyDashboard(session.user.id);
  if (!data) redirect("/login");

  return (
    <>
      <FacultyDashboard initialData={data} />
      <TourAutostart tour="faculty" />
    </>
  );
}
