import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type JourneyTone = "student" | "company" | "faculty" | "institution";

const TONE_CLASSES: Record<JourneyTone, string> = {
  student: "bg-cta-gradient shadow-[var(--shadow-cta)]",
  company: "bg-navy shadow-[var(--shadow-card)]",
  faculty: "bg-gradient-to-r from-violet-600 to-purple-600 shadow-[0_4px_14px_-2px_rgba(124,58,237,0.35)]",
  institution: "bg-gradient-to-r from-teal-600 to-emerald-600 shadow-[0_4px_14px_-2px_rgba(13,148,136,0.35)]",
};

/** "Explore … journey": opens the sign-in page with that module's role selected. */
export default function JourneyButton({ href, label, tone, dataTour }: { href: string; label: string; tone: JourneyTone; dataTour?: string }) {
  return (
    <Link
      href={href}
      data-tour={dataTour}
      className={`group flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-[15px] font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 ${TONE_CLASSES[tone]}`}
    >
      {label}
      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}
