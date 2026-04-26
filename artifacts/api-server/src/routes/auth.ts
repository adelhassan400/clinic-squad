import { Router } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, usersTable, clinicsTable, passwordResetTokensTable } from "@workspace/db";
import {
  RegisterUserBody,
  LoginUserBody,
  RequestPasswordResetBody,
  ResetPasswordBody,
} from "@workspace/api-zod";
import { randomUUID, randomBytes } from "crypto";
import { createHash } from "crypto";

const router = Router();

function hashPassword(password: string): string {
  return createHash("sha256").update(password + "clinicsquad_salt").digest("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function generateToken(userId: string): string {
  return Buffer.from(`${userId}:${Date.now()}`).toString("base64");
}

router.post("/register", async (req, res) => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const { email, password, clinicName, ownerName } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ error: "Email already exists" });
  }

  const clinicId = randomUUID();
  const userId = randomUUID();
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 15);

  await db.insert(clinicsTable).values({
    id: clinicId,
    name: clinicName,
    ownerId: userId,
    status: "active",
    subscriptionStatus: "trial",
    trialEndDate,
    subscriptionPlan: null,
  });

  await db.insert(usersTable).values({
    id: userId,
    email,
    passwordHash: hashPassword(password),
    name: ownerName,
    role: "admin",
    clinicId,
    isBlocked: false,
  });

  const user = { id: userId, email, role: "admin", clinicId, name: ownerName, isBlocked: false };
  const clinic = {
    id: clinicId,
    name: clinicName,
    ownerId: userId,
    status: "active",
    subscriptionStatus: "trial",
    trialEndDate: trialEndDate.toISOString(),
    subscriptionPlan: null,
    createdAt: new Date().toISOString(),
  };

  return res.status(201).json({ user, clinic, token: generateToken(userId) });
});

router.post("/login", async (req, res) => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { email, password } = parsed.data;

  const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  const user = users[0];
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (user.isBlocked) {
    return res.status(403).json({ error: "Account is blocked" });
  }

  const clinics = await db.select().from(clinicsTable).where(eq(clinicsTable.id, user.clinicId)).limit(1);
  const clinic = clinics[0];
  if (!clinic) {
    return res.status(404).json({ error: "Clinic not found" });
  }

  // Check trial expiry and update status if needed
  if (clinic.subscriptionStatus === "trial" && new Date() > clinic.trialEndDate) {
    await db.update(clinicsTable).set({ subscriptionStatus: "expired" }).where(eq(clinicsTable.id, clinic.id));
    clinic.subscriptionStatus = "expired";
  }

  const userObj = { id: user.id, email: user.email, role: user.role, clinicId: user.clinicId, name: user.name, isBlocked: user.isBlocked };
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

  return res.json({ user: userObj, clinic: clinicObj, token: generateToken(user.id) });
});

router.post("/forgot-password", async (req, res) => {
  const parsed = RequestPasswordResetBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const email = parsed.data.email.toLowerCase().trim();

  const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  const user = users[0];

  if (!user) {
    return res.json({
      message: "If that email exists, a password reset link has been generated.",
      resetToken: null,
      resetUrl: null,
      expiresAt: null,
    });
  }

  const plainToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await db.insert(passwordResetTokensTable).values({
    id: randomUUID(),
    userId: user.id,
    tokenHash: hashToken(plainToken),
    expiresAt,
  });

  const origin =
    (typeof req.headers.origin === "string" && req.headers.origin) ||
    `${req.protocol}://${req.get("host") ?? ""}`;
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(plainToken)}`;

  return res.json({
    message: "Password reset link generated. Use the token below to set a new password.",
    resetToken: plainToken,
    resetUrl,
    expiresAt: expiresAt.toISOString(),
  });
});

router.post("/reset-password", async (req, res) => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);

  const rows = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.tokenHash, tokenHash),
        isNull(passwordResetTokensTable.usedAt),
        gt(passwordResetTokensTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const record = rows[0];
  if (!record) {
    return res.status(400).json({ error: "Invalid or expired reset token" });
  }

  await db.update(usersTable).set({ passwordHash: hashPassword(password) }).where(eq(usersTable.id, record.userId));
  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokensTable.id, record.id));

  return res.json({ message: "Password updated successfully. You can now sign in." });
});

function userIdFromAuth(req: any): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const decoded = Buffer.from(token, "base64").toString();
  return decoded.split(":")[0] || null;
}

router.get("/me", async (req, res) => {
  const userId = userIdFromAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const user = users[0];
  if (!user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  return res.json({ id: user.id, email: user.email, role: user.role, clinicId: user.clinicId, name: user.name, specialty: user.specialty, isBlocked: user.isBlocked });
});

router.patch("/me", async (req, res) => {
  const userId = userIdFromAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const body = req.body ?? {};
  const updates: { name?: string; specialty?: string | null } = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (body.specialty === null || typeof body.specialty === "string") {
    updates.specialty = body.specialty === null ? null : (body.specialty as string).trim() || null;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));
  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const user = users[0];
  if (!user) return res.status(404).json({ error: "User not found" });

  return res.json({ id: user.id, email: user.email, role: user.role, clinicId: user.clinicId, name: user.name, specialty: user.specialty, isBlocked: user.isBlocked });
});

export default router;
