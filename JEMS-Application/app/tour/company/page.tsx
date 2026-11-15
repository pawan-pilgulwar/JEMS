import CompanyDashboard from "@/components/company/CompanyDashboard";
import PortalShell from "@/components/portal/PortalShell";
import { PORTAL_NAV } from "@/lib/portal-nav";
import { TOUR_COMPANY_DASHBOARD } from "@/lib/tour/fixtures";

/** Industry tour: the company dashboard with a sample company. */
export default function CompanyTourPage() {
  return (
    <PortalShell tour="company" roleLabel="Industry" nav={PORTAL_NAV.company} name={TOUR_COMPANY_DASHBOARD.company.name} email="careers@nimbus.example">
      <CompanyDashboard data={TOUR_COMPANY_DASHBOARD} />
    </PortalShell>
  );
}
