import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, clinicsTable, usersTable } from "@workspace/db";
import { verifyToken } from "../lib/auth-security.js";
import { isPreActivationClinicStatus } from "../lib/access-policy.js";

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  clinicId: string;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthedUser;
    }
  }
}

async function resolveUser(req: Request, res: Response): Promise<AuthedUser | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const userId = verifyToken(header.slice("Bearer ".length));
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
  if (user.isBlocked) {
    res.status(403).json({ error: "Account deactivated" });
    return null;
  }
  // Check stored state on every request, including sessions issued before containment.
  if (!user.emailVerifiedAt) {
    res.status(403).json({
      error: "Email verification is temporarily unavailable. This unverified account cannot sign in.",
      code: "email_not_verified",
    });
    return null;
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
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
  const user = await resolveUser(req, res);
  if (!user) return;
  req.authUser = user;

  const { clinicId } = req.params as { clinicId?: string };
  if (clinicId && user.clinicId !== clinicId && user.role !== "superadmin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (user.role !== "superadmin") {
    const clinic = (await db.select({ status: clinicsTable.status }).from(clinicsTable).where(eq(clinicsTable.id, user.clinicId)).limit(1))[0];
    if (clinic?.status === "blocked" || clinic?.status === "deactivated") {
      res.status(403).json({ error: "Clinic access is deactivated", code: "CLINIC_DEACTIVATED" });
      return;
    }
    // Clinics awaiting activation may not use clinic data until an admin activates them.
    if (isPreActivationClinicStatus(clinic?.status)) {
      res.status(403).json({ error: "Clinic is awaiting activation", code: "CLINIC_PENDING" });
      return;
    }
  }
  next();
}

/**
 * For routers that only use requireAuth: blocks clinic data access while the
 * user's clinic is awaiting activation (superadmins bypass). Does not touch
 * subscription or expiry handling.
 */
export async function requireActiveClinic(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (user.role !== "superadmin") {
    const clinic = (await db.select({ status: clinicsTable.status }).from(clinicsTable).where(eq(clinicsTable.id, user.clinicId)).limit(1))[0];
    if (isPreActivationClinicStatus(clinic?.status)) {
      res.status(403).json({ error: "Clinic is awaiting activation", code: "CLINIC_PENDING" });
      return;
    }
  }
  next();
}

// Finance data: admin and superadmin, or the clinic's founding owner (authoritative owner_id).
export async function requireFinanceAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (user.role === "superadmin" || user.role === "admin") {
    next();
    return;
  }
  const clinic = (await db.select({ ownerId: clinicsTable.ownerId }).from(clinicsTable).where(eq(clinicsTable.id, user.clinicId)).limit(1))[0];
  if (clinic && clinic.ownerId === user.id) {
    next();
    return;
  }
  res.status(403).json({ error: "Forbidden" });
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
