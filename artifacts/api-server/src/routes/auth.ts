import type { Request } from "express";
import { Router } from "express";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, usersTable, clinicsTable, passwordResetTokensTable, authEventsTable } from "@workspace/db";
import {
  RegisterUserBody,
  LoginUserBody,
  RequestPasswordResetBody,
  ResetPasswordBody,
  ChangePasswordBody,
} from "@workspace/api-zod";
import { randomUUID, randomBytes } from "crypto";
import {
  generateToken,
  verifyToken,
  hashToken,
  hashPassword,
  verifyPassword,
  isLegacyPasswordHash,
} from "../lib/auth-security.js";

import { requireAuth } from "../middlewares/auth.js";
import { z } from "zod";

// Founders who do not practice as a doctor register with practicesAsDoctor=false: role "manager",
// no specialty. Omitted or true keeps the existing physician founder behavior.
const RegisterBody = RegisterUserBody.extend({
  specialty: z.string().optional(),
  practicesAsDoctor: z.boolean().optional(),
});

const router = Router();

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;


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
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const { password, clinicName, ownerName, specialty, whatsappNumber, practicesAsDoctor } = parsed.data;
  const isPhysician = practicesAsDoctor !== false;
  if (isPhysician && (!specialty || specialty.trim().length < 2)) {
    return res.status(400).json({ error: "Invalid input", details: [{ path: ["specialty"], message: "Medical specialty is required for a practicing doctor" }] });
  }
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
    passwordHash: await hashPassword(password),
    name: ownerName,
    specialty: isPhysician ? specialty!.trim() : null,
    whatsappNumber: whatsappNumber.trim(),
    role: isPhysician ? "doctor" : "manager",
    clinicId,
    isBlocked: false,
    emailVerifiedAt: now,
  });

  const user = {
    id: userId,
    email,
    role: isPhysician ? "doctor" : "manager",
    clinicId: clinicId,
    name: ownerName,
    specialty: isPhysician ? specialty!.trim() : null,
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

  return res.status(201).json({
    message:
      "Account created. Your request is pending approval — please contact support via WhatsApp to activate your 15-day free trial.",
    user,
    clinic,
    token: generateToken(userId),
  });
});

// Temporary containment: previously returned verification tokens were public.
// Reject all of them, including outstanding links, without reading or changing DB rows.
const verificationUnavailable = (_req: Request, res: import("express").Response) =>
  res.status(503).json({
    error: "Email verification is temporarily unavailable. No email or verification link has been sent.",
    code: "EMAIL_VERIFICATION_UNAVAILABLE",
  });
router.post("/verify-email", verificationUnavailable);
router.post("/resend-verification", verificationUnavailable);

router.post("/login", async (req, res) => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { password } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  const user = users[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    if (user) await recordAuthEvent(req, user.id, "login_failed");
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (isLegacyPasswordHash(user.passwordHash)) {
    // Transparently upgrade pre-hardening SHA-256 password hashes to scrypt.
    try {
      await db
        .update(usersTable)
        .set({ passwordHash: await hashPassword(password) })
        .where(eq(usersTable.id, user.id));
    } catch {
      // The upgrade is best-effort; a failed rewrite must not block the login.
    }
  }

  if (user.isBlocked) {
    await recordAuthEvent(req, user.id, "login_failed");
    return res.status(403).json({ error: "Account is blocked" });
  }

  if (!user.emailVerifiedAt) {
    await recordAuthEvent(req, user.id, "login_failed");
    return res.status(403).json({
      error: "Email verification is temporarily unavailable. This unverified account cannot sign in. No email has been sent.",
      code: "email_not_verified",
      email: user.email,
    });
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
    return res.status(404).json({ error: "Clinic not found" });
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

  // The response is identical whether or not the email is registered, and it
  // never contains the reset token or link. Returning them here let anyone
  // take over an account knowing only its email address. Reset links are
  // delivered out of band: a superadmin can generate one for the user through
  // POST /api/admin/password-reset-link and share it via the clinic's
  // registered WhatsApp contact.
  const genericResponse = {
    message:
      "If that email is registered, a password reset link can be provided by the support team.",
    resetToken: null,
    resetUrl: null,
    expiresAt: null,
  };

  if (!user) {
    return res.json(genericResponse);
  }

  const plainToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await db.insert(passwordResetTokensTable).values({
    id: randomUUID(),
    userId: user.id,
    tokenHash: hashToken(plainToken),
    expiresAt,
  });

  return res.json(genericResponse);
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

  await db.update(usersTable).set({ passwordHash: await hashPassword(password) }).where(eq(usersTable.id, record.userId));
  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokensTable.id, record.id));

  await recordAuthEvent(req, record.userId, "password_reset");
  return res.json({ message: "Password updated successfully. You can now sign in." });
});

router.post("/change-password", requireAuth, async (req, res) => {
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

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  await db.update(usersTable).set({ passwordHash: await hashPassword(newPassword) }).where(eq(usersTable.id, userId));

  await recordAuthEvent(req, userId, "password_changed");
  return res.json({ message: "Password changed successfully." });
});

router.get("/events", requireAuth, async (req, res) => {
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
  return verifyToken(authHeader.slice("Bearer ".length));
}

router.get("/me", requireAuth, async (req, res) => {
  const userId = userIdFromAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const user = users[0];
  if (!user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  return res.json({ id: user.id, email: user.email, role: user.role, clinicId: user.clinicId, name: user.name, specialty: user.specialty, whatsappNumber: user.whatsappNumber, isBlocked: user.isBlocked, emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null });
});

router.patch("/me", requireAuth, async (req, res) => {
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
