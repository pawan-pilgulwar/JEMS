import { ObjectId, type Db, type Document } from "mongodb";
import { getDatabase } from "@/lib/db/mongodb";
import { createNotification } from "@/lib/db/notifications";
import { loadAcademics, type AcademicSummary } from "@/lib/db/people";
import type { InterestStatus, ListingStatus } from "@/lib/company/constants";

/**
 * Industry ↔ academia collaboration catalogue (FDPs, faculty internships,
 * industrial training, guest lectures, research, consultancy, challenges)
 * and the "express interest" records faculty leave against them.
 *
 *  collaborationInterests { userId, collaborationId, status, createdAt, updatedAt? }
 *  status: Interested → Accepted | Declined (set by the publishing company)
 */

export interface CollaborationView {
  id: string;
  company: string;
  /** The publishing company's account, for its profile page (empty for legacy rows). */
  companyId: string;
  title: string;
  type: string;
  domain: string[];
  duration: string;
  startsAt: string;
  location: string;
  seats: number;
  description: string;
  status: ListingStatus;
  interested: number;
  accepted: number;
  mine: boolean;
  /** The signed-in user's interest status, when they have one. */
  myStatus: string | null;
  /** Institution view only: the institution's own faculty who are interested. */
  fromMyInstitution?: { name: string; department: string; status: string }[];
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : "");

async function getDb(): Promise<Db> {
  return getDatabase();
}

function baseFromDoc(c: Document) {
  return {
    id: c._id.toString(),
    company: str(c.company),
    companyId: c.companyId instanceof ObjectId ? c.companyId.toString() : "",
    title: str(c.title),
    type: str(c.type),
    domain: Array.isArray(c.domain) ? c.domain.map(String) : [],
    duration: str(c.duration),
    startsAt: iso(c.startsAt),
    location: str(c.location),
    seats: Number(c.seats) || 0,
    description: str(c.description),
    status: (str(c.status) === "closed" ? "closed" : "open") as ListingStatus,
  };
}

export async function listCollaborations(userId: string): Promise<CollaborationView[]> {
  try {
    const db = await getDb();
    const uid = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
    const [rows, interests] = await Promise.all([
      db.collection("collaborations").find({}).sort({ startsAt: 1 }).toArray(),
      db.collection("collaborationInterests").find({}).toArray(),
    ]);
    const counts = new Map<string, { interested: number; accepted: number }>();
    const mine = new Map<string, string>();
    for (const i of interests) {
      const k = String(i.collaborationId);
      const c = counts.get(k) ?? { interested: 0, accepted: 0 };
      c.interested += 1;
      if (str(i.status) === "Accepted") c.accepted += 1;
      counts.set(k, c);
      if (uid && String(i.userId) === String(uid)) mine.set(k, str(i.status) || "Interested");
    }
    return rows.map((c) => {
      const base = baseFromDoc(c);
      const n = counts.get(base.id);
      return { ...base, interested: n?.interested ?? 0, accepted: n?.accepted ?? 0, mine: mine.has(base.id), myStatus: mine.get(base.id) ?? null };
    });
  } catch (err) {
    console.error("[collaborations] listCollaborations failed:", err);
    return [];
  }
}

/** Institution view: every collaboration, plus which of *this* institution's faculty are interested. */
export async function listCollaborationsForInstitution(institutionUserId: string, facultyIds: ObjectId[]): Promise<CollaborationView[]> {
  const items = await listCollaborations(institutionUserId);
  if (facultyIds.length === 0) return items.map((c) => ({ ...c, fromMyInstitution: [] }));
  try {
    const db = await getDb();
    const [interests, people] = await Promise.all([
      db.collection("collaborationInterests").find({ userId: { $in: facultyIds } }).toArray(),
      loadAcademics(db, facultyIds),
    ]);
    const byCollab = new Map<string, { name: string; department: string; status: string }[]>();
    for (const i of interests) {
      const p = people.get(String(i.userId));
      if (!p) continue;
      const k = String(i.collaborationId);
      byCollab.set(k, [...(byCollab.get(k) ?? []), { name: p.name, department: p.department, status: str(i.status) || "Interested" }]);
    }
    return items.map((c) => ({ ...c, fromMyInstitution: byCollab.get(c.id) ?? [] }));
  } catch (err) {
    console.error("[collaborations] listCollaborationsForInstitution failed:", err);
    return items;
  }
}

/** Toggles the signed-in user's interest in a collaboration. Returns the new state. */
export async function toggleInterest(userId: string, collaborationId: string): Promise<{ ok: boolean; interested: boolean; error?: string }> {
  if (!ObjectId.isValid(userId) || !ObjectId.isValid(collaborationId)) return { ok: false, interested: false };
  try {
    const db = await getDb();
    const filter = { userId: new ObjectId(userId), collaborationId: new ObjectId(collaborationId) };
    const collab = await db.collection("collaborations").findOne({ _id: filter.collaborationId });
    if (!collab) return { ok: false, interested: false };
    const existing = await db.collection("collaborationInterests").findOne(filter);
    if (existing) {
      await db.collection("collaborationInterests").deleteOne({ _id: existing._id });
      return { ok: true, interested: false };
    }
    if (str(collab.status) === "closed") return { ok: false, interested: false, error: "This collaboration is closed to new interest." };
    await db.collection("collaborationInterests").insertOne({ ...filter, status: "Interested", createdAt: new Date() });

    // Tell the publishing company straight away, so faculty interest shows
    // up on the industry side as it happens.
    if (collab.companyId instanceof ObjectId) {
      const p = (await loadAcademics(db, [filter.userId])).get(userId);
      const who = p
        ? `${p.name}${p.role === "faculty" && p.designation ? `, ${p.designation}` : ""}${p.institution ? ` (${p.institution})` : ""}`
        : "An academician";
      await createNotification({
        userId: collab.companyId,
        kind: "application",
        title: `New interest in ${str(collab.title)}`,
        body: `${who} expressed interest in your ${str(collab.type) || "collaboration"}.`,
        link: `/company/programs?tab=collaborations&item=${collab._id.toString()}`,
      });
    }
    return { ok: true, interested: true };
  } catch (err) {
    console.error("[collaborations] toggleInterest failed:", err);
    return { ok: false, interested: false };
  }
}

export interface CollaborationInput {
  title: string;
  type: string;
  domain: string[];
  duration: string;
  startsAt: string;
  location: string;
  seats: number;
  description: string;
}

/** A company publishes a new collaboration opportunity. */
export async function createCollaboration(companyUserId: string, company: string, input: CollaborationInput): Promise<boolean> {
  if (!ObjectId.isValid(companyUserId)) return false;
  try {
    const db = await getDb();
    await db.collection("collaborations").insertOne({
      companyId: new ObjectId(companyUserId),
      company: String(company),
      title: String(input.title),
      type: String(input.type),
      domain: input.domain.map(String),
      duration: String(input.duration),
      startsAt: new Date(input.startsAt),
      location: String(input.location),
      seats: Number(input.seats) || 0,
      description: String(input.description),
      status: "open",
      createdAt: new Date(),
    });
    return true;
  } catch (err) {
    console.error("[collaborations] createCollaboration failed:", err);
    return false;
  }
}

// ── Company side ────────────────────────────────────────────────

export interface InterestedAcademicView extends AcademicSummary {
  interestId: string;
  status: string;
  expressedAt: string;
}

export interface CompanyCollaborationView extends CollaborationView {
  people: InterestedAcademicView[];
}

/** The company's own collaborations with everyone who expressed interest. */
export async function listCompanyCollaborations(companyUserId: string): Promise<CompanyCollaborationView[]> {
  if (!ObjectId.isValid(companyUserId)) return [];
  try {
    const db = await getDb();
    const rows = await db.collection("collaborations").find({ companyId: new ObjectId(companyUserId) }).sort({ startsAt: 1 }).toArray();
    const interests = await db
      .collection("collaborationInterests")
      .find({ collaborationId: { $in: rows.map((r) => r._id) } })
      .sort({ createdAt: -1 })
      .toArray();
    const people = await loadAcademics(db, [...new Set(interests.map((i) => String(i.userId)))].map((s) => new ObjectId(s)));
    const byCollab = new Map<string, InterestedAcademicView[]>();
    for (const i of interests) {
      const p = people.get(String(i.userId));
      if (!p) continue;
      const k = String(i.collaborationId);
      byCollab.set(k, [...(byCollab.get(k) ?? []), { ...p, interestId: i._id.toString(), status: str(i.status) || "Interested", expressedAt: iso(i.createdAt) }]);
    }
    return rows.map((c) => {
      const people = byCollab.get(c._id.toString()) ?? [];
      return {
        ...baseFromDoc(c),
        interested: people.length,
        accepted: people.filter((p) => p.status === "Accepted").length,
        mine: false,
        myStatus: null,
        people,
      };
    });
  } catch (err) {
    console.error("[collaborations] listCompanyCollaborations failed:", err);
    return [];
  }
}

/** Company accepts or declines an academician's interest (own collaborations only). */
export async function updateInterestStatus(companyUserId: string, interestId: string, status: InterestStatus): Promise<boolean> {
  if (!ObjectId.isValid(companyUserId) || !ObjectId.isValid(interestId)) return false;
  try {
    const db = await getDb();
    const interest = await db.collection("collaborationInterests").findOne({ _id: new ObjectId(interestId) });
    if (!interest) return false;
    const collab = await db.collection("collaborations").findOne({ _id: interest.collaborationId, companyId: new ObjectId(companyUserId) });
    if (!collab) return false;
    await db.collection("collaborationInterests").updateOne({ _id: interest._id }, { $set: { status, updatedAt: new Date() } });
    if (status !== (str(interest.status) || "Interested")) {
      const user = await db.collection("users").findOne({ _id: interest.userId }, { projection: { role: 1 } });
      await createNotification({
        userId: interest.userId as ObjectId,
        kind: "info",
        title: `${str(collab.title)}: ${status}`,
        body: `${str(collab.company)} marked your interest as "${status}".`,
        link: str(user?.role) === "institution" ? "/institution/collaborations" : "/faculty/collaborations",
      });
    }
    return true;
  } catch (err) {
    console.error("[collaborations] updateInterestStatus failed:", err);
    return false;
  }
}

export async function setCollaborationStatus(companyUserId: string, collaborationId: string, status: ListingStatus): Promise<boolean> {
  if (!ObjectId.isValid(companyUserId) || !ObjectId.isValid(collaborationId)) return false;
  try {
    const db = await getDb();
    const res = await db
      .collection("collaborations")
      .updateOne({ _id: new ObjectId(collaborationId), companyId: new ObjectId(companyUserId) }, { $set: { status, updatedAt: new Date() } });
    return res.matchedCount === 1;
  } catch (err) {
    console.error("[collaborations] setCollaborationStatus failed:", err);
    return false;
  }
}
