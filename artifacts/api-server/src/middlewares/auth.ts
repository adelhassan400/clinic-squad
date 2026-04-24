import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

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

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = decodeToken(header.slice("Bearer ".length));
  if (!userId) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const rows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const user = rows[0];
  if (!user) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  if (user.isBlocked) {
    res.status(403).json({ error: "Account blocked" });
    return;
  }

  req.authUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    clinicId: user.clinicId,
  };
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
      return 10;
    case "basic":
    case "trial":
      return 2;
    default:
      return 0;
  }
}
