import { ObjectId, type Db, type Document } from "mongodb";

/**
 * Small read-side helpers shared by the industry, institution and faculty
 * screens: turning student / academician ids into display rows in one
 * round-trip per collection instead of one query per person.
 */

const str = (v: unknown): string => (typeof v === "string" ? v : "");

export interface StudentSkill {
  name: string;
  level: number;
  verified: boolean;
}

export interface StudentSummary {
  studentId: string;
  name: string;
  email: string;
  institution: string;
  targetRole: string;
  readiness: number;
  skills: StudentSkill[];
  verifiedSkills: number;
}

export function skillsFromProfile(p: Document | null | undefined): StudentSkill[] {
  return (Array.isArray(p?.skills) ? p!.skills : [])
    .map((s: Record<string, unknown>) => ({ name: str(s?.name), level: Number(s?.level) || 0, verified: Boolean(s?.verified) }))
    .filter((s: StudentSkill) => s.name);
}

export function targetRoleFromProfile(p: Document | null | undefined): string {
  const goals = (p?.goals ?? {}) as Record<string, unknown>;
  return str(goals.careerTitle) || str(p?.targetRole) || "—";
}

/** Display rows for the given students, keyed by studentId. Missing users are skipped. */
export async function loadStudentSummaries(db: Db, ids: ObjectId[]): Promise<Map<string, StudentSummary>> {
  const out = new Map<string, StudentSummary>();
  if (ids.length === 0) return out;
  const [users, profiles, analytics] = await Promise.all([
    db.collection("users").find({ _id: { $in: ids } }).project({ name: 1, email: 1 }).toArray(),
    db.collection("studentProfiles").find({ userId: { $in: ids } }).toArray(),
    db.collection("studentAnalytics").find({ studentId: { $in: ids } }).project({ studentId: 1, readiness: 1 }).toArray(),
  ]);
  const profileBy = new Map(profiles.map((p) => [String(p.userId), p]));
  const readinessBy = new Map(analytics.map((a) => [String(a.studentId), Number(a.readiness) || 0]));
  for (const u of users) {
    const k = u._id.toString();
    const p = profileBy.get(k);
    const skills = skillsFromProfile(p);
    out.set(k, {
      studentId: k,
      name: str(p?.displayName) || str(u.name) || str(u.email) || "Student",
      email: str(u.email),
      institution: str(p?.institution),
      targetRole: targetRoleFromProfile(p),
      readiness: readinessBy.get(k) ?? 0,
      skills,
      verifiedSkills: skills.filter((s) => s.verified).length,
    });
  }
  return out;
}

export interface AcademicSummary {
  userId: string;
  name: string;
  email: string;
  role: "faculty" | "institution";
  institution: string;
  department: string;
  designation: string;
}

/** Faculty and institution users who left interest on a collaboration, keyed by userId. */
export async function loadAcademics(db: Db, ids: ObjectId[]): Promise<Map<string, AcademicSummary>> {
  const out = new Map<string, AcademicSummary>();
  if (ids.length === 0) return out;
  const [users, faculty, institutions] = await Promise.all([
    db.collection("users").find({ _id: { $in: ids } }).project({ name: 1, email: 1, role: 1 }).toArray(),
    db.collection("facultyProfiles").find({ userId: { $in: ids } }).toArray(),
    db.collection("institutionProfiles").find({ userId: { $in: ids } }).toArray(),
  ]);
  const facultyBy = new Map(faculty.map((f) => [String(f.userId), f]));
  const instBy = new Map(institutions.map((i) => [String(i.userId), i]));
  for (const u of users) {
    const k = u._id.toString();
    const isInst = str(u.role) === "institution";
    const f = facultyBy.get(k);
    const i = instBy.get(k);
    out.set(k, {
      userId: k,
      name: str(u.name) || str(u.email) || (isInst ? "Institution" : "Faculty member"),
      email: str(u.email),
      role: isInst ? "institution" : "faculty",
      institution: isInst ? str(i?.institutionName) || str(u.name) : str(f?.institution),
      department: isInst ? "Placement / T&P cell" : str(f?.department),
      designation: isInst ? "Institution" : str(f?.designation),
    });
  }
  return out;
}

/** Case-insensitive exact match on an institution name, safe against regex metacharacters. */
export function institutionMatcher(name: string): RegExp {
  return new RegExp(`^\\s*${name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
}
