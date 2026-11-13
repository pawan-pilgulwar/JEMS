"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { JOBS, MORE, NAVIGATE } from "./nav-items";

/** Extra words people type for a section, so "cv" finds the resume builder. */
const ALIASES: Record<string, string> = {
  "/student/resume": "cv resume builder ats",
  "/student/assessment": "test quiz skill verify",
  "/student/jobs": "jobs internships openings match apply",
  "/student/applications": "applied status pipeline",
  "/student/programs": "training certification workshop industry course",
  "/student/learning": "course lessons videos",
  "/student/roadmap": "plan path career",
  "/student/interviews": "mock interview practice",
  "/student/analysis": "gap readiness advisor",
  "/student/profile": "portfolio about me",
};

const ITEMS = [...NAVIGATE, ...JOBS, ...MORE].filter((i): i is typeof i & { href: string } => !!i.href);

/** Top-bar jump-to-section search. ⌘K / Ctrl+K focuses it; Enter opens the best match. */
export default function QuickSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const term = q.trim().toLowerCase();
  const matches = term
    ? ITEMS.filter((i) => `${i.label} ${ALIASES[i.href] ?? ""}`.toLowerCase().includes(term))
    : ITEMS;

  const go = (href: string) => {
    setQ("");
    input.current?.blur();
    router.push(href);
  };

  return (
    <div className="relative ml-auto hidden max-w-xs flex-1 sm:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mediumgray" />
      <input
        ref={input}
        type="search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setIndex(0); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, matches.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
          if (e.key === "Enter" && matches[index]) go(matches[index].href);
          if (e.key === "Escape") input.current?.blur();
        }}
        placeholder="Jump to…"
        aria-label="Jump to a section"
        role="combobox"
        aria-expanded={focused}
        aria-controls="quick-search-list"
        className="h-9 w-full rounded-lg border border-navy/[0.08] bg-surface-2 pl-9 pr-12 text-sm text-navy outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-mediumgray focus:border-orange focus:bg-white focus:ring-4 focus:ring-orange/15"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-navy/[0.08] bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-mediumgray">
        ⌘K
      </kbd>
      {focused && (
        <ul id="quick-search-list" role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-navy/[0.08] bg-white py-1 shadow-[var(--shadow-card)]">
          {matches.length === 0 && <li className="px-3 py-2 text-xs text-mediumgray">No matching section.</li>}
          {matches.map((m, i) => (
            <li key={m.href} role="option" aria-selected={i === index}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); go(m.href); }}
                onMouseEnter={() => setIndex(i)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${i === index ? "bg-surface text-navy" : "text-mediumgray"}`}
              >
                <m.icon className="h-4 w-4" /> {m.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
