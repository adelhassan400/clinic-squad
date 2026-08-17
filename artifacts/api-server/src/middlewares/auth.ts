import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, clinicsTable, usersTable } from "@workspace/db";

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

function decodeToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64").toString();
    const userId = decoded.split(":")[0];
    return userId || null;
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
  const userId = decodeToken(header.slice("Bearer ".length));
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
