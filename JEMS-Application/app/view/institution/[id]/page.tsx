import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Empty, ProfileHero, Section } from "@/components/profile/ProfileBits";
import { getInstitutionProfilePublic } from "@/lib/db/org-profiles";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await getInstitutionProfilePublic((await params).id);
  return { title: p ? `${p.name} — Jems` : "Institution — Jems" };
}

/** An institution's page as companies, faculty and students see it. */
export default async function InstitutionViewPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, auth()]);
  const p = await getInstitutionProfilePublic(id);
  if (!p) notFound();
  const own = session?.user?.id === id;

  return (
    <div className="space-y-6">
      <ProfileHero
        kind="institution"
        name={p.name}
        tagline={[p.type, p.established && `Est. ${p.established}`, p.accreditation].filter(Boolean).join(" · ")}
        location={p.location}
        chips={[`${p.stats.students} students on Jems`, `${p.stats.faculty} faculty on Jems`]}
        links={[
          ...(p.website ? [{ label: "Website", href: p.website }] : []),
          ...(p.contactEmail ? [{ label: p.contactEmail, href: p.contactEmail, kind: "mail" as const }] : []),
          ...(p.phone ? [{ label: p.phone, href: p.phone, kind: "phone" as const }] : []),
        ]}
      />
      {own && (
        <p className="text-sm text-mediumgray">
          This is how others see your institution. <Link href="/institution/profile" className="font-semibold text-slate hover:underline">Edit profile</Link>
        </p>
      )}
      <Section title="About">
        {p.about ? <p className="whitespace-pre-line text-sm leading-6 text-navy">{p.about}</p> : <Empty>No description yet.</Empty>}
      </Section>
      <Section title="Departments" count={p.departments.length}>
        {p.departments.length === 0 ? (
          <Empty>No departments listed.</Empty>
        ) : (
          <div className="flex flex-wrap gap-2">{p.departments.map((d) => <span key={d} className="rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-navy">{d}</span>)}</div>
        )}
      </Section>
    </div>
  );
}
