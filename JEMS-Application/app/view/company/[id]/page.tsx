import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Empty, ProfileHero, Section, fmtDate } from "@/components/profile/ProfileBits";
import { getCompanyProfilePublic } from "@/lib/db/org-profiles";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await getCompanyProfilePublic((await params).id);
  return { title: p ? `${p.name} — Jems` : "Company — Jems" };
}

/** A company's page as students and academics see it: who they are and what they offer right now. */
export default async function CompanyViewPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, auth()]);
  const p = await getCompanyProfilePublic(id);
  if (!p) notFound();
  const role = session?.user?.role;
  const own = session?.user?.id === id;

  return (
    <div className="space-y-6">
      <ProfileHero
        kind="company"
        name={p.name}
        tagline={[p.industry, p.size && `${p.size} employees`, p.founded && `Founded ${p.founded}`].filter(Boolean).join(" · ")}
        location={p.location}
        chips={p.hiringFor.map((h) => `Hires: ${h}`)}
        links={[
          ...(p.website ? [{ label: "Website", href: p.website }] : []),
          ...(p.linkedin ? [{ label: "LinkedIn", href: p.linkedin }] : []),
          ...(p.contactEmail ? [{ label: p.contactEmail, href: p.contactEmail, kind: "mail" as const }] : []),
        ]}
      />
      {own && (
        <p className="text-sm text-mediumgray">
          This is how others see your company. <Link href="/company/profile" className="font-semibold text-slate hover:underline">Edit profile</Link>
        </p>
      )}

      <Section title="About">
        {p.about ? <p className="whitespace-pre-line text-sm leading-6 text-navy">{p.about}</p> : <Empty>The company hasn&apos;t added a description yet.</Empty>}
      </Section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Open roles" count={p.openings.length}>
          {p.openings.length === 0 ? (
            <Empty>No open roles right now.</Empty>
          ) : (
            <ul className="divide-y divide-lightgray">
              {p.openings.map((o) => (
                <li key={o.id} className="py-2.5">
                  <p className="text-sm font-semibold text-navy">{o.role}</p>
                  <p className="text-[11px] text-mediumgray">{[o.type, o.location, o.postedAt && `posted ${fmtDate(o.postedAt)}`].filter(Boolean).join(" · ")}</p>
                  <div className="mt-1 flex flex-wrap gap-1">{o.requiredSkills.map((s) => <span key={s} className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium text-navy">{s}</span>)}</div>
                </li>
              ))}
            </ul>
          )}
          {role === "student" && p.openings.length > 0 && (
            <Link href="/student/jobs" className="mt-3 inline-block text-xs font-semibold text-slate hover:underline">Apply from Job Matches →</Link>
          )}
        </Section>

        <div className="space-y-6">
          <Section title="Learning programs" count={p.programs.length}>
            {p.programs.length === 0 ? (
              <Empty>No programs open right now.</Empty>
            ) : (
              <ul className="space-y-2">
                {p.programs.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-navy">{g.title}</span>
                    <span className="shrink-0 text-[11px] text-mediumgray">{g.type} · {fmtDate(g.startsAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            {role === "student" && p.programs.length > 0 && (
              <Link href="/student/programs" className="mt-3 inline-block text-xs font-semibold text-slate hover:underline">Apply in Industry Programs →</Link>
            )}
          </Section>
          <Section title="Academia collaborations" count={p.collaborations.length}>
            {p.collaborations.length === 0 ? (
              <Empty>No collaborations open right now.</Empty>
            ) : (
              <ul className="space-y-2">
                {p.collaborations.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-navy">{c.title}</span>
                    <span className="shrink-0 text-[11px] text-mediumgray">{c.type} · {fmtDate(c.startsAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            {(role === "faculty" || role === "institution") && p.collaborations.length > 0 && (
              <Link href={`/${role}/collaborations`} className="mt-3 inline-block text-xs font-semibold text-slate hover:underline">Express interest →</Link>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
