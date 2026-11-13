import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import IndustryPrograms from "@/components/programs/IndustryPrograms";
import { listProgramsForStudent } from "@/lib/db/programs";

export const metadata: Metadata = {
  title: "Industry Programs — Jems",
};

export default async function ProgramsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <IndustryPrograms programs={await listProgramsForStudent(session.user.id)} />;
}
