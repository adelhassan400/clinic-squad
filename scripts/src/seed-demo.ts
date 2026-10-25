import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, clinicsTable } from "@workspace/db";
import { hashPassword } from "../../lib/auth-password.mjs";

const ADMIN_EMAIL = "admin@demo.com";
const SUPERADMIN_EMAIL = "super@clinicsquad.com";

async function ensureAdmin(password: string) {
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, ADMIN_EMAIL)).limit(1);
  if (existing.length > 0) {
    console.log(`${ADMIN_EMAIL} already exists, skipping`);
    return;
  }
  const clinicId = randomUUID();
  const userId = randomUUID();
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 15);

  await db.insert(clinicsTable).values({
    id: clinicId,
    name: "Demo Clinic",
    ownerId: userId,
    status: "active",
    subscriptionStatus: "trial",
    trialEndDate,
    subscriptionPlan: null,
  });
  await db.insert(usersTable).values({
    id: userId,
    email: ADMIN_EMAIL,
    passwordHash: await hashPassword(password),
    name: "Demo Admin",
    role: "admin",
    clinicId,
    isBlocked: false,
    emailVerifiedAt: new Date(),
  });
  console.log(`Created ${ADMIN_EMAIL}`);
}

async function ensureSuperAdmin(password: string) {
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, SUPERADMIN_EMAIL)).limit(1);
  if (existing.length > 0) {
    console.log(`${SUPERADMIN_EMAIL} already exists, skipping`);
    return;
  }
  const clinicId = randomUUID();
  const userId = randomUUID();
  const trialEndDate = new Date();
  trialEndDate.setFullYear(trialEndDate.getFullYear() + 100);

  await db.insert(clinicsTable).values({
    id: clinicId,
    name: "ClinicSquad HQ",
    ownerId: userId,
    status: "active",
    subscriptionStatus: "active",
    trialEndDate,
    subscriptionPlan: "premium",
  });
  await db.insert(usersTable).values({
    id: userId,
    email: SUPERADMIN_EMAIL,
    passwordHash: await hashPassword(password),
    name: "Super Admin",
    role: "superadmin",
    clinicId,
    isBlocked: false,
    emailVerifiedAt: new Date(),
  });
  console.log(`Created ${SUPERADMIN_EMAIL}`);
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_ENVIRONMENT === "production") {
    console.info("Demo account seeding skipped in production.");
    return;
  }

  const adminPassword = process.env.DEMO_ADMIN_PASSWORD?.trim();
  const superAdminPassword = process.env.DEMO_SUPERADMIN_PASSWORD?.trim();
  if (!adminPassword || !superAdminPassword) {
    console.info("Demo account seeding skipped; set both demo password secrets to enable it.");
    return;
  }

  await ensureAdmin(adminPassword);
  await ensureSuperAdmin(superAdminPassword);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Demo seeding failed:", err);
    process.exit(1);
  });
