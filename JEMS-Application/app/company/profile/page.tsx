import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ProfileEditor from "@/components/profile/ProfileEditor";
import { requireRole } from "@/lib/auth/require-role";
import { getCompanyProfile } from "@/lib/db/org-profiles";

export const metadata: Metadata = { title: "Company profile — Jems" };

const SIZES = ["", "1–10", "11–50", "51–200", "201–1000", "1000+"].map((v) => ({ value: v, label: v || "Select size" }));

export default async function CompanyProfilePage() {
  const session = await requireRole("company");
  const p = await getCompanyProfile(session.user.id);
  if (!p) redirect("/login");
  return (
    <ProfileEditor
      kind="company"
      heading={p.name}
      subheading={`${p.email} · students see this page when they look at your openings and programs`}
      endpoint="/api/company/profile"
      publicHref={`/view/company/${p.userId}`}
      initial={{ name: p.name, industry: p.industry, size: p.size, founded: p.founded, location: p.location, website: p.website, linkedin: p.linkedin, contactEmail: p.contactEmail, hiringFor: p.hiringFor, about: p.about }}
      sections={[
        {
          title: "Company",
          fields: [
            { key: "name", label: "Company name", required: true },
            { key: "industry", label: "Industry", placeholder: "Technology, Consulting…" },
            { key: "size", label: "Company size", type: "select", options: SIZES },
            { key: "founded", label: "Founded", placeholder: "1967" },
            { key: "location", label: "Headquarters / location", placeholder: "Bengaluru, India" },
            { key: "hiringFor", label: "Roles you usually hire for", type: "tags", placeholder: "Java Developer, Data Engineer" },
            { key: "about", label: "About the company", type: "textarea", placeholder: "What you do, culture, how you hire freshers…" },
          ],
        },
        {
          title: "Contact & links",
          fields: [
            { key: "website", label: "Website", type: "url", placeholder: "company.com" },
            { key: "linkedin", label: "LinkedIn page", type: "url", placeholder: "linkedin.com/company/…" },
            { key: "contactEmail", label: "Recruiting contact email", type: "email", placeholder: "careers@company.com" },
          ],
        },
      ]}
    />
  );
}
