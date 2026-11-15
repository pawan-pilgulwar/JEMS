import PortalShell from "@/components/portal/PortalShell";
import { PORTAL_NAV } from "@/lib/portal-nav";
import { requireRole } from "@/lib/auth/require-role";


export default async function FacultyLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("faculty");
  return (
    <PortalShell
      tour="faculty"
      roleLabel="Academia"
      nav={PORTAL_NAV.faculty}
      name={session.user.name ?? "Faculty"}
      email={session.user.email ?? ""}
    >
      {children}
    </PortalShell>
  );
}
