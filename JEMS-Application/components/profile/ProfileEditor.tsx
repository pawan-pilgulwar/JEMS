"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, ExternalLink, GraduationCap, LoaderCircle, UserRound } from "lucide-react";
import { Card } from "@/components/dashboard/student/ui";

export type FieldSpec = {
  key: string;
  label: string;
  type?: "text" | "url" | "email" | "textarea" | "tags" | "select";
  placeholder?: string;
  hint?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  /** Spans both columns. */
  wide?: boolean;
};

export type ProfileValues = Record<string, string | string[]>;

/** Icons by role — components can't be passed from the server pages that render this. */
const ICONS = { company: Building2, institution: GraduationCap, faculty: UserRound } as const;

const inputCls =
  "h-10 w-full rounded-lg border border-lightgray bg-white px-3 text-sm text-navy outline-none transition-colors placeholder:text-mediumgray focus:border-slate focus:ring-2 focus:ring-slate/15";

/** Tag lists are edited as comma-separated text and sent back as arrays. */
const toForm = (v: ProfileValues) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Array.isArray(x) ? x.join(", ") : x]));

/**
 * Profile editor shared by the industry, faculty and institution portals:
 * a field spec drives the form, `endpoint` receives the PATCH, and the
 * "View public profile" link shows what other users see.
 */
export default function ProfileEditor({
  kind,
  heading,
  subheading,
  endpoint,
  sections,
  initial,
  publicHref,
}: {
  kind: keyof typeof ICONS;
  heading: string;
  subheading: string;
  endpoint: string;
  sections: { title: string; fields: FieldSpec[] }[];
  initial: ProfileValues;
  publicHref: string;
}) {
  const router = useRouter();
  const Icon = ICONS[kind];
  const tagKeys = new Set(sections.flatMap((s) => s.fields.filter((f) => f.type === "tags").map((f) => f.key)));
  const [form, setForm] = useState<Record<string, string>>(() => toForm(initial));
  const [saved, setSaved] = useState(form);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (status !== "saving") setStatus("idle");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");
    setError("");
    const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, tagKeys.has(k) ? v.split(",").map((x) => x.trim()).filter(Boolean) : v]));
    try {
      const res = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; profile?: ProfileValues };
      if (!res.ok) throw new Error(data.error || "Could not save.");
      const next = data.profile ? { ...form, ...toForm(data.profile) } : form;
      setForm(next);
      setSaved(next);
      setStatus("saved");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setStatus("error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate/10 text-xl font-bold text-slate">
            <Icon className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-navy">{heading}</h1>
            <p className="text-sm text-mediumgray">{subheading}</p>
          </div>
        </div>
        <Link href={publicHref} className="inline-flex items-center gap-1.5 self-start rounded-lg border border-lightgray bg-white px-3.5 py-2 text-xs font-semibold text-navy hover:border-slate hover:text-slate sm:self-auto">
          <ExternalLink className="h-3.5 w-3.5" /> View public profile
        </Link>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {sections.map((section) => (
          <Card key={section.title} className="p-6">
            <h2 className="text-sm font-semibold text-navy">{section.title}</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {section.fields.map((f) => (
                <label key={f.key} className={`block ${f.wide || f.type === "textarea" ? "sm:col-span-2" : ""}`}>
                  <span className="mb-1.5 block text-xs font-semibold text-navy">
                    {f.label}
                    {f.required && <span className="text-orange"> *</span>}
                  </span>
                  {f.type === "textarea" ? (
                    <textarea value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} rows={4} className={`${inputCls} h-auto py-2 leading-6`} />
                  ) : f.type === "select" ? (
                    <select value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className={inputCls}>
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type === "email" ? "email" : "text"}
                      required={f.required}
                      value={form[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                      placeholder={f.placeholder ?? (f.type === "tags" ? "Comma-separated" : undefined)}
                      className={inputCls}
                    />
                  )}
                  {f.hint && <span className="mt-1 block text-[11px] text-mediumgray">{f.hint}</span>}
                </label>
              ))}
            </div>
          </Card>
        ))}

        <div className="flex items-center justify-end gap-3">
          {status === "error" && <span className="mr-auto text-sm text-red-600">{error}</span>}
          {status === "saved" && !dirty && <span className="mr-auto inline-flex items-center gap-1 text-sm text-emerald"><Check className="h-4 w-4" /> Saved</span>}
          <button type="button" disabled={!dirty || status === "saving"} onClick={() => { setForm(saved); setStatus("idle"); }} className="rounded-lg border border-lightgray bg-white px-4 py-2 text-sm font-semibold text-navy hover:border-slate disabled:opacity-50">
            Discard
          </button>
          <button type="submit" disabled={!dirty || status === "saving"} className="inline-flex items-center gap-2 rounded-lg bg-primary-gradient px-5 py-2 text-sm font-semibold text-white shadow-[var(--shadow-cta)] disabled:opacity-50">
            {status === "saving" && <LoaderCircle className="h-4 w-4 animate-spin" />} Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
