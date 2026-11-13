import { ObjectId, type Db, type Document } from "mongodb";
import { getDatabase } from "@/lib/db/mongodb";
import { scoreAgainst } from "@/lib/agents/engine";
import { createNotification } from "@/lib/db/notifications";
import { loadStudentSummaries, skillsFromProfile } from "@/lib/db/people";
import type { EnrollmentStatus, ListingStatus } from "@/lib/company/constants";

/**
 * Industry learning programs and the students who apply to them.
 *
 *  industryPrograms   { companyId?, company, title, type, skills, duration, mode, seats, startsAt, status? }
 *  programEnrollments { programId, studentId, companyId?, status, motivation, createdAt, updatedAt }
 *                     (unique programId+studentId)
 *
 * Seats count *accepted* students; applying is allowed until the program is
 * full or the company closes it.
 */

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : []);
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : "");

async function getDb(): Promise<Db> {
  return getDatabase();
}

export interface ProgramBase {
  id: string;
  company: string;
  companyId: string;
  title: string;
  type: string;
  skills: string[];
  duration: string;
  mode: string;
  seats: number;
  startsAt: string;
  status: ListingStatus;
  applied: number;
  accepted: number;
  seatsLeft: number;
}

function programFromDoc(d: Document, counts?: { applied: number; accepted: number }): ProgramBase {
  const seats = Number(d.seats) || 0;
  const accepted = counts?.accepted ?? 0;
  return {
    id: d._id.toString(),
    company: str(d.company),
    companyId: d.companyId instanceof ObjectId ? d.companyId.toString() : "",
    title: str(d.title),
    type: str(d.type),
    skills: strArr(d.skills),
    duration: str(d.duration),
    mode: str(d.mode),
    seats,
    startsAt: iso(d.startsAt),
    status: str(d.status) === "closed" ? "closed" : "open",
    applied: counts?.applied ?? 0,
    accepted,
    seatsLeft: seats > 0 ? Math.max(0, seats - accepted) : 0,
  };
}

/** Applied / accepted counts per program (withdrawn rows are deleted, rejected ones don't count as applied). */
async function enrollmentCounts(db: Db, programIds: ObjectId[]): Promise<Map<string, { applied: number; accepted: number }>> {
  const rows = await db
    .collection("programEnrollments")
    .aggregate([
      { $match: { programId: { $in: programIds } } },
      {
        $group: {
          _id: "$programId",
          applied: { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 0, 1] } },
          accepted: { $sum: { $cond: [{ $in: ["$status", ["Accepted", "Completed"]] }, 1, 0] } },
        },
      },
    ])
    .toArray();
  return new Map(rows.map((r) => [String(r._id), { applied: Number(r.applied) || 0, accepted: Number(r.accepted) || 0 }]));
}

// ── Student side ────────────────────────────────────────────────

export interface StudentProgramView extends ProgramBase {
  /** How many of the program's skills the student already lists. */
  matched: string[];
  /** Skills the program teaches that the student doesn't have yet — the reason to join. */
  gaps: string[];
  myEnrollment: { id: string; status: string; appliedAt: string } | null;
}

export async function listProgramsForStudent(studentUserId: string): Promise<StudentProgramView[]> {
  if (!ObjectId.isValid(studentUserId)) return [];
  try {
    const db = await getDb();
    const studentId = new ObjectId(studentUserId);
    const [programs, profile, mine] = await Promise.all([
      db.collection("industryPrograms").find({}).sort({ startsAt: 1 }).toArray(),
      db.collection("studentProfiles").findOne({ userId: studentId }),
      db.collection("programEnrollments").find({ studentId }).toArray(),
    ]);
    const counts = await enrollmentCounts(db, programs.map((p) => p._id));
    const skills = skillsFromProfile(profile);
    const mineBy = new Map(mine.map((e) => [String(e.programId), e]));
    return programs.map((p) => {
      const base = programFromDoc(p, counts.get(p._id.toString()));
      const { matched, missing } = scoreAgainst(skills, base.skills);
      const e = mineBy.get(base.id);
      return {
        ...base,
        matched,
        gaps: missing,
        myEnrollment: e ? { id: e._id.toString(), status: str(e.status) || "Applied", appliedAt: iso(e.createdAt) } : null,
      };
    });
  } catch (err) {
    console.error("[programs] listProgramsForStudent failed:", err);
    return [];
  }
}

type Fail = { ok: false; status: number; error: string };

export async function applyToProgram(studentUserId: string, programId: string, motivation: string): Promise<{ ok: true; id: string } | Fail> {
  if (!ObjectId.isValid(studentUserId) || !ObjectId.isValid(programId)) return { ok: false, status: 400, error: "Invalid program." };
  try {
    const db = await getDb();
    const studentId = new ObjectId(studentUserId);
    const program = await db.collection("industryPrograms").findOne({ _id: new ObjectId(programId) });
    if (!program) return { ok: false, status: 404, error: "Program not found." };
    if (str(program.status) === "closed") return { ok: false, status: 409, error: "This program is no longer accepting applications." };
    const existing = await db.collection("programEnrollments").findOne({ programId: program._id, studentId });
    if (existing) return { ok: false, status: 409, error: "You have already applied to this program." };
    const seats = Number(program.seats) || 0;
    if (seats > 0) {
      const accepted = await db.collection("programEnrollments").countDocuments({ programId: program._id, status: { $in: ["Accepted", "Completed"] } });
      if (accepted >= seats) return { ok: false, status: 409, error: "All seats in this program are filled." };
    }
    const now = new Date();
    const res = await db.collection("programEnrollments").insertOne({
      programId: program._id,
      studentId,
      companyId: program.companyId instanceof ObjectId ? program.companyId : null,
      status: "Applied",
      motivation: motivation.slice(0, 600),
      createdAt: now,
      updatedAt: now,
    });
    if (program.companyId instanceof ObjectId) {
      const student = await db.collection("users").findOne({ _id: studentId }, { projection: { name: 1 } });
      await createNotification({
        userId: program.companyId,
        kind: "application",
        title: `New applicant for ${str(program.title)}`,
        body: `${str(student?.name) || "A student"} applied to your program.`,
        link: `/company/programs?program=${program._id.toString()}`,
      });
    }
    return { ok: true, id: res.insertedId.toString() };
  } catch (err) {
    console.error("[programs] applyToProgram failed:", err);
    return { ok: false, status: 500, error: "Could not apply right now." };
  }
}

/** Students can withdraw until they've been accepted. */
export async function withdrawFromProgram(studentUserId: string, programId: string): Promise<boolean> {
  if (!ObjectId.isValid(studentUserId) || !ObjectId.isValid(programId)) return false;
  try {
    const db = await getDb();
    const res = await db.collection("programEnrollments").deleteOne({
      programId: new ObjectId(programId),
      studentId: new ObjectId(studentUserId),
      status: { $nin: ["Accepted", "Completed"] },
    });
    return res.deletedCount === 1;
  } catch (err) {
    console.error("[programs] withdrawFromProgram failed:", err);
    return false;
  }
}

// ── Company side ────────────────────────────────────────────────

export interface ProgramApplicantView {
  enrollmentId: string;
  studentId: string;
  name: string;
  email: string;
  institution: string;
  targetRole: string;
  readiness: number;
  verifiedSkills: number;
  /** Share of the program's skills the student already has — useful for cohort balancing. */
  fit: number;
  status: string;
  motivation: string;
  appliedAt: string;
}

export interface CompanyProgramView extends ProgramBase {
  applicants: ProgramApplicantView[];
}

export async function listCompanyProgramsWithApplicants(companyUserId: string): Promise<CompanyProgramView[]> {
  if (!ObjectId.isValid(companyUserId)) return [];
  try {
    const db = await getDb();
    const programs = await db.collection("industryPrograms").find({ companyId: new ObjectId(companyUserId) }).sort({ startsAt: 1 }).toArray();
    const ids = programs.map((p) => p._id);
    const [counts, enrollments] = await Promise.all([
      enrollmentCounts(db, ids),
      db.collection("programEnrollments").find({ programId: { $in: ids } }).sort({ createdAt: -1 }).toArray(),
    ]);
    const students = await loadStudentSummaries(db, [...new Set(enrollments.map((e) => String(e.studentId)))].map((s) => new ObjectId(s)));
    const byProgram = new Map<string, Document[]>();
    for (const e of enrollments) byProgram.set(String(e.programId), [...(byProgram.get(String(e.programId)) ?? []), e]);

    return programs.map((p) => {
      const base = programFromDoc(p, counts.get(p._id.toString()));
      const applicants = (byProgram.get(base.id) ?? []).flatMap((e): ProgramApplicantView[] => {
        const s = students.get(String(e.studentId));
        if (!s) return [];
        return [{
          enrollmentId: e._id.toString(),
          studentId: s.studentId,
          name: s.name,
          email: s.email,
          institution: s.institution,
          targetRole: s.targetRole,
          readiness: s.readiness,
          verifiedSkills: s.verifiedSkills,
          fit: scoreAgainst(s.skills, base.skills).score,
          status: str(e.status) || "Applied",
          motivation: str(e.motivation),
          appliedAt: iso(e.createdAt),
        }];
      });
      return { ...base, applicants };
    });
  } catch (err) {
    console.error("[programs] listCompanyProgramsWithApplicants failed:", err);
    return [];
  }
}

/** Company accepts / waitlists / rejects / completes a program applicant (own programs only). */
export async function updateEnrollmentStatus(companyUserId: string, enrollmentId: string, status: EnrollmentStatus): Promise<{ ok: true } | Fail> {
  if (!ObjectId.isValid(companyUserId) || !ObjectId.isValid(enrollmentId)) return { ok: false, status: 400, error: "Invalid request." };
  try {
    const db = await getDb();
    const e = await db.collection("programEnrollments").findOne({ _id: new ObjectId(enrollmentId) });
    if (!e) return { ok: false, status: 404, error: "Applicant not found." };
    const program = await db.collection("industryPrograms").findOne({ _id: e.programId, companyId: new ObjectId(companyUserId) });
    if (!program) return { ok: false, status: 404, error: "Applicant not found." };
    const seats = Number(program.seats) || 0;
    const wasSeated = ["Accepted", "Completed"].includes(str(e.status));
    if (status === "Accepted" && !wasSeated && seats > 0) {
      const accepted = await db.collection("programEnrollments").countDocuments({ programId: program._id, status: { $in: ["Accepted", "Completed"] } });
      if (accepted >= seats) return { ok: false, status: 409, error: "All seats are filled — waitlist instead, or raise the seat count." };
    }
    await db.collection("programEnrollments").updateOne({ _id: e._id }, { $set: { status, updatedAt: new Date() } });
    if (status !== str(e.status)) {
      await createNotification({
        userId: e.studentId as ObjectId,
        kind: "info",
        title: `${str(program.title)}: ${status}`,
        body: `${str(program.company)} updated your program application to "${status}".`,
        link: "/student/programs",
      });
    }
    return { ok: true };
  } catch (err) {
    console.error("[programs] updateEnrollmentStatus failed:", err);
    return { ok: false, status: 500, error: "Could not update the applicant." };
  }
}

export async function setProgramStatus(companyUserId: string, programId: string, status: ListingStatus): Promise<boolean> {
  if (!ObjectId.isValid(companyUserId) || !ObjectId.isValid(programId)) return false;
  try {
    const db = await getDb();
    const res = await db
      .collection("industryPrograms")
      .updateOne({ _id: new ObjectId(programId), companyId: new ObjectId(companyUserId) }, { $set: { status, updatedAt: new Date() } });
    return res.matchedCount === 1;
  } catch (err) {
    console.error("[programs] setProgramStatus failed:", err);
    return false;
  }
}
