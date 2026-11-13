import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ProfileEditor from "@/components/profile/ProfileEditor";
import { requireRole } from "@/lib/auth/require-role";
import { getInstitutionProfile } from "@/lib/db/org-profiles";

export const metadata: Metadata = { title: "Institution profile — Jems" };

const TYPES = ["", "University", "Deemed University", "Autonomous College", "Affiliated College", "Polytechnic", "Training Institute"].map((v) => ({ value: v, label: v || "Select type" }));

export default async function InstitutionProfilePage() {
  const session = await requireRole("institution");
  const p = await getInstitutionProfile(session.user.id);
  if (!p) redirect("/login");
  return (
    <ProfileEditor
      kind="institution"
      heading={p.name}
      subheading={`${p.email} · students and faculty pick this institution on their profile to join it`}
      endpoint="/api/institution/profile"
      publicHref={`/view/institution/${p.userId}`}
      initial={{ name: p.name, type: p.type, established: p.established, accreditation: p.accreditation, location: p.location, departments: p.departments, about: p.about, website: p.website, contactEmail: p.contactEmail, phone: p.phone }}
      sections={[
        {
          title: "Institution",
          fields: [
            { key: "name", label: "Institution name", required: true, hint: "Renaming keeps your linked students and faculty attached." },
            { key: "type", label: "Type", type: "select", options: TYPES },
            { key: "established", label: "Established", placeholder: "1972" },
            { key: "accreditation", label: "Accreditation", placeholder: "NAAC A+, NBA" },
            { key: "location", label: "Location", placeholder: "Bengaluru, India" },
            { key: "departments", label: "Departments", type: "tags", placeholder: "Computer Science, Electronics", wide: true },
            { key: "about", label: "About", type: "textarea" },
          ],
        },
        {
          title: "Placement cell contact",
          fields: [
            { key: "contactEmail", label: "Contact email", type: "email", placeholder: "placements@college.edu" },
            { key: "phone", label: "Phone", placeholder: "+91 80 1234 5678" },
            { key: "website", label: "Website", type: "url", placeholder: "college.edu" },
          ],
        },
      ]}
    />
  );
}
