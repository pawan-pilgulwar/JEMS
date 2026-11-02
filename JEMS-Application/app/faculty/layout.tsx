import PortalShell, { type PortalNavItem } from "@/components/portal/PortalShell";
import { requireRole } from "@/lib/auth/require-role";

const NAV: PortalNavItem[] = [
  { label: "Dashboard", href: "/faculty/dashboard", icon: "LayoutDashboard" },
  { label: "Collaborations", href: "/faculty/collaborations", icon: "Handshake" },
];

export default async function FacultyLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("faculty");
  return (
    <PortalShell
      tour="faculty"
      roleLabel="Academia"
      nav={NAV}
      name={session.user.name ?? "Faculty"}
      email={session.user.email ?? ""}
    >
      {children}
    </PortalShell>
  );
}
