import type { PortalNavItem } from "@/components/portal/PortalShell";

/** Side menus for the industry, faculty and institution portals (also used by the guided-tour pages). */
export const PORTAL_NAV: Record<"company" | "faculty" | "institution", PortalNavItem[]> = {
  company: [
    { label: "Dashboard", href: "/company/dashboard", icon: "LayoutDashboard" },
    { label: "Jobs / Internships", href: "/company/opportunities", icon: "Briefcase" },
    { label: "Candidates", href: "/company/candidates", icon: "Users" },
    { label: "Programs", href: "/company/programs", icon: "GraduationCap" },
    { label: "Company Profile", href: "/company/profile", icon: "Building2" },
  ],
  faculty: [
    { label: "Dashboard", href: "/faculty/dashboard", icon: "LayoutDashboard" },
    { label: "Students", href: "/faculty/students", icon: "Users" },
    { label: "Collaborations", href: "/faculty/collaborations", icon: "Handshake" },
    { label: "My Profile", href: "/faculty/profile", icon: "UserRound" },
  ],
  institution: [
    { label: "Analytics", href: "/institution/dashboard", icon: "BarChart3" },
    { label: "Students", href: "/institution/students", icon: "Users" },
    { label: "Placements", href: "/institution/placements", icon: "Trophy" },
    { label: "Industry Programs", href: "/institution/programs", icon: "GraduationCap" },
    { label: "Faculty", href: "/institution/faculty", icon: "UserCheck" },
    { label: "Collaborations", href: "/institution/collaborations", icon: "Handshake" },
    { label: "Institution Profile", href: "/institution/profile", icon: "Building2" },
  ],
};
