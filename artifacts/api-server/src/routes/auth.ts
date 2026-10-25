import type { Request } from "express";
import { Router } from "express";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, usersTable, clinicsTable, passwordResetTokensTable, emailVerificationTokensTable, authEventsTable, authSessionsTable } from "@workspace/db";
import {
  RegisterUserBody,
  LoginUserBody,
  RequestPasswordResetBody,
  ResetPasswordBody,
  ChangePasswordBody,
  VerifyEmailBody,
  ResendVerificationBody,
} from "@workspace/api-zod";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword, upgradeLegacyPassword, verifyPassword } from "../../../../lib/auth-password.mjs";
import { authSessions } from "../lib/auth-sessions";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
let dummyLoginHash: Promise<string> | undefined;

function canExposeRecoveryLinks(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.REPLIT_ENVIRONMENT !== "production";
}

function getDummyLoginHash(): Promise<string> {
  dummyLoginHash ??= hashPassword(randomBytes(32).toString("hex"));
  return dummyLoginHash;
}

async function createRequestNumber(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const now = new Date();
    const datePart = [
      now.getUTCFullYear(),
      String(now.getUTCMonth() + 1).padStart(2, "0"),
      String(now.getUTCDate()).padStart(2, "0"),
    ].join("");
    const candidate = `CS-${datePart}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const existing = await db
      .select({ id: clinicsTable.id })
      .from(clinicsTable)
      .where(eq(clinicsTable.requestNumber, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
  }

  throw new Error("Unable to generate a unique trial request number");
}

type AuthEventType =
  | "login_success"
  | "login_failed"
  | "password_changed"
  | "password_reset"
  | "email_verified";

function originForRequest(req: Request): string {
  if (typeof req.headers.origin === "string" && req.headers.origin) return req.headers.origin;
  return `${req.protocol}://${req.get("host") ?? ""}`;
}

async function issueVerificationToken(userId: string, origin: string) {
  const plainToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
  await db.insert(emailVerificationTokensTable).values({
    id: randomUUID(),
    userId,
    tokenHash: hashToken(plainToken),
    expiresAt,
  });
  const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(plainToken)}`;
  return { verifyToken: plainToken, verifyUrl, expiresAt };
}

function clientIp(req: Request): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0] ?? null;
  return req.ip ?? null;
}

function userAgent(req: Request): string | null {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua.slice(0, 500) : null;
}

async function recordAuthEvent(
  req: Request,
  userId: string,
  type: AuthEventType,
): Promise<void> {
  try {
    await db.insert(authEventsTable).values({
      id: randomUUID(),
      userId,
      type,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
  } catch {
    // Auth event logging is best-effort and must never break the auth flow.
  }
}

router.post("/register", async (req, res) => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const { password, clinicName, ownerName, specialty, whatsappNumber } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ error: "Email already exists" });
  }

  const clinicId = randomUUID();
  const userId = randomUUID();
  const requestNumber = await createRequestNumber();
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 15);
  const now = new Date();
  const passwordHash = await hashPassword(password);

  // Hybrid trial flow: every new clinic starts in pending_approval until an
  // admin manually flips clinics.status to "active" in the database. The user
  // is logged in immediately so the frontend can route them to the
  // /pending-activation page.
  await db.insert(clinicsTable).values({
    id: clinicId,
    requestNumber,
    name: clinicName,
    ownerId: userId,
    status: "pending_approval",
    subscriptionStatus: "trial",
    trialEndDate,
    subscriptionPlan: null,
  });

  await db.insert(usersTable).values({
    id: userId,
    email,
    passwordHash,
    name: ownerName,
    specialty: specialty.trim(),
    whatsappNumber: whatsappNumber.trim(),
    role: "doctor",
    clinicId,
    isBlocked: false,
    emailVerifiedAt: now,
  });

  const user = {
    id: userId,
    email,
    role: "doctor",
    clinicId: clinicId,
    name: ownerName,
    specialty: specialty.trim(),
    whatsappNumber: whatsappNumber.trim(),
    isBlocked: false,
    emailVerifiedAt: now.toISOString(),
  };
  const clinic = {
    id: clinicId,
    requestNumber,
    name: clinicName,
    ownerId: userId,
    status: "pending_approval",
    subscriptionStatus: "trial",
    trialEndDate: trialEndDate.toISOString(),
    subscriptionPlan: null,
    createdAt: now.toISOString(),
  };

  await recordAuthEvent(req, userId, "login_success");
  const token = await authSessions.issue(userId);

  return res.status(201).json({
    message:
      "Account created. Your request is pending approval — please contact support via WhatsApp to activate your 15-day free trial.",
    user,
    clinic,
    token,
  });
});

router.post("/verify-email", async (req, res) => {
  const parsed = VerifyEmailBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const { token } = parsed.data;
  const tokenHash = hashToken(token);

  const rows = await db
    .select()
    .from(emailVerificationTokensTable)
    .where(
      and(
        eq(emailVerificationTokensTable.tokenHash, tokenHash),
        isNull(emailVerificationTokensTable.usedAt),
        gt(emailVerificationTokensTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const record = rows[0];
  if (!record) {
    return res.status(400).json({ error: "Invalid or expired verification token" });
  }

  const now = new Date();
  const verifiedUserId = await db.transaction(async (tx) => {
    const consumed = await tx
      .update(emailVerificationTokensTable)
      .set({ usedAt: now })
      .where(
        and(
          eq(emailVerificationTokensTable.id, record.id),
          isNull(emailVerificationTokensTable.usedAt),
          gt(emailVerificationTokensTable.expiresAt, now),
        ),
      )
      .returning({ userId: emailVerificationTokensTable.userId });
    if (!consumed[0]) return null;
    await tx
      .update(usersTable)
      .set({ emailVerifiedAt: now })
      .where(eq(usersTable.id, consumed[0].userId));
    return consumed[0].userId;
  });
  if (!verifiedUserId) {
    return res.status(400).json({ error: "Invalid or expired verification token" });
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.id, verifiedUserId)).limit(1);
  const user = users[0];
  if (!user) return res.status(404).json({ error: "User not found" });

  const clinics = await db.select().from(clinicsTable).where(eq(clinicsTable.id, user.clinicId)).limit(1);
  const clinic = clinics[0];
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });

  if (clinic.subscriptionStatus === "trial" && new Date() > clinic.trialEndDate) {
    await db.update(clinicsTable).set({ subscriptionStatus: "expired" }).where(eq(clinicsTable.id, clinic.id));
    clinic.subscriptionStatus = "expired";
  }

  await recordAuthEvent(req, user.id, "email_verified");

  const userObj = {
    id: user.id,
    email: user.email,
    role: user.role,
    clinicId: user.clinicId,
    name: user.name,
    specialty: user.specialty,
    whatsappNumber: user.whatsappNumber,
    isBlocked: user.isBlocked,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
  };
  const clinicObj = {
    id: clinic.id,
    requestNumber: clinic.requestNumber ?? null,
    name: clinic.name,
    phone: clinic.phone ?? null,
    address: clinic.address ?? null,
    ownerId: clinic.ownerId,
    status: clinic.status,
    subscriptionStatus: clinic.subscriptionStatus,
    trialEndDate: clinic.trialEndDate.toISOString(),
    subscriptionPlan: clinic.subscriptionPlan,
    createdAt: clinic.createdAt.toISOString(),
  };

  return res.json({ user: userObj, clinic: clinicObj, token: await authSessions.issue(user.id) });
});

router.post("/resend-verification", async (req, res) => {
  const parsed = ResendVerificationBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const email = parsed.data.email.toLowerCase().trim();

  const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  const user = users[0];

  const genericResponse = {
    message:
      "If the email exists and needs verification, instructions can be sent when email delivery is configured.",
    verifyToken: null,
    verifyUrl: null,
    expiresAt: null,
  };

  if (!canExposeRecoveryLinks() || !user || user.emailVerifiedAt) {
    return res.json(genericResponse);
  }

  const { verifyToken, verifyUrl, expiresAt } = await issueVerificationToken(
    user.id,
    originForRequest(req),
  );

  return res.json({
    message: "Verification link generated. Use the token below to verify your email.",
    verifyToken,
    verifyUrl,
    expiresAt: expiresAt.toISOString(),
  });
});

router.post("/login", async (req, res) => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { password } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  const user = users[0];
  const verification = await verifyPassword(password, user?.passwordHash ?? await getDummyLoginHash());
  if (user && verification.legacy) {
    await verifyPassword(password, await getDummyLoginHash());
  }
  if (!user || !verification.valid || user.isBlocked || !user.emailVerifiedAt) {
    if (user) await recordAuthEvent(req, user.id, "login_failed");
    return res.status(401).json({ error: "Invalid email or password" });
  }

  let clinic = null;
  if (user.clinicId) {
    const clinics = await db.select().from(clinicsTable).where(eq(clinicsTable.id, user.clinicId)).limit(1);
    clinic = clinics[0];
    
    if (clinic && clinic.subscriptionStatus === "trial" && new Date() > clinic.trialEndDate) {
      await db.update(clinicsTable).set({ subscriptionStatus: "expired" }).where(eq(clinicsTable.id, clinic.id));
      clinic.subscriptionStatus = "expired";
    }
  }

  if (!clinic && user.role !== "superadmin") {
    await recordAuthEvent(req, user.id, "login_failed");
    return res.status(401).json({ error: "Invalid email or password" });
  }

  if (verification.needsUpgrade) {
    await upgradeLegacyPassword(password, user.passwordHash, async (passwordHash) => {
      await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
    });
  }

  const userObj = { id: user.id, email: user.email, role: user.role, clinicId: user.clinicId, name: user.name, specialty: user.specialty, whatsappNumber: user.whatsappNumber, isBlocked: user.isBlocked, emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null };
  const clinicObj = clinic ? {
    id: clinic.id,
    requestNumber: clinic.requestNumber ?? null,
    name: clinic.name,
    phone: clinic.phone ?? null,
    address: clinic.address ?? null,
    ownerId: clinic.ownerId,
    status: clinic.status,
    subscriptionStatus: clinic.subscriptionStatus,
    trialEndDate: clinic.trialEndDate.toISOString(),
    subscriptionPlan: clinic.subscriptionPlan,
    createdAt: clinic.createdAt.toISOString(),
  } : null;

  await recordAuthEvent(req, user.id, "login_success");
  return res.json({ user: userObj, clinic: clinicObj, token: await authSessions.issue(user.id) });
});

router.post("/forgot-password", async (req, res) => {
  const parsed = RequestPasswordResetBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const email = parsed.data.email.toLowerCase().trim();

  if (!canExposeRecoveryLinks()) {
    return res.json({
      message: "If that email exists, password reset instructions will be sent when email delivery is configured.",
      resetToken: null,
      resetUrl: null,
      expiresAt: null,
    });
  }

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

  const now = new Date();
  const passwordHash = await hashPassword(password);
  const resetApplied = await db.transaction(async (tx) => {
    const consumed = await tx
      .update(passwordResetTokensTable)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokensTable.id, record.id),
          isNull(passwordResetTokensTable.usedAt),
          gt(passwordResetTokensTable.expiresAt, now),
        ),
      )
      .returning({ userId: passwordResetTokensTable.userId });
    if (!consumed[0]) return false;
    await tx.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, consumed[0].userId));
    await tx
      .update(authSessionsTable)
      .set({ revokedAt: now })
      .where(and(eq(authSessionsTable.userId, consumed[0].userId), isNull(authSessionsTable.revokedAt)));
    return true;
  });
  if (!resetApplied) {
    return res.status(400).json({ error: "Invalid or expired reset token" });
  }

  await recordAuthEvent(req, record.userId, "password_reset");
  return res.json({ message: "Password updated successfully. You can now sign in." });
});

router.post("/change-password", requireAuth, async (req, res) => {
  const userId = req.authUser!.id;

  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const { currentPassword, newPassword } = parsed.data;

  if (currentPassword === newPassword) {
    return res.status(400).json({ error: "New password must be different from current password" });
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const user = users[0];
  if (!user) return res.status(401).json({ error: "Invalid token" });

  const verification = await verifyPassword(currentPassword, user.passwordHash);
  if (!verification.valid) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  const passwordHash = await hashPassword(newPassword);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));
    await tx
      .update(authSessionsTable)
      .set({ revokedAt: now })
      .where(and(eq(authSessionsTable.userId, userId), isNull(authSessionsTable.revokedAt)));
  });

  await recordAuthEvent(req, userId, "password_changed");
  return res.json({ message: "Password changed successfully." });
});

router.post("/logout", requireAuth, async (req, res) => {
  if (req.authSessionId) await authSessions.revoke(req.authSessionId);
  return res.json({ message: "Signed out successfully." });
});

router.get("/events", requireAuth, async (req, res) => {
  const userId = req.authUser!.id;

  const events = await db
    .select()
    .from(authEventsTable)
    .where(eq(authEventsTable.userId, userId))
    .orderBy(desc(authEventsTable.createdAt))
    .limit(20);

  return res.json(
    events.map((e) => ({
      id: e.id,
      type: e.type,
      ip: e.ip,
      userAgent: e.userAgent,
      createdAt: e.createdAt.toISOString(),
    })),
  );
});

router.get("/me", requireAuth, async (req, res) => {
  const userId = req.authUser!.id;

  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const user = users[0];
  if (!user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  return res.json({ id: user.id, email: user.email, role: user.role, clinicId: user.clinicId, name: user.name, specialty: user.specialty, whatsappNumber: user.whatsappNumber, isBlocked: user.isBlocked, emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null });
});

router.patch("/me", requireAuth, async (req, res) => {
  const userId = req.authUser!.id;

  const body = req.body ?? {};
  const updates: { name?: string; specialty?: string | null; whatsappNumber?: string | null } = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (body.specialty === null || typeof body.specialty === "string") {
    updates.specialty = body.specialty === null ? null : (body.specialty as string).trim() || null;
  }
  if (body.whatsappNumber === null || typeof body.whatsappNumber === "string") {
    updates.whatsappNumber = body.whatsappNumber === null ? null : (body.whatsappNumber as string).trim() || null;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));
  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const user = users[0];
  if (!user) return res.status(404).json({ error: "User not found" });

  return res.json({ id: user.id, email: user.email, role: user.role, clinicId: user.clinicId, name: user.name, specialty: user.specialty, whatsappNumber: user.whatsappNumber, isBlocked: user.isBlocked, emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null });
});

export default router;
