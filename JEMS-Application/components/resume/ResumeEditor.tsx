"use client";

import { useState } from "react";
import { BadgeCheck, Check, Plus, Trash2 } from "lucide-react";
import { EntryCard, FormSection } from "./FormSection";
import {
  DeleteButton,
  GripHandle,
  LabeledInput,
  LabeledTextarea,
  ReorderableList,
} from "./fields";
import {
  blankCert,
  blankEducation,
  blankExperience,
  blankProject,
  type ListKey,
  type ProficiencyLevel,
  type ResumeData,
  uid,
} from "./types";

export interface VerifiedSkill {
  name: string;
  level: number;
}

interface ResumeEditorProps {
  data: ResumeData;
  setData: (producer: (prev: ResumeData) => ResumeData) => void;
  /** The student's JEMS-verified skills — the only skills the resume may list. */
  verifiedSkills?: VerifiedSkill[];
}

const levelLabel = (n: number): ProficiencyLevel => (n >= 85 ? "Expert" : n >= 70 ? "Advanced" : n >= 50 ? "Intermediate" : "Beginner");

export default function ResumeEditor({ data, setData, verifiedSkills = [] }: ResumeEditorProps) {
  const [newSkill, setNewSkill] = useState("");

  const addSkill = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (data.skills.some((s) => s.name.trim().toLowerCase() === key)) return;
    const isVerified = verifiedSkills.find((vs) => vs.name.trim().toLowerCase() === key);
    setData((d) => ({
      ...d,
      skills: [
        ...d.skills,
        {
          id: uid("skill"),
          name: trimmed,
          level: isVerified ? levelLabel(isVerified.level) : "Intermediate",
          verified: Boolean(isVerified),
        },
      ],
    }));
    setNewSkill("");
  };

  /** Skills can also be toggled from verified skills */
  const toggleVerifiedSkill = (vs: VerifiedSkill) =>
    setData((d) => {
      const key = vs.name.trim().toLowerCase();
      const has = d.skills.some((k) => k.name.trim().toLowerCase() === key);
      return {
        ...d,
        skills: has
          ? d.skills.filter((k) => k.name.trim().toLowerCase() !== key)
          : [...d.skills, { id: uid("skill"), name: vs.name, level: levelLabel(vs.level), verified: true }],
      };
    });

  const setHeader = (key: keyof ResumeData["header"], value: string) =>
    setData((d) => ({ ...d, header: { ...d.header, [key]: value } }));

  const addItem = <K extends ListKey>(key: K, blank: ResumeData[K][number]) =>
    setData((d) => ({ ...d, [key]: [...d[key], blank] }) as ResumeData);

  const patchItem = <K extends ListKey>(
    key: K,
    id: string,
    patch: Partial<ResumeData[K][number]>,
  ) =>
    setData(
      (d) =>
        ({
          ...d,
          [key]: (d[key] as { id: string }[]).map((it) =>
            it.id === id ? { ...it, ...patch } : it,
          ),
        }) as ResumeData,
    );

  const removeItem = <K extends ListKey>(key: K, id: string) =>
    setData(
      (d) =>
        ({
          ...d,
          [key]: (d[key] as { id: string }[]).filter((it) => it.id !== id),
        }) as ResumeData,
    );

  const reorderList = <K extends ListKey>(key: K, next: ResumeData[K]) =>
    setData((d) => ({ ...d, [key]: next }) as ResumeData);

  return (
    <div className="space-y-6">
      {/* Section 1 — Header */}
      <FormSection title="Header Information" subtitle="Your name and contact details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <LabeledInput label="Full Name" value={data.header.fullName} onChange={(v) => setHeader("fullName", v)} placeholder="Alex Kumar" />
          <LabeledInput label="Professional Title" value={data.header.title} onChange={(v) => setHeader("title", v)} placeholder="Frontend Developer" />
          <LabeledInput label="Email" type="email" value={data.header.email} onChange={(v) => setHeader("email", v)} placeholder="you@example.com" />
          <LabeledInput label="Phone" type="tel" value={data.header.phone} onChange={(v) => setHeader("phone", v)} placeholder="+91 98765 43210" />
          <LabeledInput label="Location" value={data.header.location} onChange={(v) => setHeader("location", v)} placeholder="Bengaluru, India" />
          <LabeledInput label="Portfolio URL" optional value={data.header.portfolio} onChange={(v) => setHeader("portfolio", v)} placeholder="yoursite.dev" />
          <div className="sm:col-span-2">
            <LabeledInput label="LinkedIn Profile" optional value={data.header.linkedin} onChange={(v) => setHeader("linkedin", v)} placeholder="linkedin.com/in/you" />
          </div>
        </div>
      </FormSection>

      {/* Section 2 — Summary */}
      <FormSection title="Professional Summary">
        <LabeledTextarea
          label="Summary"
          value={data.summary}
          onChange={(v) => setData((d) => ({ ...d, summary: v }))}
          maxLength={250}
          placeholder="Brief overview of your experience and goals"
        />
      </FormSection>

      {/* Section 3 — Experience */}
      <FormSection
        title="Experience"
        count={`${data.experience.length} added`}
        addLabel="Add Experience"
        onAdd={() => addItem("experience", blankExperience())}
      >
        <ReorderableList
          items={data.experience}
          getKey={(it) => it.id}
          onReorder={(next) => reorderList("experience", next)}
          renderItem={(item, _i, handleProps) => (
            <EntryCard>
              <div className="mb-3 flex items-center justify-between">
                <GripHandle handleProps={handleProps} />
                <DeleteButton onClick={() => removeItem("experience", item.id)} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <LabeledInput label="Company Name" value={item.company} onChange={(v) => patchItem("experience", item.id, { company: v })} placeholder="Company" />
                <LabeledInput label="Job Title" value={item.jobTitle} onChange={(v) => patchItem("experience", item.id, { jobTitle: v })} placeholder="Frontend Developer" />
                <LabeledInput label="Start Date" type="month" value={item.start} onChange={(v) => patchItem("experience", item.id, { start: v })} />
                <LabeledInput label="End Date" type="month" value={item.current ? "" : item.end} onChange={(v) => patchItem("experience", item.id, { end: v })} />
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={item.current}
                  onChange={(e) => patchItem("experience", item.id, { current: e.target.checked })}
                  className="h-4 w-4 rounded border-lightgray accent-slate"
                />
                I currently work here
              </label>
              <div className="mt-3">
                <LabeledTextarea label="Description" value={item.description} onChange={(v) => patchItem("experience", item.id, { description: v })} placeholder="What you did and the impact you made" />
              </div>
            </EntryCard>
          )}
        />
      </FormSection>

      {/* Section 4 — Education */}
      <FormSection
        title="Education"
        count={`${data.education.length} added`}
        addLabel="Add Education"
        onAdd={() => addItem("education", blankEducation())}
      >
        <ReorderableList
          items={data.education}
          getKey={(it) => it.id}
          onReorder={(next) => reorderList("education", next)}
          renderItem={(item, _i, handleProps) => (
            <EntryCard>
              <div className="mb-3 flex items-center justify-between">
                <GripHandle handleProps={handleProps} />
                <DeleteButton onClick={() => removeItem("education", item.id)} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <LabeledInput label="School / University" value={item.school} onChange={(v) => patchItem("education", item.id, { school: v })} placeholder="University" />
                <LabeledInput label="Degree" value={item.degree} onChange={(v) => patchItem("education", item.id, { degree: v })} placeholder="B.Tech" />
                <LabeledInput label="Field of Study" value={item.field} onChange={(v) => patchItem("education", item.id, { field: v })} placeholder="Computer Science" />
                <LabeledInput label="Graduation Date" type="month" value={item.gradDate} onChange={(v) => patchItem("education", item.id, { gradDate: v })} />
              </div>
              <div className="mt-3">
                <LabeledTextarea label="Description" optional value={item.description} onChange={(v) => patchItem("education", item.id, { description: v })} placeholder="Honors, relevant coursework, activities" />
              </div>
            </EntryCard>
          )}
        />
      </FormSection>

      {/* Section 5 — Skills */}
      <FormSection
        title="Skills"
        subtitle="Add skills from your previous resume or scratch, and verify them via JEMS assessments for verified badges."
        count={`${data.skills.length} skill${data.skills.length === 1 ? "" : "s"} on resume`}
      >
        {/* Add custom skill input */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill(newSkill);
              }
            }}
            placeholder="Type any skill (e.g. Next.js, Python, Figma) and press Enter"
            className="h-10 flex-1 rounded-lg border border-lightgray bg-white px-3 text-sm text-navy outline-none placeholder:text-mediumgray focus:border-slate"
          />
          <button
            type="button"
            onClick={() => addSkill(newSkill)}
            disabled={!newSkill.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-navy px-4 text-xs font-semibold text-white transition-colors hover:bg-[#1f2937] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

        {/* Current skills list */}
        {data.skills.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2 rounded-lg border border-lightgray bg-surface-2 p-3">
            {data.skills.map((s) => (
              <span
                key={s.id}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                  s.verified
                    ? "bg-emerald/10 text-emerald border border-emerald/30"
                    : "bg-white text-navy border border-lightgray"
                }`}
              >
                {s.verified && <BadgeCheck className="h-3.5 w-3.5 text-emerald" />}
                {s.name}
                <button
                  type="button"
                  onClick={() => removeItem("skills", s.id)}
                  title={`Remove ${s.name}`}
                  className="ml-1 text-mediumgray hover:text-red-500"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Verified skills section */}
        {verifiedSkills.length > 0 && (
          <div className="mt-4 border-t border-lightgray pt-4">
            <p className="mb-2 text-xs font-semibold text-navy flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4 text-emerald" />
              Verified Skills by JEMS (Click to toggle on resume):
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {verifiedSkills.map((vs) => {
                const on = data.skills.some((k) => k.name.trim().toLowerCase() === vs.name.trim().toLowerCase());
                return (
                  <li key={vs.name}>
                    <button
                      type="button"
                      onClick={() => toggleVerifiedSkill(vs)}
                      aria-pressed={on}
                      className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                        on ? "border-emerald/40 bg-emerald/5" : "border-lightgray hover:bg-surface-2"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          on ? "border-emerald bg-emerald text-white" : "border-lightgray bg-white"
                        }`}
                      >
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-navy">
                          {vs.name}
                          <BadgeCheck className="h-3 w-3 text-emerald" />
                        </span>
                        <span className="text-[10px] text-mediumgray">Verified · {levelLabel(vs.level)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </FormSection>

      {/* Section 6 — Certifications */}
      <FormSection
        title="Certifications"
        subtitle="Optional"
        count={`${data.certifications.length} added`}
        addLabel="Add Certification"
        onAdd={() => addItem("certifications", blankCert())}
      >
        <ReorderableList
          items={data.certifications}
          getKey={(it) => it.id}
          onReorder={(next) => reorderList("certifications", next)}
          renderItem={(item, _i, handleProps) => (
            <EntryCard>
              <div className="mb-3 flex items-center justify-between">
                <GripHandle handleProps={handleProps} />
                <DeleteButton onClick={() => removeItem("certifications", item.id)} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <LabeledInput label="Certification Name" value={item.name} onChange={(v) => patchItem("certifications", item.id, { name: v })} placeholder="Meta Front-End Developer" />
                <LabeledInput label="Issuing Organization" value={item.org} onChange={(v) => patchItem("certifications", item.id, { org: v })} placeholder="Coursera" />
                <LabeledInput label="Issue Date" type="month" value={item.issueDate} onChange={(v) => patchItem("certifications", item.id, { issueDate: v })} />
                <LabeledInput label="Expiration Date" optional type="month" value={item.expDate} onChange={(v) => patchItem("certifications", item.id, { expDate: v })} />
              </div>
            </EntryCard>
          )}
        />
      </FormSection>

      {/* Section 7 — Projects */}
      <FormSection
        title="Projects"
        subtitle="Optional"
        count={`${data.projects.length} added`}
        addLabel="Add Project"
        onAdd={() => addItem("projects", blankProject())}
      >
        <ReorderableList
          items={data.projects}
          getKey={(it) => it.id}
          onReorder={(next) => reorderList("projects", next)}
          renderItem={(item, _i, handleProps) => (
            <EntryCard>
              <div className="mb-3 flex items-center justify-between">
                <GripHandle handleProps={handleProps} />
                <DeleteButton onClick={() => removeItem("projects", item.id)} />
              </div>
              <div className="space-y-4">
                <LabeledInput label="Project Name" value={item.name} onChange={(v) => patchItem("projects", item.id, { name: v })} placeholder="DevBoard" />
                <LabeledTextarea label="Description" value={item.description} onChange={(v) => patchItem("projects", item.id, { description: v })} placeholder="What it does and your role" />
                <LabeledInput label="Technologies Used" value={item.tech} onChange={(v) => patchItem("projects", item.id, { tech: v })} placeholder="React, TypeScript, Node.js" />
                <LabeledInput label="Project Link" optional value={item.link} onChange={(v) => patchItem("projects", item.id, { link: v })} placeholder="github.com/you/project" />
              </div>
            </EntryCard>
          )}
        />
      </FormSection>
    </div>
  );
}
