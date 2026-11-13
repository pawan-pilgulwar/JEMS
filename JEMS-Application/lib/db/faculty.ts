import { ObjectId, type Db } from "mongodb";
import { getDatabase } from "@/lib/db/mongodb";
import type { CurriculumResponse } from "@/lib/agent/types";
import { institutionMemberFilter } from "@/lib/db/org-profiles";
import { institutionMatcher, skillsFromProfile, targetRoleFromProfile } from "@/lib/db/people";

export interface FacultyContext {
  userId: string;
  name: string;
  department: string;
  institution: string;
  designation?: string;
}

export interface FacultyDashboardData {
  faculty: FacultyContext;
  kpis: {
    departmentStudents: number;
    activeLearners: number;
    avgReadiness: number;
    verifiedSkills: number;
    collaborationsCount: number;
    myInterestsCount: number;
  };
  departmentSkills: { skill: string; verifiedCount: number; coverage: number }[];
  marketDemand: { skill: string; openings: number }[];
  recentStudentActivity: {
    studentId: string;
    name: string;
    targetRole: string;
    readiness: number;
    verifiedSkills: number;
  }[];
  latestReview: CurriculumResponse | null;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

async function getDb(): Promise<Db> {
  return getDatabase();
}

export async function getFacultyContext(userId: string): Promise<FacultyContext | null> {
  if (!ObjectId.isValid(userId)) return null;
  try {
    const db = await getDb();
    const _id = new ObjectId(userId);
    const [user, profile] = await Promise.all([
      db.collection("users").findOne({ _id, role: "faculty" }),
      db.collection("facultyProfiles").findOne({ userId: _id }),
    ]);
    if (!user) return null;
    return {
      userId,
      name: str(user.name) || "Faculty Member",
      // No invented defaults: an incomplete profile shows as such rather than as another institution.
      department: str(profile?.department) || "Department not set",
      institution: str(profile?.institution),
      designation: str(profile?.designation),
    };
  } catch (err) {
    console.error("[faculty] getFacultyContext failed:", err);
    return null;
  }
}

export async function getFacultyDashboard(userId: string): Promise<FacultyDashboardData | null> {
  const faculty = await getFacultyContext(userId);
  if (!faculty) return null;

  try {
    const db = await getDb();
    const uid = new ObjectId(userId);

    // Students of the faculty member's own institution — same membership rule as the institution portal.
    const fac = await db.collection("facultyProfiles").findOne({ userId: uid }, { projection: { institutionId: 1 } });
    const filter = fac?.institutionId instanceof ObjectId
      ? institutionMemberFilter(fac.institutionId, faculty.institution)
      : faculty.institution
        ? { institution: institutionMatcher(faculty.institution) }
        : null;
    const studentProfiles = filter ? await db.collection("studentProfiles").find(filter).toArray() : [];
    const studentUserIds = studentProfiles.map((p) => p.userId as ObjectId).filter(Boolean);

    const [users, analytics, progress, jobs, collaborations, interests, reviewDoc] = await Promise.all([
      db.collection("users").find({ _id: { $in: studentUserIds } }).project({ name: 1, email: 1 }).toArray(),
      db.collection("studentAnalytics").find({ studentId: { $in: studentUserIds } }).toArray(),
      db.collection("roadmapProgress").find({ studentId: { $in: studentUserIds } }).toArray(),
      db.collection("jobPostings").find({ status: { $ne: "closed" } }).toArray(),
      db.collection("collaborations").countDocuments({}),
      db.collection("collaborationInterests").find({ userId: uid }).toArray(),
      db.collection("facultyCurriculumReviews").findOne({ facultyUserId: uid }, { sort: { createdAt: -1 } }),
    ]);

    const userById = new Map(users.map((u) => [u._id.toString(), u]));
    const readinessById = new Map(analytics.map((a) => [String(a.studentId), Number(a.readiness) || 0]));

    // Aggregate student department skills
    const skillCounts = new Map<string, number>();
    let totalVerified = 0;
    const n = studentProfiles.length;

    // Aggregate over the whole cohort; only the activity list is capped.
    const rows = studentProfiles.map((p) => {
      const sid = String(p.userId);
      const u = userById.get(sid);
      const verified = skillsFromProfile(p).filter((s) => s.verified);
      totalVerified += verified.length;
      for (const s of verified) skillCounts.set(s.name, (skillCounts.get(s.name) ?? 0) + 1);
      return {
        studentId: sid,
        name: str(p.displayName) || str(u?.name) || str(u?.email) || "Student",
        targetRole: targetRoleFromProfile(p),
        readiness: readinessById.get(sid) ?? 0,
        verifiedSkills: verified.length,
      };
    });
    const recentStudentActivity = rows.sort((a, b) => b.readiness - a.readiness).slice(0, 10);

    const departmentSkills = Array.from(skillCounts.entries())
      .map(([skill, count]) => ({
        skill,
        verifiedCount: count,
        coverage: n ? Math.round((count / n) * 100) : 0,
      }))
      .sort((a, b) => b.verifiedCount - a.verifiedCount)
      .slice(0, 10);

    // Live market demand
    const demand = new Map<string, number>();
    for (const j of jobs) {
      for (const s of (Array.isArray(j.requiredSkills) ? j.requiredSkills : []) as string[]) {
        demand.set(s, (demand.get(s) ?? 0) + 1);
      }
    }
    const marketDemand = Array.from(demand.entries())
      .map(([skill, openings]) => ({ skill, openings }))
      .sort((a, b) => b.openings - a.openings)
      .slice(0, 10);

    const avgReadiness = n
      ? Math.round(
          studentProfiles.reduce((acc, p) => acc + (readinessById.get(String(p.userId)) ?? 0), 0) / n
        )
      : 0;

    return {
      faculty,
      kpis: {
        departmentStudents: n,
        activeLearners: progress.length,
        avgReadiness,
        verifiedSkills: totalVerified,
        collaborationsCount: collaborations,
        myInterestsCount: interests.length,
      },
      departmentSkills,
      marketDemand,
      recentStudentActivity,
      latestReview: reviewDoc ? (reviewDoc.review as CurriculumResponse) : null,
    };
  } catch (err) {
    console.error("[faculty] getFacultyDashboard failed:", err);
    return null;
  }
}

export async function saveFacultyCurriculumReview(
  userId: string,
  subject: string,
  review: CurriculumResponse
): Promise<boolean> {
  if (!ObjectId.isValid(userId)) return false;
  try {
    const db = await getDb();
    const now = new Date();
    await db.collection("facultyCurriculumReviews").insertOne({
      facultyUserId: new ObjectId(userId),
      subject: str(subject),
      review,
      createdAt: now,
    });
    return true;
  } catch (err) {
    console.error("[faculty] saveFacultyCurriculumReview failed:", err);
    return false;
  }
}

