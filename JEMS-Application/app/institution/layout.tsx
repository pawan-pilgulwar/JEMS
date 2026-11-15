import PortalShell from "@/components/portal/PortalShell";
import { PORTAL_NAV } from "@/lib/portal-nav";
import { requireRole } from "@/lib/auth/require-role";


export default async function InstitutionLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("institution");
  return (
    <PortalShell tour="institution" roleLabel="Institution" nav={PORTAL_NAV.institution} name={session.user.name ?? "Institution"} email={session.user.email ?? ""}>
      {children}
    </PortalShell>
  );
}
