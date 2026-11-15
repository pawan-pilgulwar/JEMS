import type { Metadata } from "next";
import { DemoModeProvider } from "@/components/tour/DemoMode";

export const metadata: Metadata = { title: "Guided tour — Jems", robots: { index: false } };

/**
 * Guided-tour pages: the real portal screens rendered from static sample data
 * (lib/tour/fixtures). No sign-in, no database reads, nothing saved.
 */
export default function TourLayout({ children }: { children: React.ReactNode }) {
  return <DemoModeProvider>{children}</DemoModeProvider>;
}
