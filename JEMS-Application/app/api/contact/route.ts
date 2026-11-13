import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/mongodb";
import { readJsonLimited } from "@/lib/http";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * Public inbox for the contact form (`kind: "message"`) and the footer's
 * weekly-tips signup (`kind: "newsletter"`).
 *
 *  contactMessages        { name, email, message, ip, status: "new", createdAt }
 *  newsletterSubscribers  { email, createdAt, updatedAt }   (one per email)
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limit = await rateLimit(`contact:${ip}`, 5, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  const parsed = await readJsonLimited(request, 6_000);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const email = text(body.email, 200).toLowerCase();
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  try {
    const db = await getDatabase();
    const now = new Date();
    if (body.kind === "newsletter") {
      await db.collection("newsletterSubscribers").updateOne({ email }, { $set: { email, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });
      return NextResponse.json({ ok: true });
    }
    const name = text(body.name, 100);
    const message = text(body.message, 4_000);
    if (!name) return NextResponse.json({ error: "Please tell us your name." }, { status: 400 });
    if (message.length < 5) return NextResponse.json({ error: "Please write a message." }, { status: 400 });
    await db.collection("contactMessages").insertOne({ name, email, message, ip, status: "new", createdAt: now });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] POST failed:", err);
    return NextResponse.json({ error: "Could not send right now — please try again." }, { status: 500 });
  }
}
