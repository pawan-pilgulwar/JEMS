import { ObjectId, type Db, type Document } from "mongodb";
import { getDatabase } from "@/lib/db/mongodb";
import type { InstitutionInsightsResponse } from "@/lib/agent/types";
import { institutionMemberFilter } from "@/lib/db/org-profiles";
import { institutionMatcher, skillsFromProfile, targetRoleFromProfile, type StudentSkill } from "@/lib/db/people";

/**
 * Institution (admin) analytics: aggregates across the institution's students
 * and faculty so placement cells can monitor skill development, internship
 * participation, placements, program uptake and industry collaboration.
 *
 * Membership: a student or faculty profile linked by `institutionId` (the
 * institution account's user id, set when they pick their institution), or —
 * for older profiles with no link — whose `institution` name matches.
 */

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : "");
const norm = (s: string) => s.trim().toLowerCase();
const STATUS_RANK = ["Rejected", "Applied", "In review", "Shortlisted", "Interview", "Offer", "Selected"];

async function getDb(): Promise<Db> {
  return getDatabase();
}

interface Scope {
  institution: string;
  profile: Document | null;
  students: Document[];
  studentIds: ObjectId[];
  faculty: Document[];
  facultyIds: ObjectId[];
}

/**
 * The institution's own students and faculty, for an institution account or
 * for a faculty member (scoped to the institution on their profile). Null
 * when the user is neither.
 */
async function loadScope(db: Db, userId: string): Promise<Scope | null> {
  if (!ObjectId.isValid(userId)) return null;
  const _id = new ObjectId(userId);
  const user = await db.collection("users").findOne({ _id, role: { $in: ["institution", "faculty"] } }, { projection: { name: 1, role: 1 } });
  if (!user) return null;
  let profile: Document | null;
  if (user.role === "faculty") {
    const fac = await db.collection("facultyProfiles").findOne({ userId: _id }, { projection: { institution: 1, institutionId: 1 } });
    profile = fac?.institutionId instanceof ObjectId
      ? await db.collection("institutionProfiles").findOne({ userId: fac.institutionId })
      : str(fac?.institution)
        ? await db.collection("institutionProfiles").findOne({ institutionName: institutionMatcher(str(fac?.institution)) })
        : null;
  } else {
    profile = await db.collection("institutionProfiles").findOne({ userId: _id });
  }
  // A faculty member with no (registered) institution sees no students at all.
  const institutionUserId = user.role === "institution" ? _id : profile?.userId instanceof ObjectId ? profile.userId : null;
  const institution = str(profile?.institutionName) || (user.role === "institution" ? str(user.name) : "");
  const filter = institutionUserId ? institutionMemberFilter(institutionUserId, institution) : null;
  const [students, faculty] = filter
    ? await Promise.all([db.collection("studentProfiles").find(filter).toArray(), db.collection("facultyProfiles").find(filter).toArray()])
    : [[], []];
  return {
    institution: institution || "No institution selected",
    profile,
    students,
    studentIds: students.map((p) => p.userId as ObjectId).filter(Boolean),
    faculty,
    facultyIds: faculty.map((f) => f.userId as ObjectId).filter(Boolean),
  };
}

/** True when the student belongs to the viewer's institution (viewer: institution account or faculty). */
export async function isStudentInViewerInstitution(viewerUserId: string, studentUserId: string): Promise<boolean> {
  if (!ObjectId.isValid(studentUserId)) return false;
  try {
    const scope = await loadScope(await getDb(), viewerUserId);
    return !!scope?.studentIds.some((id) => id.toString() === studentUserId);
  } catch (err) {
    console.error("[institution] isStudentInViewerInstitution failed:", err);
    return false;
  }
}

/** The institution's faculty user ids — for scoping collaboration interest. */
export async function getInstitutionFacultyIds(userId: string): Promise<ObjectId[]> {
  try {
    return (await loadScope(await getDb(), userId))?.facultyIds ?? [];
  } catch (err) {
    console.error("[institution] getInstitutionFacultyIds failed:", err);
    return [];
  }
}

export type PlacementStage = "Placed" | "In process" | "Applied" | "Not applied";

function placementStage(statuses: string[]): PlacementStage {
  if (statuses.some((s) => /offer|selected/i.test(s))) return "Placed";
  if (statuses.some((s) => /review|shortlist|interview/i.test(s))) return "In process";
  if (statuses.length > 0) return "Applied";
  return "Not applied";
}

// ── Students (directory, placements, program uptake) ────────────

export interface InstitutionApplication {
  id: string;
  studentId: string;
  studentName: string;
  company: string;
  role: string;
  type: string;
  status: string;
  appliedAt: string;
}

export interface InstitutionEnrollment {
  programId: string;
  title: string;
  company: string;
  type: string;
  status: string;
  appliedAt: string;
}

export interface InstitutionStudent {
  id: string;
  name: string;
  email: string;
  targetRole: string;
  readiness: number;
  skills: StudentSkill[];
  verifiedSkills: number;
  modulesPassed: number;
  bestStatus: string;
  stage: PlacementStage;
  lastActive: string;
  applications: InstitutionApplication[];
  programs: InstitutionEnrollment[];
}

export interface InstitutionProgramRow {
  id: string;
  title: string;
  company: string;
  type: string;
  skills: string[];
  startsAt: string;
  status: string;
  seats: number;
  /** Students of this institution who applied, with their status. */
  ourStudents: { id: string; name: string; status: string }[];
  /** How many of this institution's students lack at least one skill it teaches. */
  couldBenefit: number;
}

export interface InstitutionStudentsData {
  institution: string;
  students: InstitutionStudent[];
  programs: InstitutionProgramRow[];
}

export async function getInstitutionStudents(userId: string): Promise<InstitutionStudentsData | null> {
  try {
    const db = await getDb();
    const scope = await loadScope(db, userId);
    if (!scope) return null;
    const ids = scope.studentIds;

    const [users, progress, analytics, applications, enrollments, programs] = await Promise.all([
      db.collection("users").find({ _id: { $in: ids } }).project({ name: 1, email: 1, updatedAt: 1 }).toArray(),
      db.collection("roadmapProgress").find({ studentId: { $in: ids } }).toArray(),
      db.collection("studentAnalytics").find({ studentId: { $in: ids } }).toArray(),
      db.collection("jobApplications").find({ studentId: { $in: ids } }).sort({ createdAt: -1 }).toArray(),
      db.collection("programEnrollments").find({ studentId: { $in: ids } }).sort({ createdAt: -1 }).toArray(),
      db.collection("industryPrograms").find({}).sort({ startsAt: 1 }).toArray(),
    ]);
    const jobs = await db
      .collection("jobPostings")
      .find({ _id: { $in: [...new Set(applications.map((a) => String(a.jobId)))].filter(ObjectId.isValid).map((s) => new ObjectId(s)) } })
      .project({ role: 1, company: 1, type: 1 })
      .toArray();

    const userById = new Map(users.map((u) => [u._id.toString(), u]));
    const analyticsById = new Map(analytics.map((a) => [String(a.studentId), a]));
    const jobById = new Map(jobs.map((j) => [j._id.toString(), j]));
    const programById = new Map(programs.map((p) => [p._id.toString(), p]));
    const passedById = new Map<string, number>();
    const activeById = new Map<string, string>();
    for (const p of progress) {
      const k = String(p.studentId);
      passedById.set(k, (passedById.get(k) ?? 0) + (Array.isArray(p.passedModules) ? p.passedModules.length : 0));
      const at = iso(p.updatedAt);
      if (at > (activeById.get(k) ?? "")) activeById.set(k, at);
    }
    const nameOf = (k: string, p?: Document) => str(p?.displayName) || str(userById.get(k)?.name) || str(userById.get(k)?.email) || "Student";
    const profileById = new Map(scope.students.map((p) => [String(p.userId), p]));

    const appsById = new Map<string, InstitutionApplication[]>();
    for (const a of applications) {
      const k = String(a.studentId);
      const j = jobById.get(String(a.jobId));
      appsById.set(k, [
        ...(appsById.get(k) ?? []),
        {
          id: a._id.toString(),
          studentId: k,
          studentName: nameOf(k, profileById.get(k)),
          company: str(j?.company) || str(a.company) || "—",
          role: str(j?.role) || str(a.role) || "—",
          type: str(j?.type) || "—",
          status: str(a.status) || "Applied",
          appliedAt: iso(a.createdAt),
        },
      ]);
    }
    const enrollById = new Map<string, InstitutionEnrollment[]>();
    for (const e of enrollments) {
      const k = String(e.studentId);
      const p = programById.get(String(e.programId));
      if (!p) continue;
      enrollById.set(k, [
        ...(enrollById.get(k) ?? []),
        { programId: p._id.toString(), title: str(p.title), company: str(p.company), type: str(p.type), status: str(e.status) || "Applied", appliedAt: iso(e.createdAt) },
      ]);
    }

    const students: InstitutionStudent[] = scope.students
      .filter((p) => userById.has(String(p.userId)))
      .map((p) => {
        const k = String(p.userId);
        const skills = skillsFromProfile(p);
        const apps = appsById.get(k) ?? [];
        const statuses = apps.map((a) => a.status);
        const a = analyticsById.get(k);
        return {
          id: k,
          name: nameOf(k, p),
          email: str(userById.get(k)?.email),
          targetRole: targetRoleFromProfile(p),
          readiness: Number(a?.readiness) || 0,
          skills,
          verifiedSkills: skills.filter((s) => s.verified).length,
          modulesPassed: passedById.get(k) ?? 0,
          bestStatus: [...statuses].sort((x, y) => STATUS_RANK.indexOf(y) - STATUS_RANK.indexOf(x))[0] ?? "—",
          stage: placementStage(statuses),
          lastActive: [activeById.get(k) ?? "", iso(a?.updatedAt), iso(p.updatedAt)].sort().pop() ?? "",
          applications: apps,
          programs: enrollById.get(k) ?? [],
        };
      })
      .sort((x, y) => y.readiness - x.readiness);

    const skillSets = students.map((s) => new Set(s.skills.map((x) => norm(x.name))));
    const programRows: InstitutionProgramRow[] = programs.map((p) => {
      const id = p._id.toString();
      const taught = (Array.isArray(p.skills) ? p.skills : []).map((s: unknown) => str(s)).filter(Boolean);
      return {
        id,
        title: str(p.title),
        company: str(p.company),
        type: str(p.type),
        skills: taught,
        startsAt: iso(p.startsAt),
        status: str(p.status) === "closed" ? "closed" : "open",
        seats: Number(p.seats) || 0,
        ourStudents: students.flatMap((s) => s.programs.filter((e) => e.programId === id).map((e) => ({ id: s.id, name: s.name, status: e.status }))),
        couldBenefit: skillSets.filter((set) => taught.some((t: string) => !set.has(norm(t)))).length,
      };
    });

    return { institution: scope.institution, students, programs: programRows };
  } catch (err) {
    console.error("[institution] getInstitutionStudents failed:", err);
    return null;
  }
}

// ── Faculty ─────────────────────────────────────────────────────

export interface InstitutionFacultyRow {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  interests: string[];
  collaborations: { id: string; title: string; company: string; type: string; startsAt: string; status: string; expressedAt: string }[];
  curriculumReviews: number;
}

export async function getInstitutionFaculty(userId: string): Promise<{ institution: string; departments: string[]; faculty: InstitutionFacultyRow[] } | null> {
  try {
    const db = await getDb();
    const scope = await loadScope(db, userId);
    if (!scope) return null;
    const ids = scope.facultyIds;
    const [users, interests, reviews] = await Promise.all([
      db.collection("users").find({ _id: { $in: ids } }).project({ name: 1, email: 1 }).toArray(),
      db.collection("collaborationInterests").find({ userId: { $in: ids } }).sort({ createdAt: -1 }).toArray(),
      db.collection("facultyCurriculumReviews").aggregate([{ $match: { facultyUserId: { $in: ids } } }, { $group: { _id: "$facultyUserId", n: { $sum: 1 } } }]).toArray(),
    ]);
    const collabs = await db.collection("collaborations").find({ _id: { $in: interests.map((i) => i.collaborationId as ObjectId) } }).toArray();
    const userById = new Map(users.map((u) => [u._id.toString(), u]));
    const collabById = new Map(collabs.map((c) => [c._id.toString(), c]));
    const reviewsBy = new Map(reviews.map((r) => [String(r._id), Number(r.n) || 0]));

    const faculty = scope.faculty
      .filter((f) => userById.has(String(f.userId)))
      .map((f): InstitutionFacultyRow => {
        const k = String(f.userId);
        const u = userById.get(k)!;
        return {
          id: k,
          name: str(u.name) || str(u.email) || "Faculty member",
          email: str(u.email),
          department: str(f.department) || "—",
          designation: str(f.designation),
          interests: Array.isArray(f.interests) ? f.interests.map(String) : [],
          collaborations: interests
            .filter((i) => String(i.userId) === k)
            .flatMap((i) => {
              const c = collabById.get(String(i.collaborationId));
              return c
                ? [{ id: c._id.toString(), title: str(c.title), company: str(c.company), type: str(c.type), startsAt: iso(c.startsAt), status: str(i.status) || "Interested", expressedAt: iso(i.createdAt) }]
                : [];
            }),
          curriculumReviews: reviewsBy.get(k) ?? 0,
        };
      })
      .sort((a, b) => b.collaborations.length - a.collaborations.length || a.name.localeCompare(b.name));

    const departments = [...new Set([...(Array.isArray(scope.profile?.departments) ? scope.profile!.departments.map(String) : []), ...faculty.map((f) => f.department).filter((d) => d !== "—")])];
    return { institution: scope.institution, departments, faculty };
  } catch (err) {
    console.error("[institution] getInstitutionFaculty failed:", err);
    return null;
  }
}

// ── Dashboard ───────────────────────────────────────────────────

export interface InstitutionDashboard {
  institution: string;
  kpis: {
    students: number;
    withGoals: number;
    avgReadiness: number;
    modulesPassed: number;
    verifiedSkills: number;
    applications: number;
    internshipApplications: number;
    offers: number;
    placementRate: number;
    faculty: number;
    facultyEngaged: number;
    programApplications: number;
  };
  readinessBuckets: { label: string; count: number }[];
  applicationsByStatus: { status: string; count: number }[];
  placementStages: { stage: PlacementStage; count: number }[];
  topRecruiters: { company: string; applications: number; offers: number }[];
  targetRoles: { role: string; count: number }[];
  /** Industry demand vs cohort coverage — the skill-gap statistics. */
  skillGaps: { skill: string; demand: number; coverage: number; gap: number }[];
  /** Skills most requested across current openings. */
  demandTrends: { skill: string; openings: number }[];
  collaborations: { title: string; company: string; type: string; startsAt: string; interested: number; ourFaculty: number }[];
  students: {
    id: string;
    name: string;
    targetRole: string;
    readiness: number;
    verifiedSkills: number;
    modulesPassed: number;
    applications: number;
    bestStatus: string;
  }[];
  latestInsights?: InstitutionInsightsResponse | null;
}

export async function getInstitutionDashboard(userId: string): Promise<InstitutionDashboard | null> {
  try {
    const db = await getDb();
    const [data, scope] = await Promise.all([getInstitutionStudents(userId), loadScope(db, userId)]);
    if (!data || !scope) return null;
    const { institution } = data;
    const all = data.students;

    const [jobs, collaborations, interests] = await Promise.all([
      db.collection("jobPostings").find({ status: { $ne: "closed" } }).toArray(),
      db.collection("collaborations").find({ status: { $ne: "closed" } }).sort({ startsAt: 1 }).limit(6).toArray(),
      db.collection("collaborationInterests").find({}).project({ collaborationId: 1, userId: 1 }).toArray(),
    ]);

    const applications = all.flatMap((s) => s.applications);
    const n = all.length;
    const withGoals = scope.students.filter((p) => p.goals && typeof p.goals === "object").length;
    const offers = applications.filter((a) => /offer|selected/i.test(a.status)).length;
    const placedStudents = all.filter((s) => s.stage === "Placed").length;

    const readinessBuckets = [
      { label: "0–39%", count: all.filter((s) => s.readiness < 40).length },
      { label: "40–59%", count: all.filter((s) => s.readiness >= 40 && s.readiness < 60).length },
      { label: "60–79%", count: all.filter((s) => s.readiness >= 60 && s.readiness < 80).length },
      { label: "80–100%", count: all.filter((s) => s.readiness >= 80).length },
    ];

    const statusCounts = new Map<string, number>();
    for (const a of applications) statusCounts.set(a.status, (statusCounts.get(a.status) ?? 0) + 1);
    const applicationsByStatus = STATUS_RANK.filter((s) => statusCounts.has(s)).map((status) => ({ status, count: statusCounts.get(status)! }));
    const placementStages = (["Placed", "In process", "Applied", "Not applied"] as PlacementStage[]).map((stage) => ({ stage, count: all.filter((s) => s.stage === stage).length }));

    const recruiters = new Map<string, { company: string; applications: number; offers: number }>();
    for (const a of applications) {
      const r = recruiters.get(a.company) ?? { company: a.company, applications: 0, offers: 0 };
      r.applications += 1;
      if (/offer|selected/i.test(a.status)) r.offers += 1;
      recruiters.set(a.company, r);
    }
    const topRecruiters = Array.from(recruiters.values()).sort((a, b) => b.offers - a.offers || b.applications - a.applications).slice(0, 6);

    const roleCounts = new Map<string, number>();
    for (const s of all) roleCounts.set(s.targetRole, (roleCounts.get(s.targetRole) ?? 0) + 1);
    const targetRoles = Array.from(roleCounts, ([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count).slice(0, 8);

    // ── Skill demand vs cohort coverage ──
    const demand = new Map<string, { skill: string; openings: number }>();
    for (const j of jobs) {
      for (const s of (Array.isArray(j.requiredSkills) ? j.requiredSkills : []) as string[]) {
        const k = norm(s);
        const cur = demand.get(k) ?? { skill: s, openings: 0 };
        cur.openings += 1;
        demand.set(k, cur);
      }
    }
    const demandTrends = Array.from(demand.values()).sort((a, b) => b.openings - a.openings).slice(0, 10);
    const skillGaps = demandTrends.map((d) => {
      // Coverage counts *verified* skills only — claims don't close a gap.
      const have = all.filter((s) => s.skills.some((x) => x.verified && norm(x.name) === norm(d.skill))).length;
      const coverage = n ? Math.round((have / n) * 100) : 0;
      return { skill: d.skill, demand: d.openings, coverage, gap: 100 - coverage };
    }).sort((a, b) => b.gap * b.demand - a.gap * a.demand);

    const facultySet = new Set(scope.facultyIds.map(String));
    const interestCount = new Map<string, { all: number; ours: number }>();
    const engaged = new Set<string>();
    for (const i of interests) {
      const k = String(i.collaborationId);
      const c = interestCount.get(k) ?? { all: 0, ours: 0 };
      c.all += 1;
      if (facultySet.has(String(i.userId))) {
        c.ours += 1;
        engaged.add(String(i.userId));
      }
      interestCount.set(k, c);
    }

    return {
      institution,
      kpis: {
        students: n,
        withGoals,
        avgReadiness: n ? Math.round(all.reduce((s, x) => s + x.readiness, 0) / n) : 0,
        modulesPassed: all.reduce((s, x) => s + x.modulesPassed, 0),
        verifiedSkills: all.reduce((s, x) => s + x.verifiedSkills, 0),
        applications: applications.length,
        internshipApplications: applications.filter((a) => /intern|apprentice/i.test(a.type) || /intern|apprentice/i.test(a.role)).length,
        offers,
        placementRate: n ? Math.round((placedStudents / n) * 100) : 0,
        faculty: scope.facultyIds.length,
        facultyEngaged: engaged.size,
        programApplications: all.reduce((s, x) => s + x.programs.length, 0),
      },
      readinessBuckets,
      applicationsByStatus,
      placementStages,
      topRecruiters,
      targetRoles,
      skillGaps,
      demandTrends,
      collaborations: collaborations.map((c) => ({
        title: str(c.title),
        company: str(c.company),
        type: str(c.type),
        startsAt: iso(c.startsAt),
        interested: interestCount.get(c._id.toString())?.all ?? 0,
        ourFaculty: interestCount.get(c._id.toString())?.ours ?? 0,
      })),
      students: all.map((s) => ({
        id: s.id, name: s.name, targetRole: s.targetRole, readiness: s.readiness, verifiedSkills: s.verifiedSkills,
        modulesPassed: s.modulesPassed, applications: s.applications.length, bestStatus: s.bestStatus,
      })),
      latestInsights: await getStoredInstitutionInsights(institution),
    };
  } catch (err) {
    console.error("[institution] getInstitutionDashboard failed:", err);
    return null;
  }
}


export async function getStoredInstitutionInsights(institution: string): Promise<InstitutionInsightsResponse | null> {
  try {
    const db = await getDb();
    const doc = await db.collection("institutionAnalyses").findOne(
      { institution: str(institution) },
      { sort: { createdAt: -1 } }
    );
    if (!doc || !doc.insights) return null;
    return doc.insights as InstitutionInsightsResponse;
  } catch (err) {
    console.error("[institution] getStoredInstitutionInsights failed:", err);
    return null;
  }
}

export async function saveInstitutionInsights(institution: string, insights: InstitutionInsightsResponse): Promise<boolean> {
  try {
    const db = await getDb();
    const now = new Date();
    await db.collection("institutionAnalyses").insertOne({
      institution: str(institution),
      insights,
      createdAt: now,
    });
    return true;
  } catch (err) {
    console.error("[institution] saveInstitutionInsights failed:", err);
    return false;
  }
}
