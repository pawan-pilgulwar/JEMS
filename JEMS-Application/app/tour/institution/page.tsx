import InstitutionDashboard from "@/components/institution/InstitutionDashboard";
import PortalShell from "@/components/portal/PortalShell";
import { PORTAL_NAV } from "@/lib/portal-nav";
import { TOUR_INSTITUTION_DASHBOARD } from "@/lib/tour/fixtures";

/** Institution tour: the analytics dashboard with a sample institution. */
export default function InstitutionTourPage() {
  return (
    <PortalShell tour="institution" roleLabel="Institution" nav={PORTAL_NAV.institution} name={TOUR_INSTITUTION_DASHBOARD.institution} email="placements@sample.example.edu">
      <InstitutionDashboard data={TOUR_INSTITUTION_DASHBOARD} />
    </PortalShell>
  );
}
