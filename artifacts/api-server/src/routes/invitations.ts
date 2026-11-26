import { Router } from "express";
import type { Request } from "express";
import { and, eq, gt, gte } from "drizzle-orm";
import { db, invitationsTable, clinicsTable, usersTable, authEventsTable } from "@workspace/db";
import { AcceptInvitationBody } from "@workspace/api-zod";
import { randomUUID } from "crypto";
import { generateToken, hashPassword } from "../lib/auth-security.js";

const router = Router();

// Owner-delivered private invitation link: single use, 7 days (set when the invitation is created).
// Holding the link is enough to claim it. It is NOT proof that the typed email address belongs to the invitee.
const INVITABLE_ROLES = ["doctor", "assistant", "secretary", "nurse"];
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;

function isUsable(status: string, expiresAt: Date): boolean {
  return status === "pending" && expiresAt.getTime() > Date.now();
}

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0] ?? "unknown";
  return req.ip ?? "unknown";
}

// Database-backed rate limit (serverless safe): counts recent attempts per client address.
async function tooManyAttempts(req: Request): Promise<boolean> {
  const key = `invite-ip:${clientIp(req)}`.slice(0, 200);
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS);
  try {
    const recent = await db
      .select({ id: authEventsTable.id })
      .from(authEventsTable)
      .where(and(eq(authEventsTable.userId, key), eq(authEventsTable.type, "invitation_attempt"), gte(authEventsTable.createdAt, since)))
      .limit(MAX_ATTEMPTS);
    if (recent.length >= MAX_ATTEMPTS) return true;
    await db.insert(authEventsTable).values({ id: randomUUID(), userId: key, type: "invitation_attempt", ip: clientIp(req), userAgent: null });
  } catch {
    // Never block on a logging failure.
  }
  return false;
}

router.get("/:token", async (req, res) => {
  if (await tooManyAttempts(req)) return res.status(429).json({ error: "Too many attempts. Try again later." });
  const { token } = req.params;
  const inv = (
    await db.select().from(invitationsTable).where(eq(invitationsTable.token, token)).limit(1)
  )[0];
  if (!inv || !isUsable(inv.status, inv.expiresAt) || !INVITABLE_ROLES.includes(inv.role)) {
    return res.status(404).json({ error: "Invalid or expired invitation" });
  }
  const clinic = (
    await db.select().from(clinicsTable).where(eq(clinicsTable.id, inv.clinicId)).limit(1)
  )[0];

  return res.json({
    email: inv.email,
    name: inv.name,
    role: inv.role,
    clinicName: clinic?.name ?? "",
    expiresAt: inv.expiresAt.toISOString(),
  });
});

router.post("/:token/accept", async (req, res) => {
  if (await tooManyAttempts(req)) return res.status(429).json({ error: "Too many attempts. Try again later." });
  const { token } = req.params;
  const parsed = AcceptInvitationBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }

  const inv = (
    await db.select().from(invitationsTable).where(eq(invitationsTable.token, token)).limit(1)
  )[0];
  if (!inv || !isUsable(inv.status, inv.expiresAt) || !INVITABLE_ROLES.includes(inv.role)) {
    return res.status(404).json({ error: "Invalid or expired invitation" });
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, inv.email)).limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ error: "Email already in use" });
  }

  const clinic = (
    await db.select().from(clinicsTable).where(eq(clinicsTable.id, inv.clinicId)).limit(1)
  )[0];
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });

  const passwordHash = await hashPassword(parsed.data.password);

  // Atomic single-use claim: only one concurrent request can flip pending -> accepted, and only while unexpired.
  const claimed = await db
    .update(invitationsTable)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(and(eq(invitationsTable.id, inv.id), eq(invitationsTable.status, "pending"), gt(invitationsTable.expiresAt, new Date())))
    .returning({ id: invitationsTable.id });
  if (claimed.length === 0) {
    return res.status(404).json({ error: "Invalid or expired invitation" });
  }

  const userId = randomUUID();
  const finalName = parsed.data.name?.trim() || inv.name;
  const now = new Date();
  try {
    // email_verified_at is set only because the sign-in gate requires it. The address was typed by the clinic owner
    // and was not confirmed by email; the auth event below records that the account came from an invitation link.
    await db.insert(usersTable).values({
      id: userId,
      email: inv.email,
      passwordHash,
      name: finalName,
      role: inv.role,
      clinicId: inv.clinicId,
      isBlocked: false,
      emailVerifiedAt: now,
    });
  } catch (error: any) {
    // Release the claim so the owner's link is not burned by a failed account creation.
    await db
      .update(invitationsTable)
      .set({ status: "pending", acceptedAt: null })
      .where(and(eq(invitationsTable.id, inv.id), eq(invitationsTable.status, "accepted")));
    return res.status(409).json({ error: "Email already in use" });
  }

  try {
    await db.insert(authEventsTable).values({
      id: randomUUID(),
      userId,
      type: "invitation_accepted_via_link",
      ip: clientIp(req),
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 500) : null,
    });
  } catch {
    // audit write failure must not break sign-up
  }

  const user = { id: userId, email: inv.email, role: inv.role, clinicId: inv.clinicId, name: finalName, isBlocked: false };
  const clinicObj = {
    id: clinic.id,
    name: clinic.name,
    ownerId: clinic.ownerId,
    status: clinic.status,
    subscriptionStatus: clinic.subscriptionStatus,
    trialEndDate: clinic.trialEndDate.toISOString(),
    subscriptionPlan: clinic.subscriptionPlan,
    createdAt: clinic.createdAt.toISOString(),
  };

  return res.json({ user, clinic: clinicObj, token: generateToken(userId) });
});

export default router;
