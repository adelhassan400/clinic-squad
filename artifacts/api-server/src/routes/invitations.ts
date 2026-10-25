import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, invitationsTable, clinicsTable, usersTable } from "@workspace/db";
import { AcceptInvitationBody } from "@workspace/api-zod";
import { randomUUID } from "node:crypto";
import { hashPassword } from "../../../../lib/auth-password.mjs";
import { authSessions } from "../lib/auth-sessions";

const router = Router();

function isUsable(status: string, expiresAt: Date): boolean {
  return status === "pending" && expiresAt.getTime() > Date.now();
}

router.get("/:token", async (req, res) => {
  const { token } = req.params;
  const inv = (
    await db.select().from(invitationsTable).where(eq(invitationsTable.token, token)).limit(1)
  )[0];
  if (!inv || !isUsable(inv.status, inv.expiresAt)) {
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
  const { token } = req.params;
  const parsed = AcceptInvitationBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }

  const inv = (
    await db.select().from(invitationsTable).where(eq(invitationsTable.token, token)).limit(1)
  )[0];
  if (!inv || !isUsable(inv.status, inv.expiresAt)) {
    return res.status(404).json({ error: "Invalid or expired invitation" });
  }

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, inv.email))
    .limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ error: "Email already in use" });
  }

  const clinic = (
    await db.select().from(clinicsTable).where(eq(clinicsTable.id, inv.clinicId)).limit(1)
  )[0];
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });

  const userId = randomUUID();
  const finalName = parsed.data.name?.trim() || inv.name;
  const passwordHash = await hashPassword(parsed.data.password);
  await db.insert(usersTable).values({
    id: userId,
    email: inv.email,
    passwordHash,
    name: finalName,
    role: inv.role,
    clinicId: inv.clinicId,
    isBlocked: false,
    emailVerifiedAt: new Date(),
  });

  await db
    .update(invitationsTable)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(invitationsTable.id, inv.id));

  const user = {
    id: userId,
    email: inv.email,
    role: inv.role,
    clinicId: inv.clinicId,
    name: finalName,
    isBlocked: false,
  };
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

  return res.json({ user, clinic: clinicObj, token: await authSessions.issue(userId) });
});

export default router;
