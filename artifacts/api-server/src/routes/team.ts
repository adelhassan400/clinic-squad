import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, clinicsTable, invitationsTable } from "@workspace/db";
import { CreateInvitationBody } from "@workspace/api-zod";
import { randomUUID, randomBytes } from "crypto";
import { requireAuth, requireRole, getMemberLimit } from "../middlewares/auth";

const router = Router({ mergeParams: true });

const INVITE_TTL_DAYS = 7;

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

function isPending(status: string, expiresAt: Date): boolean {
  return status === "pending" && expiresAt.getTime() > Date.now();
}

router.use(requireAuth);

// Ensure the authed user belongs to the clinic in the URL.
router.use((req, res, next): void => {
  const { clinicId } = req.params as { clinicId?: string };
  if (!clinicId) {
    res.status(400).json({ error: "Missing clinicId" });
    return;
  }
  if (req.authUser!.clinicId !== clinicId && req.authUser!.role !== "superadmin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
});

router.get("/members", async (req, res) => {
  const { clinicId } = req.params;

  const clinic = (
    await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1)
  )[0];
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });

  const users = await db.select().from(usersTable).where(eq(usersTable.clinicId, clinicId));
  const invites = await db
    .select()
    .from(invitationsTable)
    .where(eq(invitationsTable.clinicId, clinicId));

  const members = users
    .filter((u) => u.role !== "superadmin")
    .map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isOwner: u.id === clinic.ownerId,
      isBlocked: u.isBlocked,
      createdAt: u.createdAt.toISOString(),
    }));

  const pendingCount = invites.filter((i) => isPending(i.status, i.expiresAt)).length;
  const memberLimit = getMemberLimit(clinic.subscriptionStatus);
  const nonAdminMembers = members.filter((m) => m.role !== "admin").length;
  const usedSlots = nonAdminMembers + pendingCount;

  return res.json({
    members,
    pendingCount,
    memberLimit,
    usedSlots,
    plan: clinic.subscriptionStatus,
  });
});

router.delete("/members/:userId", requireRole("admin", "superadmin"), async (req, res) => {
  const { clinicId, userId } = req.params;
  const clinic = (
    await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1)
  )[0];
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });
  if (clinic.ownerId === userId) {
    return res.status(403).json({ error: "Cannot remove the clinic owner" });
  }

  await db
    .delete(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.clinicId, clinicId)));
  return res.status(204).send();
});

router.get("/invitations", async (req, res) => {
  const { clinicId } = req.params;
  const all = await db
    .select()
    .from(invitationsTable)
    .where(eq(invitationsTable.clinicId, clinicId));

  const pending = all.filter((i) => isPending(i.status, i.expiresAt));
  return res.json(
    pending.map((i) => ({
      id: i.id,
      clinicId: i.clinicId,
      email: i.email,
      name: i.name,
      role: i.role,
      token: i.token,
      status: i.status,
      invitedBy: i.invitedBy,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    }))
  );
});

router.post("/invitations", requireRole("admin", "superadmin"), async (req, res) => {
  const { clinicId } = req.params;
  const parsed = CreateInvitationBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const { name, role } = parsed.data;

  const clinic = (
    await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1)
  )[0];
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });

  // Plan limit
  const users = await db.select().from(usersTable).where(eq(usersTable.clinicId, clinicId));
  const invites = await db
    .select()
    .from(invitationsTable)
    .where(eq(invitationsTable.clinicId, clinicId));
  const nonAdmin = users.filter((u) => u.role !== "admin" && u.role !== "superadmin").length;
  const pending = invites.filter((i) => isPending(i.status, i.expiresAt)).length;
  const limit = getMemberLimit(clinic.subscriptionStatus);

  if (nonAdmin + pending >= limit) {
    return res.status(402).json({
      error: "Plan member limit reached",
      limit,
      plan: clinic.subscriptionStatus,
    });
  }

  // Email uniqueness — not already on team
  const existingUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (existingUser.length > 0) {
    return res.status(409).json({ error: "Email already has an account" });
  }
  const existingPending = invites.find(
    (i) => i.email.toLowerCase() === email && isPending(i.status, i.expiresAt)
  );
  if (existingPending) {
    return res.status(409).json({ error: "Already invited" });
  }

  const id = randomUUID();
  const token = newToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  await db.insert(invitationsTable).values({
    id,
    clinicId,
    email,
    name,
    role,
    token,
    status: "pending",
    invitedBy: req.authUser!.id,
    expiresAt,
  });

  const inv = (await db.select().from(invitationsTable).where(eq(invitationsTable.id, id)).limit(1))[0];
  return res.status(201).json({
    id: inv.id,
    clinicId: inv.clinicId,
    email: inv.email,
    name: inv.name,
    role: inv.role,
    token: inv.token,
    status: inv.status,
    invitedBy: inv.invitedBy,
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
  });
});

router.delete(
  "/invitations/:invitationId",
  requireRole("admin", "superadmin"),
  async (req, res) => {
    const { clinicId, invitationId } = req.params;
    await db
      .update(invitationsTable)
      .set({ status: "revoked" })
      .where(
        and(eq(invitationsTable.id, invitationId), eq(invitationsTable.clinicId, clinicId))
      );
    return res.status(204).send();
  }
);

export default router;
