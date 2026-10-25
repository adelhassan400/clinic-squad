import { Router } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, invitationsTable, clinicsTable, usersTable } from "@workspace/db";
import { AcceptInvitationBody } from "@workspace/api-zod";
import { randomUUID, createHash } from "crypto";
import { createAuthToken } from "../middlewares/auth";

const router = Router();

function hashPassword(password: string): string {
  return createHash("sha256").update(password + "clinicsquad_salt").digest("hex");
}

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

  try {
    const accepted = await db.transaction(async (tx: any) => {
      const inv = (
        await tx.select().from(invitationsTable).where(eq(invitationsTable.token, token)).limit(1)
      )[0];
      if (!inv || !isUsable(inv.status, inv.expiresAt)) {
        return { error: "Invalid or expired invitation", status: 404 as const };
      }
      if (!["assistant", "secretary", "nurse"].includes(inv.role)) {
        return { error: "Invitation role is not allowed", status: 409 as const };
      }

      const existing = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, inv.email))
        .limit(1);
      if (existing.length > 0) {
        return { error: "Email already in use", status: 409 as const };
      }

      const clinic = (
        await tx.select().from(clinicsTable).where(eq(clinicsTable.id, inv.clinicId)).limit(1)
      )[0];
      if (!clinic) return { error: "Clinic not found", status: 404 as const };
      if (clinic.status !== "active") {
        return { error: "Clinic is not accepting invitations", status: 403 as const };
      }

      const now = new Date();
      const claimed = await tx
        .update(invitationsTable)
        .set({ status: "accepted", acceptedAt: now })
        .where(and(
          eq(invitationsTable.id, inv.id),
          eq(invitationsTable.status, "pending"),
          gt(invitationsTable.expiresAt, now),
        ))
        .returning({ id: invitationsTable.id });
      if (claimed.length === 0) {
        return { error: "Invalid or expired invitation", status: 404 as const };
      }

      const userId = randomUUID();
      const finalName = parsed.data.name?.trim() || inv.name;
      await tx.insert(usersTable).values({
        id: userId,
        email: inv.email,
        passwordHash: hashPassword(parsed.data.password),
        name: finalName,
        role: inv.role,
        clinicId: inv.clinicId,
        isBlocked: false,
      });

      return {
        user: {
          id: userId,
          email: inv.email,
          role: inv.role,
          clinicId: inv.clinicId,
          name: finalName,
          isBlocked: false,
        },
        clinic: {
          id: clinic.id,
          name: clinic.name,
          ownerId: clinic.ownerId,
          status: clinic.status,
          subscriptionStatus: clinic.subscriptionStatus,
          trialEndDate: clinic.trialEndDate.toISOString(),
          subscriptionPlan: clinic.subscriptionPlan,
          createdAt: clinic.createdAt.toISOString(),
        },
      };
    });

    if ("error" in accepted) return res.status(accepted.status ?? 500).json({ error: accepted.error });
    return res.json({ ...accepted, token: createAuthToken(accepted.user.id) });
  } catch {
    return res.status(409).json({ error: "Invitation could not be accepted" });
  }
});

export default router;
