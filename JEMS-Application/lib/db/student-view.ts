import { ObjectId, type Db } from "mongodb";
import { getDatabase } from "@/lib/db/mongodb";
import { isStudentInViewerInstitution } from "@/lib/db/institution";
import { getPortfolio, type Portfolio } from "@/lib/db/portfolio";
import type { UserRole } from "@/lib/db/users";

/**
 * What another user may see about a student:
 *
 *  - a company: the public portfolio plus *its own* dealings with the
 *    student (applications to its openings with the resume sent, and its
 *    program applications);
 *  - the student's institution and its faculty: the portfolio plus the full
 *    progress record (roadmap, learning, tests, every application/program);
 *  - anyone else signed in: the public portfolio only.
 */

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : "");

async function getDb(): Promise<Db> {
  return getDatabase();
}

export type ViewerRelation = "company" | "institution" | "public";

export interface StudentViewApplication {
  id: string;
  role: string;
  company: string;
  type: string;
  status: string;
  appliedAt: string;
  /** Set for the company that received it: where to open the resume. */
  resumeHref: string | null;
}

export interface StudentView {
  relation: ViewerRelation;
  portfolio: Portfolio;
  email: string | null;
  applications: StudentViewApplication[];
  programs: { title: string; company: string; status: string; appliedAt: string }[];
  /** Institution / faculty only. */
  progress: {
    lastActive: string;
    careerPath: string;
    modulesPassed: number;
    mockInterviews: number;
    streak: number;
    tests: { skill: string; score: number; passed: boolean; takenAt: string }[];
    learning: { title: string; progress: number }[];
  } | null;
}

export async function getStudentView(viewer: { id: string; role: UserRole }, studentId: string): Promise<StudentView | null> {
  if (!ObjectId.isValid(studentId)) return null;
  const portfolio = await getPortfolio(studentId);
  if (!portfolio) return null;
  try {
    const db = await getDb();
    const sid = new ObjectId(studentId);

    if (viewer.role === "company" && ObjectId.isValid(viewer.id)) {
      const companyId = new ObjectId(viewer.id);
      const [jobs, programs] = await Promise.all([
        db.collection("jobPostings").find({ companyId }).project({ role: 1, type: 1, company: 1 }).toArray(),
        db.collection("industryPrograms").find({ companyId }).project({ title: 1, company: 1 }).toArray(),
      ]);
      const jobBy = new Map(jobs.map((j) => [j._id.toString(), j]));
      const programBy = new Map(programs.map((p) => [p._id.toString(), p]));
      const [apps, enrollments, user] = await Promise.all([
        db.collection("jobApplications").find({ studentId: sid, jobId: { $in: jobs.map((j) => j._id) } }).sort({ createdAt: -1 }).toArray(),
        db.collection("programEnrollments").find({ studentId: sid, programId: { $in: programs.map((p) => p._id) } }).sort({ createdAt: -1 }).toArray(),
        db.collection("users").findOne({ _id: sid }, { projection: { email: 1 } }),
      ]);
      return {
        relation: "company",
        portfolio,
        // A company sees contact details only once the student has applied to it.
        email: apps.length || enrollments.length ? str(user?.email) : null,
        applications: apps.map((a) => {
          const j = jobBy.get(String(a.jobId));
          const r = (a.resume ?? {}) as Record<string, unknown>;
          return {
            id: a._id.toString(),
            role: str(j?.role) || str(a.role),
            company: str(j?.company) || str(a.company),
            type: str(j?.type),
            status: str(a.status) || "Applied",
            appliedAt: iso(a.createdAt),
            resumeHref: r.type === "built" || r.type === "manual" ? `/company/applications/${a._id.toString()}/resume` : null,
          };
        }),
        programs: enrollments.map((e) => ({ title: str(programBy.get(String(e.programId))?.title), company: str(programBy.get(String(e.programId))?.company), status: str(e.status) || "Applied", appliedAt: iso(e.createdAt) })),
        progress: null,
      };
    }

    if ((viewer.role === "institution" || viewer.role === "faculty") && (await isStudentInViewerInstitution(viewer.id, studentId))) {
      const [user, apps, enrollments, roadmap, analytics, tests, paths] = await Promise.all([
        db.collection("users").findOne({ _id: sid }, { projection: { email: 1, updatedAt: 1 } }),
        db.collection("jobApplications").find({ studentId: sid }).sort({ createdAt: -1 }).toArray(),
        db.collection("programEnrollments").find({ studentId: sid }).sort({ createdAt: -1 }).toArray(),
        db.collection("roadmapProgress").find({ studentId: sid }).toArray(),
        db.collection("studentAnalytics").findOne({ studentId: sid }),
        db.collection("skillAssessments").find({ studentId: sid }).sort({ takenAt: -1 }).limit(20).toArray(),
        db.collection("learningPaths").find({ studentId: sid }).sort({ progress: -1 }).limit(12).toArray(),
      ]);
      const [jobs, programs] = await Promise.all([
        db.collection("jobPostings").find({ _id: { $in: apps.map((a) => a.jobId as ObjectId) } }).project({ role: 1, company: 1, type: 1 }).toArray(),
        db.collection("industryPrograms").find({ _id: { $in: enrollments.map((e) => e.programId as ObjectId) } }).project({ title: 1, company: 1 }).toArray(),
      ]);
      const jobBy = new Map(jobs.map((j) => [j._id.toString(), j]));
      const programBy = new Map(programs.map((p) => [p._id.toString(), p]));
      const lastActive = [iso(user?.updatedAt), iso(analytics?.updatedAt), ...roadmap.map((r) => iso(r.updatedAt)), ...paths.map((p) => iso(p.updatedAt))].sort().pop() ?? "";
      return {
        relation: "institution",
        portfolio,
        email: str(user?.email),
        applications: apps.map((a) => {
          const j = jobBy.get(String(a.jobId));
          return { id: a._id.toString(), role: str(j?.role) || str(a.role), company: str(j?.company) || str(a.company), type: str(j?.type), status: str(a.status) || "Applied", appliedAt: iso(a.createdAt), resumeHref: null };
        }),
        programs: enrollments.map((e) => ({ title: str(programBy.get(String(e.programId))?.title), company: str(programBy.get(String(e.programId))?.company), status: str(e.status) || "Applied", appliedAt: iso(e.createdAt) })),
        progress: {
          lastActive,
          careerPath: str(roadmap[0]?.careerPath),
          modulesPassed: roadmap.reduce((n, r) => n + (Array.isArray(r.passedModules) ? r.passedModules.length : 0), 0),
          mockInterviews: Number(analytics?.mockInterviews) || 0,
          streak: Number(analytics?.streak) || 0,
          tests: tests.map((t) => ({ skill: str(t.skill), score: Number(t.score) || 0, passed: Boolean(t.passed), takenAt: iso(t.takenAt) })),
          learning: paths.map((p) => ({ title: str(p.title), progress: Number(p.progress) || 0 })),
        },
      };
    }

    return { relation: "public", portfolio, email: null, applications: [], programs: [], progress: null };
  } catch (err) {
    console.error("[student-view] getStudentView failed:", err);
    return { relation: "public", portfolio, email: null, applications: [], programs: [], progress: null };
  }
}
