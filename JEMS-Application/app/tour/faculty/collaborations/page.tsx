import CollaborationBoard from "@/components/faculty/CollaborationBoard";
import PortalShell from "@/components/portal/PortalShell";
import { PORTAL_NAV } from "@/lib/portal-nav";
import { TOUR_COLLABORATIONS, TOUR_FACULTY_DASHBOARD } from "@/lib/tour/fixtures";

/** Academician tour, part 2: industry collaborations with sample listings. */
export default function FacultyCollaborationsTourPage() {
  const f = TOUR_FACULTY_DASHBOARD.faculty;
  return (
    <PortalShell tour="faculty" roleLabel="Academia" nav={PORTAL_NAV.faculty} name={f.name} email="meera.nair@example.edu">
      <CollaborationBoard items={TOUR_COLLABORATIONS} who={f.name} headline="Industry collaboration for academicians" />
    </PortalShell>
  );
}
