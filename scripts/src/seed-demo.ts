import { createHash, randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, clinicsTable } from "@workspace/db";

function hashPassword(password: string): string {
  return createHash("sha256").update(password + "clinicsquad_salt").digest("hex");
}

async function ensureAdmin() {
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, "admin@demo.com")).limit(1);
  if (existing.length > 0) {
    console.log("admin@demo.com already exists, skipping");
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
    email: "admin@demo.com",
    passwordHash: hashPassword("demo1234"),
    name: "Demo Admin",
    role: "admin",
    clinicId,
    isBlocked: false,
    emailVerifiedAt: new Date(),
  });
  console.log("Created admin@demo.com / demo1234");
}

async function ensureSuperAdmin() {
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, "super@clinicsquad.com")).limit(1);
  if (existing.length > 0) {
    console.log("super@clinicsquad.com already exists, skipping");
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
    email: "super@clinicsquad.com",
    passwordHash: hashPassword("super1234"),
    name: "Super Admin",
    role: "superadmin",
    clinicId,
    isBlocked: false,
    emailVerifiedAt: new Date(),
  });
  console.log("Created super@clinicsquad.com / super1234");
}

async function main() {
  await ensureAdmin();
  await ensureSuperAdmin();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
