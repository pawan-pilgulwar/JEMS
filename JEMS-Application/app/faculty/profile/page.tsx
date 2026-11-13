import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ProfileEditor from "@/components/profile/ProfileEditor";
import { requireRole } from "@/lib/auth/require-role";
import { getFacultyProfile, listInstitutions } from "@/lib/db/org-profiles";

export const metadata: Metadata = { title: "Faculty profile — Jems" };

export default async function FacultyProfilePage() {
  const session = await requireRole("faculty");
  const [p, institutions] = await Promise.all([getFacultyProfile(session.user.id), listInstitutions()]);
  if (!p) redirect("/login");
  return (
    <ProfileEditor
      kind="faculty"
      heading={p.name}
      subheading={`${p.email}${p.institution ? ` · ${p.institution}` : " · pick your institution so you can see its students"}`}
      endpoint="/api/faculty/profile"
      publicHref={`/view/faculty/${p.userId}`}
      initial={{ name: p.name, institutionId: p.institutionId, department: p.department, designation: p.designation, qualifications: p.qualifications, experienceYears: p.experienceYears, interests: p.interests, bio: p.bio, linkedin: p.linkedin, scholar: p.scholar, phone: p.phone }}
      sections={[
        {
          title: "Academic details",
          fields: [
            { key: "name", label: "Full name", required: true },
            {
              key: "institutionId",
              label: "Institution",
              type: "select",
              options: [{ value: "", label: "Not linked to an institution" }, ...institutions.map((i) => ({ value: i.id, label: i.location ? `${i.name} — ${i.location}` : i.name }))],
              hint: "Your institution sees your industry engagement; you see its students.",
            },
            { key: "department", label: "Department", placeholder: "Computer Science" },
            { key: "designation", label: "Designation", placeholder: "Associate Professor" },
            { key: "qualifications", label: "Qualifications", placeholder: "Ph.D. (Distributed Systems), M.Tech" },
            { key: "experienceYears", label: "Years of experience", placeholder: "12" },
            { key: "interests", label: "Research / teaching interests", type: "tags", placeholder: "Cloud Computing, Software Engineering", wide: true },
            { key: "bio", label: "Bio", type: "textarea" },
          ],
        },
        {
          title: "Contact & links",
          fields: [
            { key: "phone", label: "Phone" },
            { key: "linkedin", label: "LinkedIn", type: "url", placeholder: "linkedin.com/in/…" },
            { key: "scholar", label: "Google Scholar / ORCID", type: "url", placeholder: "scholar.google.com/…" },
          ],
        },
      ]}
    />
  );
}
