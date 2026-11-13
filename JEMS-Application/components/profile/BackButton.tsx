"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** Returns to wherever the profile was opened from (or the user's home when opened directly). */
export default function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-mediumgray transition-colors hover:bg-surface hover:text-navy"
    >
      <ArrowLeft className="h-4 w-4" /> Back
    </button>
  );
}
