import { ObjectId, type Db } from "mongodb";
import { getDatabase } from "@/lib/db/mongodb";
import { bankFor } from "@/lib/assessment/bank";
import {
  COOLDOWN_HOURS,
  type KeyedQuestion,
  type PublicQuestion,
  type QuestionnaireAnswers,
  type SoftSkillKey,
  TEST_MINUTES,
  buildSkillTest,
  gradeSkillTest,
  levelFromRating,
  levelFromScore,
  scoreSoftSkills,
  toPublic,
} from "@/lib/assessment/engine";
import { allModules, careerPathForTargetRole, getRoadmap, isCareerPath } from "@/lib/roadmap/data";

/**
 * Skill assessment persistence — the Assessment Agent's memory.
 *
 *  studentProfiles.skills[]   { name, level, verified, source: claimed|skill-test|roadmap, score?, verifiedAt? }
 *  studentProfiles.softSkills { communication, teamwork, problemSolving, adaptability, leadership }  0–100
 *  studentProfiles.assessment { questionnaireAt }
 *  skillTestSessions          in-progress tests; the answer key lives here, never on the client
 *  skillAssessments           one result doc per (student, skill): score, passed, lockedUntil
 */

export type SkillSource = "claimed" | "skill-test" | "roadmap";

export interface ProfileSkill {
  name: string;
  level: number;
  verified: boolean;
  source: SkillSource;
  score?: number;
  verifiedAt?: string;
}

export interface CatalogueSkill {
  name: string;
  /** Number of current openings that require it. */
  demand: number;
  testable: boolean;
  /** Roadmap module (on the student's path) whose quiz verifies it, if any. */
  moduleId: number | null;
  moduleTitle: string | null;
}

export interface SkillAssessmentRecord {
  skill: string;
  score: number;
  passed: boolean;
  takenAt: string;
  lockedUntil: string | null;
}

/** Baseline used only when live openings and the roadmap name fewer than 12 skills. */
const CORE_SKILLS = [
  "JavaScript", "TypeScript", "React", "Node.js", "Python", "SQL", "Git", "REST APIs",
  "HTML5", "CSS3", "Next.js", "Docker", "MongoDB", "Data Structures", "System Design", "AWS",
];

export interface AssessmentState {
  catalogue: CatalogueSkill[];
  skills: ProfileSkill[];
  softSkills: Record<SoftSkillKey, number> | null;
  questionnaireAt: string | null;
  /** The last questionnaire's soft-skill / scenario answers, so editing starts from them. */
  answers: { likert: Record<string, number>; situational: Record<string, number> } | null;
  results: SkillAssessmentRecord[];
  targetRole: string;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const norm = (s: string) => s.trim().toLowerCase();
const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : null);

async function getDb(): Promise<Db> {
  return getDatabase();
}

export function parseProfileSkills(raw: unknown): ProfileSkill[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s: unknown) => {
      const o = (s ?? {}) as Record<string, unknown>;
      const verified = Boolean(o.verified);
      const source = (["claimed", "skill-test", "roadmap"] as const).includes(o.source as SkillSource)
        ? (o.source as SkillSource)
        : verified ? "roadmap" : "claimed";
      return {
        name: str(o.name),
        level: Number(o.level) || 0,
        verified,
        source,
        score: typeof o.score === "number" ? o.score : undefined,
        verifiedAt: iso(o.verifiedAt) ?? undefined,
      };
    })
    .filter((s) => s.name);
}

function numberMap(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object") return {};
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, n]) => Number.isFinite(Number(n))).map(([k, n]) => [k, Number(n)]));
}

function answersFrom(assessment: unknown): AssessmentState["answers"] {
  const a = (assessment ?? {}) as Record<string, unknown>;
  const likert = numberMap(a.likert);
  const situational = numberMap(a.situational);
  return Object.keys(likert).length || Object.keys(situational).length ? { likert, situational } : null;
}

export async function getAssessmentState(userId: string): Promise<AssessmentState | null> {
  if (!ObjectId.isValid(userId)) return null;
  try {
    const db = await getDb();
    const _id = new ObjectId(userId);
    const [profile, jobs, results] = await Promise.all([
      db.collection("studentProfiles").findOne({ userId: _id }),
      db.collection("jobPostings").find({ status: { $ne: "closed" } }).project({ requiredSkills: 1, niceToHave: 1 }).toArray(),
      db.collection("skillAssessments").find({ studentId: _id }).toArray(),
    ]);
    const p = (profile ?? {}) as Record<string, unknown>;
    const goals = (p.goals ?? {}) as Record<string, unknown>;
    const targetRole = str(goals.careerTitle) || str(p.targetRole) || "Full Stack Developer";
    const careerPath = isCareerPath(str(goals.careerPath)) ? str(goals.careerPath) : (careerPathForTargetRole(targetRole) ?? "fullstack");
    const modules = allModules(getRoadmap(careerPath));

    // Industry-shared skill catalogue: what live openings ask for, plus the
    // student's roadmap skills. `rank` orders the list; `openings` is the real
    // count of open postings that require the skill (what the UI shows).
    const demand = new Map<string, { name: string; rank: number; openings: number }>();
    const bump = (name: string, rank: number, opening = false) => {
      const k = norm(name);
      if (!k) return;
      const cur = demand.get(k) ?? { name, rank: 0, openings: 0 };
      cur.rank += rank;
      if (opening) cur.openings += 1;
      demand.set(k, cur);
    };
    for (const j of jobs) {
      (Array.isArray(j.requiredSkills) ? j.requiredSkills : []).forEach((s: unknown) => bump(str(s), 1, true));
      (Array.isArray(j.niceToHave) ? j.niceToHave : []).forEach((s: unknown) => bump(str(s), 0.5));
    }
    modules.forEach((m) => m.skills.forEach((s) => bump(s, 0.25)));
    // Only when there's little live data (new platform, few postings) fall
    // back to a baseline list so the questionnaire is never empty.
    if (demand.size < 12) CORE_SKILLS.forEach((s) => bump(s, 0.1));

    const catalogue: CatalogueSkill[] = Array.from(demand.values())
      .sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name))
      .map((d) => {
        const mod = modules.find((m) => m.skills.some((s) => norm(s) === norm(d.name)));
        return { name: d.name, demand: d.openings, testable: !!bankFor(d.name), moduleId: mod?.id ?? null, moduleTitle: mod?.title ?? null };
      });

    const soft = p.softSkills as Record<string, unknown> | undefined;
    const softSkills = soft
      ? (Object.fromEntries((["communication", "teamwork", "problemSolving", "adaptability", "leadership"] as const).map((k) => [k, Number(soft[k]) || 0])) as Record<SoftSkillKey, number>)
      : null;

    return {
      catalogue,
      skills: parseProfileSkills(p.skills),
      softSkills,
      questionnaireAt: iso((p.assessment as Record<string, unknown> | undefined)?.questionnaireAt),
      answers: answersFrom(p.assessment),
      results: results.map((r) => ({
        skill: str(r.skill),
        score: Number(r.score) || 0,
        passed: Boolean(r.passed),
        takenAt: iso(r.takenAt) ?? "",
        lockedUntil: iso(r.lockedUntil),
      })),
      targetRole,
    };
  } catch (err) {
    console.error("[assessment] getAssessmentState failed:", err);
    return null;
  }
}

/**
 * Saves the questionnaire: rated skills become *claimed* (unverified) unless
 * the student already verified them — verification is never downgraded by a
 * self-rating. Skills no longer claimed are dropped unless verified.
 */
export async function saveQuestionnaire(userId: string, answers: QuestionnaireAnswers): Promise<boolean> {
  if (!ObjectId.isValid(userId)) return false;
  try {
    const db = await getDb();
    const _id = new ObjectId(userId);
    const profile = ((await db.collection("studentProfiles").findOne({ userId: _id })) ?? {}) as Record<string, unknown>;
    const existing = parseProfileSkills(profile.skills);
    const verified = existing.filter((s) => s.verified);
    const verifiedKeys = new Set(verified.map((s) => norm(s.name)));

    const claimed: ProfileSkill[] = Object.entries(answers.skills)
      .filter(([name, rating]) => name.trim() && Number(rating) >= 1 && !verifiedKeys.has(norm(name)))
      .map(([name, rating]) => ({ name: name.trim().slice(0, 40), level: levelFromRating(Number(rating)), verified: false, source: "claimed" as const }));

    const now = new Date();
    await db.collection("studentProfiles").updateOne(
      { userId: _id },
      {
        $set: {
          skills: [...verified, ...claimed].map((s) => ({ ...s, verifiedAt: s.verifiedAt ? new Date(s.verifiedAt) : undefined })),
          softSkills: scoreSoftSkills(answers),
          assessment: { questionnaireAt: now, likert: answers.likert, situational: answers.situational },
          updatedAt: now,
        },
        $setOnInsert: { userId: _id, createdAt: now },
      },
      { upsert: true },
    );
    return true;
  } catch (err) {
    console.error("[assessment] saveQuestionnaire failed:", err);
    return false;
  }
}

// ── Skill tests ─────────────────────────────────────────────────

export interface StartedTest {
  sessionId: string;
  skill: string;
  minutes: number;
  expiresAt: string;
  questions: PublicQuestion[];
}

export async function startSkillTest(
  userId: string,
  skill: string,
): Promise<{ ok: true; test: StartedTest } | { ok: false; error: string; status: number }> {
  if (!ObjectId.isValid(userId)) return { ok: false, error: "Not signed in.", status: 401 };
  const bank = bankFor(skill);
  if (!bank) return { ok: false, error: "No skill test exists for that skill yet.", status: 404 };
  try {
    const db = await getDb();
    const _id = new ObjectId(userId);
    const last = await db.collection("skillAssessments").findOne({ studentId: _id, skill: bank });
    if (last?.lockedUntil instanceof Date && last.lockedUntil > new Date()) {
      return { ok: false, error: `You can retake the ${bank} test after ${last.lockedUntil.toLocaleString("en-IN")}.`, status: 423 };
    }
    const now = new Date();
    const seed = `${userId}:${now.getTime()}`;
    const built = buildSkillTest(bank, seed)!;
    const expiresAt = new Date(now.getTime() + TEST_MINUTES * 60_000);
    // One live session per skill.
    await db.collection("skillTestSessions").deleteMany({ studentId: _id, skill: bank });
    const res = await db.collection("skillTestSessions").insertOne({
      studentId: _id, skill: bank, seed, questions: built.questions, startedAt: now, expiresAt,
    });
    return {
      ok: true,
      test: { sessionId: res.insertedId.toString(), skill: bank, minutes: TEST_MINUTES, expiresAt: expiresAt.toISOString(), questions: toPublic(built.questions) },
    };
  } catch (err) {
    console.error("[assessment] startSkillTest failed:", err);
    return { ok: false, error: "Could not start the test.", status: 500 };
  }
}

export interface TestResult {
  skill: string;
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  level: number;
  lockedUntil: string | null;
}

export async function submitSkillTest(
  userId: string,
  sessionId: string,
  answers: string[],
): Promise<{ ok: true; result: TestResult } | { ok: false; error: string; status: number }> {
  if (!ObjectId.isValid(userId) || !ObjectId.isValid(sessionId)) return { ok: false, error: "Invalid test session.", status: 400 };
  try {
    const db = await getDb();
    const _id = new ObjectId(userId);
    const session = await db.collection("skillTestSessions").findOne({ _id: new ObjectId(sessionId), studentId: _id });
    if (!session) return { ok: false, error: "Test session not found or already submitted.", status: 404 };
    await db.collection("skillTestSessions").deleteOne({ _id: session._id });

    const expiresAt = session.expiresAt instanceof Date ? session.expiresAt : new Date(0);
    const late = Date.now() > expiresAt.getTime() + 60_000; // 60s grace for network
    const questions = session.questions as KeyedQuestion[];
    const graded = late ? { score: 0, correct: 0, total: questions.length, passed: false } : gradeSkillTest(questions, answers);
    const skill = str(session.skill);
    const now = new Date();
    const lockedUntil = graded.passed ? null : new Date(now.getTime() + COOLDOWN_HOURS * 3_600_000);

    await db.collection("skillAssessments").updateOne(
      { studentId: _id, skill },
      { $set: { studentId: _id, skill, score: graded.score, passed: graded.passed, takenAt: now, lockedUntil, late }, $inc: { attempts: 1 } },
      { upsert: true },
    );

    const level = levelFromScore(graded.score);
    if (graded.passed) {
      // Verify the matching profile skill (by alias), or add it.
      const profile = ((await db.collection("studentProfiles").findOne({ userId: _id })) ?? {}) as Record<string, unknown>;
      const skills = parseProfileSkills(profile.skills);
      const i = skills.findIndex((s) => bankFor(s.name) === skill || norm(s.name) === norm(skill));
      const entry: ProfileSkill = { name: i >= 0 ? skills[i].name : skill, level: Math.max(level, i >= 0 ? skills[i].level : 0), verified: true, source: "skill-test", score: graded.score, verifiedAt: now.toISOString() };
      if (i >= 0) skills[i] = entry; else skills.push(entry);
      await db.collection("studentProfiles").updateOne(
        { userId: _id },
        { $set: { skills: skills.map((s) => ({ ...s, verifiedAt: s.verifiedAt ? new Date(s.verifiedAt) : undefined })), updatedAt: now }, $setOnInsert: { userId: _id, createdAt: now } },
        { upsert: true },
      );
    }

    return { ok: true, result: { skill, ...graded, level: graded.passed ? level : 0, lockedUntil: lockedUntil ? lockedUntil.toISOString() : null } };
  } catch (err) {
    console.error("[assessment] submitSkillTest failed:", err);
    return { ok: false, error: "Could not submit the test.", status: 500 };
  }
}

/**
 * Records the outcome of an externally graded skill test (the AI Agent's
 * papers) with the same rules as the built-in tests: one `skillAssessments`
 * doc per (student, skill), a 24h lock after a fail, and — when `verify` —
 * the profile skill is marked verified (added if it wasn't claimed).
 */
export async function recordSkillTestResult(
  userId: ObjectId,
  skill: string,
  score: number,
  opts: { passed: boolean; verify: boolean; source: string },
): Promise<{ lockedUntil: Date | null }> {
  const db = await getDb();
  const now = new Date();
  const lockedUntil = opts.passed ? null : new Date(now.getTime() + COOLDOWN_HOURS * 3_600_000);
  await db.collection("skillAssessments").updateOne(
    { studentId: userId, skill },
    { $set: { studentId: userId, skill, score, passed: opts.passed, takenAt: now, lockedUntil, source: opts.source }, $inc: { attempts: 1 } },
    { upsert: true },
  );
  if (opts.verify) {
    const profile = ((await db.collection("studentProfiles").findOne({ userId })) ?? {}) as Record<string, unknown>;
    const skills = parseProfileSkills(profile.skills);
    const i = skills.findIndex((s) => norm(s.name) === norm(skill) || (bankFor(s.name) !== null && bankFor(s.name) === bankFor(skill)));
    const level = levelFromScore(score);
    const entry: ProfileSkill = { name: i >= 0 ? skills[i].name : skill, level: Math.max(level, i >= 0 ? skills[i].level : 0), verified: true, source: "skill-test", score, verifiedAt: now.toISOString() };
    if (i >= 0) skills[i] = entry; else skills.push(entry);
    await db.collection("studentProfiles").updateOne(
      { userId },
      { $set: { skills: skills.map((s) => ({ ...s, verifiedAt: s.verifiedAt ? new Date(s.verifiedAt) : undefined })), updatedAt: now }, $setOnInsert: { userId, createdAt: now } },
      { upsert: true },
    );
  }
  return { lockedUntil };
}

/** Active retake lock for a skill, if the student failed it recently. */
export async function getSkillLock(userId: string, skill: string): Promise<Date | null> {
  if (!ObjectId.isValid(userId)) return null;
  try {
    const db = await getDb();
    const last = await db.collection("skillAssessments").findOne({ studentId: new ObjectId(userId), skill });
    return last?.lockedUntil instanceof Date && last.lockedUntil > new Date() ? last.lockedUntil : null;
  } catch {
    return null;
  }
}

/** Names of the student's verified skills (used to police resume content). */
export async function getVerifiedSkillNames(userId: string): Promise<string[]> {
  if (!ObjectId.isValid(userId)) return [];
  try {
    const db = await getDb();
    const profile = await db.collection("studentProfiles").findOne({ userId: new ObjectId(userId) });
    return parseProfileSkills(profile?.skills).filter((s) => s.verified).map((s) => s.name);
  } catch {
    return [];
  }
}
