import { Building2, ExternalLink, GraduationCap, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { Card } from "@/components/dashboard/student/ui";

/** Server-safe pieces shared by the read-only profile pages under /view. */

const KIND_ICON = { company: Building2, institution: GraduationCap, faculty: UserRound } as const;

export function ProfileHero({
  kind,
  name,
  tagline,
  location,
  chips = [],
  links = [],
}: {
  kind: keyof typeof KIND_ICON;
  name: string;
  tagline: string;
  location?: string;
  chips?: string[];
  links?: { label: string; href: string; kind?: "web" | "mail" | "phone" }[];
}) {
  const Icon = KIND_ICON[kind];
  return (
    <Card className="p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate/10 text-slate">
          <Icon className="h-8 w-8" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-navy">{name}</h1>
          {tagline && <p className="mt-0.5 text-sm text-mediumgray">{tagline}</p>}
          {location && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-mediumgray">
              <MapPin className="h-3.5 w-3.5" /> {location}
            </p>
          )}
          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {chips.map((c) => <span key={c} className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-medium text-navy">{c}</span>)}
            </div>
          )}
        </div>
        {links.length > 0 && (
          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
            {links.map((l) => {
              const LinkIcon = l.kind === "mail" ? Mail : l.kind === "phone" ? Phone : ExternalLink;
              const href = l.kind === "mail" ? `mailto:${l.href}` : l.kind === "phone" ? `tel:${l.href}` : l.href;
              return (
                <a key={l.label} href={href} target={l.kind ? undefined : "_blank"} rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-lightgray px-3 py-1.5 text-xs font-semibold text-navy hover:border-slate hover:text-slate">
                  <LinkIcon className="h-3.5 w-3.5" /> {l.label}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

export function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <Card>
      <div className="border-b border-lightgray px-5 py-3.5">
        <h2 className="text-sm font-semibold text-navy">
          {title}
          {count != null && <span className="ml-1.5 font-normal text-mediumgray">({count})</span>}
        </h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </Card>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-mediumgray">{children}</p>;
}

export const fmtDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

export const STATUS_PILL = (s: string) =>
  /offer|selected|accepted|completed/i.test(s)
    ? "bg-emerald/10 text-emerald"
    : /interview|shortlist|review|waitlist/i.test(s)
      ? "bg-slate/10 text-slate"
      : /reject|declined/i.test(s)
        ? "bg-red-50 text-red-600"
        : "bg-surface text-mediumgray";
