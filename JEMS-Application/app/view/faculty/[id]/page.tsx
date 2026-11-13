import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Empty, ProfileHero, Section, STATUS_PILL } from "@/components/profile/ProfileBits";
import { getFacultyProfilePublic } from "@/lib/db/org-profiles";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await getFacultyProfilePublic((await params).id);
  return { title: p ? `${p.name} — Jems` : "Faculty — Jems" };
}

/** A faculty member's academic profile and industry engagement, as companies and colleagues see it. */
export default async function FacultyViewPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, auth()]);
  const p = await getFacultyProfilePublic(id);
  if (!p) notFound();
  const own = session?.user?.id === id;
  // Contact details are for the industry partners they engage with and their own institution.
  const showContact = session?.user?.role === "company" || session?.user?.role === "institution" || own;

  return (
    <div className="space-y-6">
      <ProfileHero
        kind="faculty"
        name={p.name}
        tagline={[p.designation, p.department].filter(Boolean).join(" · ")}
        location={p.institution || undefined}
        chips={[...(p.experienceYears ? [`${p.experienceYears} yrs experience`] : []), ...(p.qualifications ? [p.qualifications] : [])]}
        links={[
          ...(p.linkedin ? [{ label: "LinkedIn", href: p.linkedin }] : []),
          ...(p.scholar ? [{ label: "Publications", href: p.scholar }] : []),
          ...(showContact && p.email ? [{ label: p.email, href: p.email, kind: "mail" as const }] : []),
          ...(showContact && p.phone ? [{ label: p.phone, href: p.phone, kind: "phone" as const }] : []),
        ]}
      />
      {own && (
        <p className="text-sm text-mediumgray">
          This is how others see you. <Link href="/faculty/profile" className="font-semibold text-slate hover:underline">Edit profile</Link>
        </p>
      )}
      {p.institutionId && (
        <Link href={`/view/institution/${p.institutionId}`} className="inline-block text-xs font-semibold text-slate hover:underline">
          View {p.institution} →
        </Link>
      )}
      <Section title="About">
        {p.bio ? <p className="whitespace-pre-line text-sm leading-6 text-navy">{p.bio}</p> : <Empty>No bio yet.</Empty>}
        {p.interests.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">{p.interests.map((i) => <span key={i} className="rounded bg-surface px-2 py-0.5 text-[11px] font-medium text-navy">{i}</span>)}</div>
        )}
      </Section>
      <Section title="Industry engagement" count={p.collaborations.length}>
        {p.collaborations.length === 0 ? (
          <Empty>No collaborations yet.</Empty>
        ) : (
          <ul className="divide-y divide-lightgray">
            {p.collaborations.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-navy">{c.title}</span>
                  <span className="text-[11px] text-mediumgray"> · {c.company} · {c.type}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_PILL(c.status)}`}>{c.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
