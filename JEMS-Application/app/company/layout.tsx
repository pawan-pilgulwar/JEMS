import PortalShell from "@/components/portal/PortalShell";
import { PORTAL_NAV } from "@/lib/portal-nav";
import { requireRole } from "@/lib/auth/require-role";
import { getCompanyContext } from "@/lib/db/company";


export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("company");
  const company = await getCompanyContext(session.user.id);
  return (
    <PortalShell tour="company" roleLabel="Industry" nav={PORTAL_NAV.company} name={company?.name ?? session.user.name ?? "Company"} email={session.user.email ?? ""}>
      {children}
    </PortalShell>
  );
}
