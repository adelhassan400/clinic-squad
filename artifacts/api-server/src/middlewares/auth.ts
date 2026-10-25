import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, clinicsTable, usersTable } from "@workspace/db";

export const USER_ROLES = [
  "admin",
  "doctor",
  "assistant",
  "secretary",
  "nurse",
  "superadmin",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CLINIC_MANAGER_ROLES = ["admin", "doctor", "superadmin"] as const;
export const CLINIC_MEMBER_ROLES = USER_ROLES;

const ACCESS_TOKEN_TTL_SECONDS = 12 * 60 * 60;

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clinicId: string;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthedUser;
    }
  }
}

function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

export function createAuthToken(userId: string): string {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, iat: issuedAt, exp: issuedAt + ACCESS_TOKEN_TTL_SECONDS }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(`cs1.${payload}`).digest("base64url");
  return `cs1.${payload}.${signature}`;
}

export function verifyAuthToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "cs1") return null;
    const [, payload, encodedSignature] = parts;
    if (!payload || !encodedSignature) return null;

    const secret = sessionSecret();
    if (!secret) return null;
    const expected = createHmac("sha256", secret).update(`cs1.${payload}`).digest();
    const actual = Buffer.from(encodedSignature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: unknown;
      iat?: unknown;
      exp?: unknown;
    };
    const now = Math.floor(Date.now() / 1000);
    if (
      typeof decoded.sub !== "string" ||
      decoded.sub.length === 0 ||
      typeof decoded.iat !== "number" ||
      typeof decoded.exp !== "number" ||
      !Number.isInteger(decoded.iat) ||
      !Number.isInteger(decoded.exp) ||
      decoded.iat > now + 60 ||
      decoded.exp <= now ||
      decoded.exp <= decoded.iat ||
      decoded.exp - decoded.iat > ACCESS_TOKEN_TTL_SECONDS
    ) {
      return null;
    }
    return decoded.sub;
  } catch {
    return null;
  }
}

async function resolveUser(req: Request, res: Response): Promise<AuthedUser | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const userId = verifyAuthToken(header.slice("Bearer ".length));
  if (!userId) {
    res.status(401).json({ error: "Invalid token" });
    return null;
  }
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const user = rows[0];
  if (!user) {
    res.status(401).json({ error: "Invalid token" });
    return null;
  }
  if (!USER_ROLES.includes(user.role as UserRole)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  if (user.isBlocked) {
    res.status(403).json({ error: "Account deactivated" });
    return null;
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
    clinicId: user.clinicId,
  };
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = await resolveUser(req, res);
  if (!user) return;
  req.authUser = user;
  next();
}

/**
 * Requires a valid Bearer token AND that the authenticated user belongs to
 * the clinic referenced in req.params.clinicId (superadmins bypass the
 * ownership check so they can manage all clinics).
 */
export async function requireClinicAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = req.authUser ?? await resolveUser(req, res);
  if (!user) return;
  req.authUser = user;

  const { clinicId } = req.params as { clinicId?: string };
  if (clinicId && user.clinicId !== clinicId && user.role !== "superadmin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (user.role !== "superadmin") {
    const targetClinicId = clinicId ?? user.clinicId;
    if (!targetClinicId || targetClinicId !== user.clinicId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const clinic = (await db.select({ status: clinicsTable.status }).from(clinicsTable).where(eq(clinicsTable.id, targetClinicId)).limit(1))[0];
    if (!clinic || clinic.status !== "active") {
      res.status(403).json({ error: "Clinic access is unavailable", code: "CLINIC_UNAVAILABLE" });
      return;
    }
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function getMemberLimit(subscriptionStatus: string): number {
  switch (subscriptionStatus) {
    case "premium":
    case "trial":
      return 10;
    case "basic":
      return 2;
    default:
      return 0;
  }
}
