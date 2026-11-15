import FacultyDashboard from "@/components/faculty/FacultyDashboard";
import PortalShell from "@/components/portal/PortalShell";
import { PORTAL_NAV } from "@/lib/portal-nav";
import { TOUR_FACULTY_DASHBOARD } from "@/lib/tour/fixtures";

/** Academician tour, part 1: the faculty dashboard with sample data. */
export default function FacultyTourPage() {
  const f = TOUR_FACULTY_DASHBOARD.faculty;
  return (
    <PortalShell tour="faculty" roleLabel="Academia" nav={PORTAL_NAV.faculty} name={f.name} email="meera.nair@example.edu">
      <FacultyDashboard initialData={TOUR_FACULTY_DASHBOARD} />
    </PortalShell>
  );
}
