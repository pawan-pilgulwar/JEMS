import type { Metadata } from "next";
import CollaborationBoard from "@/components/faculty/CollaborationBoard";
import { requireRole } from "@/lib/auth/require-role";
import { listCollaborations } from "@/lib/db/collaborations";

export const metadata: Metadata = { title: "Faculty Collaboration — Jems" };

export default async function FacultyCollaborationsPage() {
  const session = await requireRole("faculty");
  const items = await listCollaborations(session.user.id);
  return (
    <CollaborationBoard
      items={items}
      who={session.user.name ?? "Faculty"}
      headline="Industry collaboration for academicians"
    />
  );
}

