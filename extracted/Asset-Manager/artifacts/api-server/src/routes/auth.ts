import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, clinicsTable } from "@workspace/db";
import { RegisterUserBody, LoginUserBody } from "@workspace/api-zod";
import { randomUUID } from "crypto";
import { createHash } from "crypto";

const router = Router();

function hashPassword(password: string): string {
  return createHash("sha256").update(password + "clinicsquad_salt").digest("hex");
}

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

router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.replace("Bearer ", "");
  const decoded = Buffer.from(token, "base64").toString();
  const userId = decoded.split(":")[0];

  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const user = users[0];
  if (!user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  return res.json({ id: user.id, email: user.email, role: user.role, clinicId: user.clinicId, name: user.name, isBlocked: user.isBlocked });
});

export default router;
