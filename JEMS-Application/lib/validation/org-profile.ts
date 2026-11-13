/** Server-side validation for the company / institution / faculty profile editors. */

import type { CompanyProfileInput, FacultyProfileInput, InstitutionProfileInput } from "@/lib/db/org-profiles";
import type { ValidationResult } from "./student";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** "A, B ,C" or ["A","B"] → trimmed, de-duplicated list. */
function list(v: unknown, max: number, itemMax = 60): string[] {
  const raw = Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : "")) : text(v, 2_000).split(",");
  const seen = new Set<string>();
  return raw
    .map((s) => s.trim().slice(0, itemMax))
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
    .slice(0, max);
}

/** Accepts "site.com" or a full URL; rejects anything that isn't http(s). */
function url(v: unknown): string | null {
  const s = text(v, 300);
  if (!s) return "";
  const full = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(full);
    return u.protocol === "http:" || u.protocol === "https:" ? full : null;
  } catch {
    return null;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function email(v: unknown): string | null {
  const s = text(v, 200).toLowerCase();
  return !s || EMAIL.test(s) ? s : null;
}

export function validateCompanyProfile(body: unknown): ValidationResult<CompanyProfileInput> {
  if (!isRecord(body)) return { error: "Invalid request body." };
  const name = text(body.name, 120);
  if (name.length < 2) return { error: "Company name is required." };
  const website = url(body.website);
  const linkedin = url(body.linkedin);
  const contactEmail = email(body.contactEmail);
  if (website === null || linkedin === null) return { error: "Enter valid website / LinkedIn links." };
  if (contactEmail === null) return { error: "Enter a valid contact email." };
  return {
    value: {
      name, website, linkedin, contactEmail,
      industry: text(body.industry, 80),
      size: text(body.size, 40),
      location: text(body.location, 120),
      about: text(body.about, 2_000),
      founded: text(body.founded, 10),
      hiringFor: list(body.hiringFor, 15),
    },
  };
}

export function validateInstitutionProfile(body: unknown): ValidationResult<InstitutionProfileInput> {
  if (!isRecord(body)) return { error: "Invalid request body." };
  const name = text(body.name, 150);
  if (name.length < 3) return { error: "Institution name is required." };
  const website = url(body.website);
  const contactEmail = email(body.contactEmail);
  if (website === null) return { error: "Enter a valid website." };
  if (contactEmail === null) return { error: "Enter a valid contact email." };
  return {
    value: {
      name, website, contactEmail,
      type: text(body.type, 60),
      location: text(body.location, 120),
      about: text(body.about, 2_000),
      departments: list(body.departments, 40, 80),
      accreditation: text(body.accreditation, 120),
      established: text(body.established, 10),
      phone: text(body.phone, 40),
    },
  };
}

export function validateFacultyProfile(body: unknown): ValidationResult<FacultyProfileInput> {
  if (!isRecord(body)) return { error: "Invalid request body." };
  const name = text(body.name, 120);
  if (name.length < 2) return { error: "Your name is required." };
  const linkedin = url(body.linkedin);
  const scholar = url(body.scholar);
  if (linkedin === null || scholar === null) return { error: "Enter valid LinkedIn / Google Scholar links." };
  return {
    value: {
      name, linkedin, scholar,
      institutionId: text(body.institutionId, 40),
      department: text(body.department, 100),
      designation: text(body.designation, 80),
      interests: list(body.interests, 15),
      qualifications: text(body.qualifications, 300),
      experienceYears: text(body.experienceYears, 10),
      bio: text(body.bio, 2_000),
      phone: text(body.phone, 40),
    },
  };
}
