import type { Request } from "express";
import { Router } from "express";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, usersTable, clinicsTable, passwordResetTokensTable, emailVerificationTokensTable, authEventsTable } from "@workspace/db";
import {
  RegisterUserBody,
  LoginUserBody,
  RequestPasswordResetBody,
  ResetPasswordBody,
  ChangePasswordBody,
  VerifyEmailBody,
  ResendVerificationBody,
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
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

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

function generateToken(userId: string): string {
  return Buffer.from(`${userId}:${Date.now()}`).toString("base64");
}

router.post("/register", async (req, res) => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const { email, password, clinicName, ownerName, specialty, whatsappNumber } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ error: "Email already exists" });
  }

  const clinicId = randomUUID();
  const userId = randomUUID();
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 15);
  const now = new Date();

  // Hybrid trial flow: every new clinic starts in pending_approval until an
  // admin manually flips clinics.status to "active" in the database. The user
  // is logged in immediately so the frontend can route them to the
  // /pending-activation page.
  await db.insert(clinicsTable).values({
    id: clinicId,
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
    passwordHash: hashPassword(password),
    name: ownerName,
    specialty: specialty.trim(),
    whatsappNumber: whatsappNumber.trim(),
    role: "admin",
    clinicId,
    isBlocked: false,
    emailVerifiedAt: now,
  });

  const user = {
    id: userId,
    email,
    role: "admin",
    clinicId,
    name: ownerName,
    specialty: specialty.trim(),
    whatsappNumber: whatsappNumber.trim(),
    isBlocked: false,
    emailVerifiedAt: now.toISOString(),
  };
  const clinic = {
    id: clinicId,
    name: clinicName,
    ownerId: userId,
    status: "pending_approval",
    subscriptionStatus: "trial",
    trialEndDate: trialEndDate.toISOString(),
    subscriptionPlan: null,
    createdAt: now.toISOString(),
  };

  await recordAuthEvent(req, userId, "login_success");

  return res.status(201).json({
    message:
      "Account created. Your request is pending approval — please contact support via WhatsApp to activate your 15-day free trial.",
    user,
    clinic,
    token: generateToken(userId),
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
  await db
    .update(usersTable)
    .set({ emailVerifiedAt: now })
    .where(eq(usersTable.id, record.userId));
  await db
    .update(emailVerificationTokensTable)
    .set({ usedAt: now })
    .where(eq(emailVerificationTokensTable.id, record.id));

  const users = await db.select().from(usersTable).where(eq(usersTable.id, record.userId)).limit(1);
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

  return res.json({ user: userObj, clinic: clinicObj, token: generateToken(user.id) });
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
      "If the email exists and is not yet verified, a new verification link has been generated.",
    verifyToken: null,
    verifyUrl: null,
    expiresAt: null,
  };

  if (!user || user.emailVerifiedAt) {
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
  const { email, password } = parsed.data;

  const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  const user = users[0];
  if (!user || user.passwordHash !== hashPassword(password)) {
    if (user) await recordAuthEvent(req, user.id, "login_failed");
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (user.isBlocked) {
    await recordAuthEvent(req, user.id, "login_failed");
    return res.status(403).json({ error: "Account is blocked" });
  }

  if (!user.emailVerifiedAt) {
    await recordAuthEvent(req, user.id, "login_failed");
    return res.status(403).json({
      error: "Email not verified. Please check your inbox for the verification link.",
      code: "email_not_verified",
      email: user.email,
    });
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

  const userObj = { id: user.id, email: user.email, role: user.role, clinicId: user.clinicId, name: user.name, specialty: user.specialty, whatsappNumber: user.whatsappNumber, isBlocked: user.isBlocked, emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null };
  const clinicObj = {
    id: clinic.id,
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

  await recordAuthEvent(req, user.id, "login_success");
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

  await recordAuthEvent(req, record.userId, "password_reset");
  return res.json({ message: "Password updated successfully. You can now sign in." });
});

router.post("/change-password", async (req, res) => {
  const userId = userIdFromAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

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

  if (user.passwordHash !== hashPassword(currentPassword)) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  await db.update(usersTable).set({ passwordHash: hashPassword(newPassword) }).where(eq(usersTable.id, userId));

  await recordAuthEvent(req, userId, "password_changed");
  return res.json({ message: "Password changed successfully." });
});

router.get("/events", async (req, res) => {
  const userId = userIdFromAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

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

  return res.json({ id: user.id, email: user.email, role: user.role, clinicId: user.clinicId, name: user.name, specialty: user.specialty, whatsappNumber: user.whatsappNumber, isBlocked: user.isBlocked, emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null });
});

router.patch("/me", async (req, res) => {
  const userId = userIdFromAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

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
