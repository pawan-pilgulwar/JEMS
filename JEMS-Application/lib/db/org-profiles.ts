import { ObjectId, type Db } from "mongodb";
import { getDatabase } from "@/lib/db/mongodb";
import { institutionMatcher } from "@/lib/db/people";

/**
 * Profiles for the non-student roles, editable by their owner and viewable by
 * any signed-in user:
 *
 *  companyProfiles      { userId, companyName, industry, size, website, location, about, founded, linkedin, contactEmail, hiringFor[] }
 *  institutionProfiles  { userId, institutionName, type, location, website, about, departments[], accreditation, established, contactEmail, phone }
 *  facultyProfiles      { userId, institution, institutionId, department, designation, interests[], qualifications, experienceYears, bio, linkedin, scholar, phone }
 *
 * Students and faculty belong to an institution through `institutionId`
 * (the institution account's user id) plus its name, which is how the
 * institution portal scopes "our students / our faculty".
 */

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : []);
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : "");

async function getDb(): Promise<Db> {
  return getDatabase();
}

// ── Institutions directory (for pickers) ────────────────────────

export interface InstitutionOption {
  id: string;
  name: string;
  location: string;
}

/** Every registered institution, for the "your institution" pickers. */
export async function listInstitutions(): Promise<InstitutionOption[]> {
  try {
    const db = await getDb();
    const rows = await db.collection("institutionProfiles").find({}).project({ userId: 1, institutionName: 1, location: 1 }).sort({ institutionName: 1 }).toArray();
    return rows
      .filter((r) => r.userId instanceof ObjectId && str(r.institutionName))
      .map((r) => ({ id: r.userId.toString(), name: str(r.institutionName), location: str(r.location) }));
  } catch (err) {
    console.error("[org-profiles] listInstitutions failed:", err);
    return [];
  }
}

/** Resolves a picker choice to a registered institution; "" clears it. Undefined when the id is unknown. */
export async function resolveInstitution(id: string): Promise<{ id: ObjectId; name: string } | null | undefined> {
  if (!id) return null;
  if (!ObjectId.isValid(id)) return undefined;
  const db = await getDb();
  const p = await db.collection("institutionProfiles").findOne({ userId: new ObjectId(id) }, { projection: { institutionName: 1 } });
  return p ? { id: new ObjectId(id), name: str(p.institutionName) } : undefined;
}

// ── Company ─────────────────────────────────────────────────────

export interface CompanyProfile {
  userId: string;
  name: string;
  email: string;
  industry: string;
  size: string;
  website: string;
  location: string;
  about: string;
  founded: string;
  linkedin: string;
  contactEmail: string;
  hiringFor: string[];
  memberSince: string;
}

export interface CompanyProfilePublic extends CompanyProfile {
  openings: { id: string; role: string; type: string; location: string; requiredSkills: string[]; postedAt: string }[];
  programs: { id: string; title: string; type: string; startsAt: string; status: string }[];
  collaborations: { id: string; title: string; type: string; startsAt: string }[];
}

export async function getCompanyProfile(userId: string): Promise<CompanyProfile | null> {
  if (!ObjectId.isValid(userId)) return null;
  try {
    const db = await getDb();
    const _id = new ObjectId(userId);
    const [user, p] = await Promise.all([
      db.collection("users").findOne({ _id, role: "company" }, { projection: { name: 1, email: 1, createdAt: 1 } }),
      db.collection("companyProfiles").findOne({ userId: _id }),
    ]);
    if (!user) return null;
    return {
      userId,
      name: str(p?.companyName) || str(user.name) || "Company",
      email: str(user.email),
      industry: str(p?.industry),
      size: str(p?.size),
      website: str(p?.website),
      location: str(p?.location),
      about: str(p?.about),
      founded: str(p?.founded),
      linkedin: str(p?.linkedin),
      contactEmail: str(p?.contactEmail),
      hiringFor: strArr(p?.hiringFor),
      memberSince: iso(user.createdAt),
    };
  } catch (err) {
    console.error("[org-profiles] getCompanyProfile failed:", err);
    return null;
  }
}

/** The company page students and academics see: profile plus what it currently offers. */
export async function getCompanyProfilePublic(userId: string): Promise<CompanyProfilePublic | null> {
  const profile = await getCompanyProfile(userId);
  if (!profile) return null;
  try {
    const db = await getDb();
    const companyId = new ObjectId(userId);
    const [jobs, programs, collabs] = await Promise.all([
      db.collection("jobPostings").find({ companyId, status: { $ne: "closed" } }).sort({ postedAt: -1 }).limit(20).toArray(),
      db.collection("industryPrograms").find({ companyId, status: { $ne: "closed" } }).sort({ startsAt: 1 }).limit(20).toArray(),
      db.collection("collaborations").find({ companyId, status: { $ne: "closed" } }).sort({ startsAt: 1 }).limit(20).toArray(),
    ]);
    return {
      ...profile,
      openings: jobs.map((j) => ({ id: j._id.toString(), role: str(j.role), type: str(j.type), location: str(j.location), requiredSkills: strArr(j.requiredSkills), postedAt: iso(j.postedAt) })),
      programs: programs.map((p) => ({ id: p._id.toString(), title: str(p.title), type: str(p.type), startsAt: iso(p.startsAt), status: str(p.status) || "open" })),
      collaborations: collabs.map((c) => ({ id: c._id.toString(), title: str(c.title), type: str(c.type), startsAt: iso(c.startsAt) })),
    };
  } catch (err) {
    console.error("[org-profiles] getCompanyProfilePublic failed:", err);
    return { ...profile, openings: [], programs: [], collaborations: [] };
  }
}

export type CompanyProfileInput = Omit<CompanyProfile, "userId" | "email" | "memberSince">;

export async function updateCompanyProfile(userId: string, input: CompanyProfileInput): Promise<boolean> {
  if (!ObjectId.isValid(userId)) return false;
  try {
    const db = await getDb();
    const _id = new ObjectId(userId);
    const now = new Date();
    const { name, ...rest } = input;
    await db.collection("companyProfiles").updateOne(
      { userId: _id },
      { $set: { companyName: name, ...rest, updatedAt: now }, $setOnInsert: { userId: _id, createdAt: now } },
      { upsert: true },
    );
    // Openings, programs and collaborations carry the company name for display.
    await Promise.all(
      ["jobPostings", "industryPrograms", "collaborations"].map((c) => db.collection(c).updateMany({ companyId: _id }, { $set: { company: name } })),
    );
    await db.collection("users").updateOne({ _id }, { $set: { name, updatedAt: now } });
    return true;
  } catch (err) {
    console.error("[org-profiles] updateCompanyProfile failed:", err);
    return false;
  }
}

// ── Institution ─────────────────────────────────────────────────

export interface InstitutionProfile {
  userId: string;
  name: string;
  email: string;
  type: string;
  location: string;
  website: string;
  about: string;
  departments: string[];
  accreditation: string;
  established: string;
  contactEmail: string;
  phone: string;
}

export interface InstitutionProfilePublic extends InstitutionProfile {
  stats: { students: number; faculty: number };
}

export async function getInstitutionProfile(userId: string): Promise<InstitutionProfile | null> {
  if (!ObjectId.isValid(userId)) return null;
  try {
    const db = await getDb();
    const _id = new ObjectId(userId);
    const [user, p] = await Promise.all([
      db.collection("users").findOne({ _id, role: "institution" }, { projection: { name: 1, email: 1 } }),
      db.collection("institutionProfiles").findOne({ userId: _id }),
    ]);
    if (!user) return null;
    return {
      userId,
      name: str(p?.institutionName) || str(user.name) || "Institution",
      email: str(user.email),
      type: str(p?.type),
      location: str(p?.location),
      website: str(p?.website),
      about: str(p?.about),
      departments: strArr(p?.departments),
      accreditation: str(p?.accreditation),
      established: str(p?.established),
      contactEmail: str(p?.contactEmail),
      phone: str(p?.phone),
    };
  } catch (err) {
    console.error("[org-profiles] getInstitutionProfile failed:", err);
    return null;
  }
}

/** Members of an institution: linked by id, or (older profiles) by name. */
export function institutionMemberFilter(institutionUserId: ObjectId, name: string) {
  const or: Record<string, unknown>[] = [{ institutionId: institutionUserId }];
  // `institutionId: null` matches profiles with no link yet (missing or null).
  if (name.trim()) or.push({ institutionId: null, institution: institutionMatcher(name) });
  return { $or: or };
}

export async function getInstitutionProfilePublic(userId: string): Promise<InstitutionProfilePublic | null> {
  const profile = await getInstitutionProfile(userId);
  if (!profile) return null;
  try {
    const db = await getDb();
    const filter = institutionMemberFilter(new ObjectId(userId), profile.name);
    const [students, faculty] = await Promise.all([
      db.collection("studentProfiles").countDocuments(filter),
      db.collection("facultyProfiles").countDocuments(filter),
    ]);
    return { ...profile, stats: { students, faculty } };
  } catch (err) {
    console.error("[org-profiles] getInstitutionProfilePublic failed:", err);
    return { ...profile, stats: { students: 0, faculty: 0 } };
  }
}

export type InstitutionProfileInput = Omit<InstitutionProfile, "userId" | "email">;

export async function updateInstitutionProfile(userId: string, input: InstitutionProfileInput): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!ObjectId.isValid(userId)) return { ok: false, error: "Not found." };
  try {
    const db = await getDb();
    const _id = new ObjectId(userId);
    const clash = await db.collection("institutionProfiles").findOne({ userId: { $ne: _id }, institutionName: institutionMatcher(input.name) }, { projection: { _id: 1 } });
    if (clash) return { ok: false, error: "Another institution is already registered with that name." };
    const before = await db.collection("institutionProfiles").findOne({ userId: _id }, { projection: { institutionName: 1 } });
    const now = new Date();
    const { name, ...rest } = input;
    await db.collection("institutionProfiles").updateOne(
      { userId: _id },
      { $set: { institutionName: name, ...rest, updatedAt: now }, $setOnInsert: { userId: _id, createdAt: now } },
      { upsert: true },
    );
    await db.collection("users").updateOne({ _id }, { $set: { name, updatedAt: now } });
    // Keep members' display name in step, and link name-matched members by id
    // so a rename doesn't silently detach them.
    const oldName = str(before?.institutionName);
    const members = { $or: [{ institutionId: _id }, ...(oldName ? [{ institution: institutionMatcher(oldName) }] : [])] };
    await Promise.all(
      ["studentProfiles", "facultyProfiles"].map((c) => db.collection(c).updateMany(members, { $set: { institution: name, institutionId: _id } })),
    );
    return { ok: true };
  } catch (err) {
    console.error("[org-profiles] updateInstitutionProfile failed:", err);
    return { ok: false, error: "Could not save the profile." };
  }
}

// ── Faculty ─────────────────────────────────────────────────────

export interface FacultyProfile {
  userId: string;
  name: string;
  email: string;
  institution: string;
  institutionId: string;
  department: string;
  designation: string;
  interests: string[];
  qualifications: string;
  experienceYears: string;
  bio: string;
  linkedin: string;
  scholar: string;
  phone: string;
}

export interface FacultyProfilePublic extends FacultyProfile {
  collaborations: { id: string; title: string; company: string; type: string; status: string }[];
}

export async function getFacultyProfile(userId: string): Promise<FacultyProfile | null> {
  if (!ObjectId.isValid(userId)) return null;
  try {
    const db = await getDb();
    const _id = new ObjectId(userId);
    const [user, p] = await Promise.all([
      db.collection("users").findOne({ _id, role: "faculty" }, { projection: { name: 1, email: 1 } }),
      db.collection("facultyProfiles").findOne({ userId: _id }),
    ]);
    if (!user) return null;
    return {
      userId,
      name: str(user.name) || "Faculty member",
      email: str(user.email),
      institution: str(p?.institution),
      institutionId: p?.institutionId instanceof ObjectId ? p.institutionId.toString() : "",
      department: str(p?.department),
      designation: str(p?.designation),
      interests: strArr(p?.interests),
      qualifications: str(p?.qualifications),
      experienceYears: str(p?.experienceYears),
      bio: str(p?.bio),
      linkedin: str(p?.linkedin),
      scholar: str(p?.scholar),
      phone: str(p?.phone),
    };
  } catch (err) {
    console.error("[org-profiles] getFacultyProfile failed:", err);
    return null;
  }
}

export async function getFacultyProfilePublic(userId: string): Promise<FacultyProfilePublic | null> {
  const profile = await getFacultyProfile(userId);
  if (!profile) return null;
  try {
    const db = await getDb();
    const interests = await db.collection("collaborationInterests").find({ userId: new ObjectId(userId) }).sort({ createdAt: -1 }).toArray();
    const collabs = await db.collection("collaborations").find({ _id: { $in: interests.map((i) => i.collaborationId as ObjectId) } }).toArray();
    const byId = new Map(collabs.map((c) => [c._id.toString(), c]));
    return {
      ...profile,
      collaborations: interests.flatMap((i) => {
        const c = byId.get(String(i.collaborationId));
        return c ? [{ id: c._id.toString(), title: str(c.title), company: str(c.company), type: str(c.type), status: str(i.status) || "Interested" }] : [];
      }),
    };
  } catch (err) {
    console.error("[org-profiles] getFacultyProfilePublic failed:", err);
    return { ...profile, collaborations: [] };
  }
}

export type FacultyProfileInput = Omit<FacultyProfile, "userId" | "email" | "institution">;

export async function updateFacultyProfile(userId: string, input: FacultyProfileInput): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!ObjectId.isValid(userId)) return { ok: false, error: "Not found." };
  try {
    const inst = await resolveInstitution(input.institutionId);
    if (inst === undefined) return { ok: false, error: "Pick your institution from the list." };
    const db = await getDb();
    const _id = new ObjectId(userId);
    const now = new Date();
    const { name, institutionId: _ignored, ...rest } = input;
    void _ignored;
    await db.collection("facultyProfiles").updateOne(
      { userId: _id },
      inst
        ? { $set: { ...rest, institution: inst.name, institutionId: inst.id, updatedAt: now }, $setOnInsert: { userId: _id, createdAt: now } }
        : { $set: { ...rest, institution: "", updatedAt: now }, $unset: { institutionId: "" }, $setOnInsert: { userId: _id, createdAt: now } },
      { upsert: true },
    );
    await db.collection("users").updateOne({ _id }, { $set: { name, updatedAt: now } });
    return { ok: true };
  } catch (err) {
    console.error("[org-profiles] updateFacultyProfile failed:", err);
    return { ok: false, error: "Could not save the profile." };
  }
}
