import { emptyResume, type ResumeData, uid } from "./types";

/**
 * Best-effort conversion of a pasted plain-text resume into structured
 * resume data, so a student can start a 1-page version from an old resume.
 * It recognises contact details and the usual section headings; anything it
 * can't place stays in the summary for the student to tidy up.
 */

type Section = "summary" | "experience" | "education" | "skills" | "projects" | "certifications" | "other";

const HEADINGS: [Section, RegExp][] = [
  ["summary", /^(summary|profile|objective|about( me)?|professional summary|career objective)$/i],
  ["experience", /^(experience|work experience|professional experience|employment( history)?|internships?|work history)$/i],
  ["education", /^(education|academics?|academic (background|details)|qualifications?)$/i],
  ["skills", /^(skills|technical skills|key skills|core competencies|technologies|tech stack)$/i],
  ["projects", /^(projects|academic projects|personal projects|key projects)$/i],
  ["certifications", /^(certifications?|certificates?|licen[cs]es?( & certifications)?|courses)$/i],
  ["other", /^(achievements|awards|hobbies|interests|languages|activities|extra[- ]curricular( activities)?|references|declaration)$/i],
];

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /(\+?\d[\d\s().-]{8,}\d)/;
const LINKEDIN = /(https?:\/\/)?(www\.)?linkedin\.com\/[^\s|,]+/i;
const URL = /(https?:\/\/|www\.)[^\s|,]+|\b[\w-]+\.(dev|io|me|com|in|app)\/?[^\s|,]*/i;
const DATE_RANGE = /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{1,2}\/\d{4}|\d{4})\s*(?:-|–|—|to)\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{1,2}\/\d{4}|\d{4}|present|current|now|ongoing)/i;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const clean = (l: string) => l.replace(/^[\s•●▪◦·*\-–—]+/, "").trim();
const isBullet = (l: string) => /^[\s]*[•●▪◦·*\-–—]/.test(l);

/** "Jan 2023" / "01/2023" / "2023" → "2023-01" (month inputs use YYYY-MM). */
function toMonth(v: string): string {
  const s = v.trim().toLowerCase();
  const year = s.match(/\d{4}/)?.[0];
  if (!year) return "";
  const slash = s.match(/^(\d{1,2})\/\d{4}$/);
  if (slash) return `${year}-${slash[1].padStart(2, "0")}`;
  const m = MONTHS.findIndex((x) => s.startsWith(x));
  return `${year}-${String(m >= 0 ? m + 1 : 1).padStart(2, "0")}`;
}

function sectionOf(line: string): Section | null {
  const t = clean(line).replace(/[:|]+$/, "").trim();
  if (t.length > 40) return null;
  return HEADINGS.find(([, re]) => re.test(t))?.[0] ?? null;
}

/** Splits a section into entries: a new entry starts at each non-bullet line after bullets/description. */
function entries(lines: string[]): { head: string[]; body: string[] }[] {
  const out: { head: string[]; body: string[] }[] = [];
  for (const raw of lines) {
    const line = clean(raw);
    if (!line) continue;
    const cur = out[out.length - 1];
    if (!cur || (!isBullet(raw) && cur.body.length > 0) || (!isBullet(raw) && cur.head.length >= 2 && !DATE_RANGE.test(line))) {
      out.push({ head: isBullet(raw) ? [] : [line], body: isBullet(raw) ? [line] : [] });
    } else if (isBullet(raw) || cur.head.length >= 2) {
      cur.body.push(line);
    } else {
      cur.head.push(line);
    }
  }
  return out;
}

/** Pulls a date range out of an entry's heading lines and returns the rest. */
function splitDates(head: string[]): { rest: string[]; start: string; end: string; current: boolean } {
  let start = "", end = "", current = false;
  const rest = head
    .map((l) => {
      const m = l.match(DATE_RANGE);
      if (!m || start) return l;
      start = toMonth(m[1]);
      current = /present|current|now|ongoing/i.test(m[2]);
      end = current ? "" : toMonth(m[2]);
      return l.replace(m[0], "").replace(/[|,–—-]\s*$/, "").replace(/^\s*[|,–—-]/, "").trim();
    })
    .filter(Boolean);
  return { rest, start, end, current };
}

/** "Software Intern at Acme" / "Software Intern | Acme" / "Acme — Software Intern" → [title, company]. */
function titleAndCompany(rest: string[]): [string, string] {
  if (rest.length >= 2) return [rest[0], rest[1]];
  const one = rest[0] ?? "";
  const at = one.split(/\s+at\s+|\s*[|@]\s*|\s+[–—-]\s+|,\s*/);
  return at.length >= 2 ? [at[0].trim(), at.slice(1).join(", ").trim()] : [one, ""];
}

export function parseResumeText(text: string): { data: ResumeData; found: string[] } {
  const data = emptyResume();
  const found: string[] = [];
  const lines = text.replace(/\r/g, "").split("\n");

  // ── Contact block: everything before the first section heading ──
  const firstHeading = lines.findIndex((l) => sectionOf(l));
  const top = (firstHeading === -1 ? lines.slice(0, 6) : lines.slice(0, firstHeading)).map((l) => l.trim()).filter(Boolean);
  const blob = top.join(" | ");
  data.header.email = blob.match(EMAIL)?.[0] ?? "";
  data.header.phone = blob.match(PHONE)?.[0]?.trim() ?? "";
  data.header.linkedin = blob.match(LINKEDIN)?.[0] ?? "";
  const site = blob.replace(LINKEDIN, "").replace(EMAIL, "").match(URL)?.[0] ?? "";
  data.header.portfolio = site;
  const contactish = (l: string) => EMAIL.test(l) || PHONE.test(l) || LINKEDIN.test(l) || (site && l.includes(site));
  const plain = top.filter((l) => !contactish(l));
  data.header.fullName = plain[0] && plain[0].length <= 50 ? plain[0] : "";
  if (plain[1] && plain[1].length <= 60 && !/[.!?]$/.test(plain[1])) data.header.title = plain[1];
  if (data.header.fullName) found.push("name");
  if (data.header.email || data.header.phone) found.push("contact details");

  // ── Sections ──
  const sections = new Map<Section, string[]>();
  let current: Section = firstHeading === -1 ? "summary" : "other";
  for (const line of firstHeading === -1 ? lines.slice(top.length) : lines.slice(firstHeading)) {
    const heading = sectionOf(line);
    if (heading) {
      current = heading;
      if (!sections.has(heading)) sections.set(heading, []);
      continue;
    }
    sections.set(current, [...(sections.get(current) ?? []), line]);
  }

  const summary = (sections.get("summary") ?? []).map(clean).filter(Boolean).join(" ");
  if (summary) {
    data.summary = summary.slice(0, 600);
    found.push("summary");
  }

  data.experience = entries(sections.get("experience") ?? []).slice(0, 6).map((e) => {
    const { rest, start, end, current } = splitDates(e.head);
    const [jobTitle, company] = titleAndCompany(rest);
    return { id: uid("exp"), jobTitle, company, start, end, current, description: e.body.map((b) => `• ${b}`).join("\n") };
  });
  if (data.experience.length) found.push(`${data.experience.length} experience`);

  data.education = entries(sections.get("education") ?? []).slice(0, 4).map((e) => {
    const { rest, end, start } = splitDates(e.head);
    const year = end || start || (e.head.join(" ").match(/\b(19|20)\d{2}\b/)?.[0] ? toMonth(e.head.join(" ").match(/\b(19|20)\d{2}\b/)![0]) : "");
    const schoolLine = rest.find((l) => /universit|college|institute|school|iit|nit|academy/i.test(l)) ?? rest[0] ?? "";
    const degreeLine = rest.find((l) => l !== schoolLine) ?? "";
    const [degree, field] = degreeLine.split(/\s+in\s+|,\s*/);
    return { id: uid("edu"), school: schoolLine, degree: (degree ?? "").trim(), field: (field ?? "").trim(), gradDate: year, description: e.body.join(" ") };
  });
  if (data.education.length) found.push(`${data.education.length} education`);

  const skillText = (sections.get("skills") ?? []).map((l) => clean(l).replace(/^[\w &/]+:\s*/, "")).join(", ");
  const seen = new Set<string>();
  data.skills = skillText
    .split(/[,;|•·\n]/)
    .map((s) => s.trim())
    .filter((s) => s && s.length <= 30 && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
    .slice(0, 20)
    .map((name) => ({ id: uid("skill"), name, level: "Intermediate" as const, verified: false }));
  if (data.skills.length) found.push(`${data.skills.length} skills`);

  data.projects = entries(sections.get("projects") ?? []).slice(0, 4).map((e) => {
    const head = e.head.join(" ");
    const tech = head.match(/\(([^)]+)\)|[|–—-]\s*(.+)$/);
    const name = head.replace(/\(([^)]+)\)/, "").split(/\s*[|–—-]\s*/)[0].trim();
    return { id: uid("proj"), name, tech: (tech?.[1] ?? tech?.[2] ?? "").trim(), link: head.match(URL)?.[0] ?? "", description: e.body.join(" ") };
  });
  if (data.projects.length) found.push(`${data.projects.length} projects`);

  data.certifications = (sections.get("certifications") ?? [])
    .map(clean)
    .filter(Boolean)
    .slice(0, 6)
    .map((l) => {
      const year = l.match(/\b(19|20)\d{2}\b/)?.[0];
      const [name, org] = l.replace(/\(?\b(19|20)\d{2}\b\)?/, "").split(/\s*[|–—-]\s*|\s+by\s+|,\s*/);
      return { id: uid("cert"), name: (name ?? "").trim(), org: (org ?? "").trim(), issueDate: year ? `${year}-01` : "", expDate: "" };
    });
  if (data.certifications.length) found.push(`${data.certifications.length} certifications`);

  // Nothing recognised: keep the text so the student doesn't lose it.
  if (found.length === 0) data.summary = lines.map((l) => l.trim()).filter(Boolean).join(" ").slice(0, 600);

  return { data, found };
}
