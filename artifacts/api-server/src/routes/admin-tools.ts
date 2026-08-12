import { Router } from "express";
import { and, desc, eq, gte, isNull, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  db,
  systemSettingsTable,
  auditLogsTable,
  systemMessagesTable,
  promoCodesTable,
  clinicsTable,
  usersTable,
  patientsTable,
  appointmentsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

function actor(req: any) {
  return req.authUser ?? { id: "system", email: "system", name: "System", role: "superadmin" };
}

async function writeAudit(req: any, action: string, details: string) {
  const user = actor(req);
  await db.insert(auditLogsTable).values({
    id: randomUUID(),
    adminId: user.id,
    adminEmail: user.email,
    action,
    details,
  });
}

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

// Clinic users can read active broadcasts and available promo codes.
router.get("/messages", requireAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(systemMessagesTable)
    .where(eq(systemMessagesTable.active, true))
    .orderBy(desc(systemMessagesTable.createdAt));
  return res.json(rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })));
});

router.get("/settings", requireAuth, async (_req, res) => {
  let settings = (await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.id, "global")).limit(1))[0];
  if (!settings) settings = (await db.insert(systemSettingsTable).values({ id: "global" }).returning())[0];
  return res.json({ ...settings, updatedAt: settings.updatedAt.toISOString() });
});

router.get("/promo-codes", requireAuth, async (_req, res) => {
  const now = new Date();
  const rows = await db
    .select()
    .from(promoCodesTable)
    .where(and(eq(promoCodesTable.active, true), or(isNull(promoCodesTable.expiresAt), gte(promoCodesTable.expiresAt, now))))
    .orderBy(desc(promoCodesTable.createdAt));
  return res.json(rows
    .filter((row) => !row.expiresAt || row.expiresAt > now)
    .map((row) => ({ ...row, expiresAt: row.expiresAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() })));
});

router.use(requireAuth, requireRole("superadmin"));

router.put("/settings", async (req, res) => {
  const body = req.body ?? {};
  const current = (await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.id, "global")).limit(1))[0];
  const values = {
    basicMonthlyPrice: cleanText(body.basicMonthlyPrice, current?.basicMonthlyPrice ?? "200"),
    premiumMonthlyPrice: cleanText(body.premiumMonthlyPrice, current?.premiumMonthlyPrice ?? "400"),
    vodafoneCashNumber: cleanText(body.vodafoneCashNumber, current?.vodafoneCashNumber ?? "01000000000"),
    instapayHandle: cleanText(body.instapayHandle, current?.instapayHandle ?? "clinicsquad@instapay"),
    whatsappNumber: cleanText(body.whatsappNumber, current?.whatsappNumber ?? "201000000000"),
    updatedAt: new Date(),
  };
  const settings = current
    ? (await db.update(systemSettingsTable).set(values).where(eq(systemSettingsTable.id, "global")).returning())[0]
    : (await db.insert(systemSettingsTable).values({ id: "global", ...values }).returning())[0];
  await writeAudit(req, "UPDATE_GLOBAL_SETTINGS", "Updated pricing and payment contact settings");
  return res.json({ ...settings, updatedAt: settings.updatedAt.toISOString() });
});

router.get("/audit-logs", async (_req, res) => {
  const rows = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(100);
  return res.json(rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })));
});

router.get("/engagement", async (_req, res) => {
  const [clinics, patients, appointments] = await Promise.all([
    db.select().from(clinicsTable),
    db.select({ clinicId: patientsTable.clinicId }).from(patientsTable),
    db.select({ clinicId: appointmentsTable.clinicId, createdAt: appointmentsTable.createdAt }).from(appointmentsTable),
  ]);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const patientCounts = new Map<string, number>();
  const recentAppointmentCounts = new Map<string, number>();
  for (const row of patients) patientCounts.set(row.clinicId, (patientCounts.get(row.clinicId) ?? 0) + 1);
  for (const row of appointments) {
    if (row.createdAt >= since) recentAppointmentCounts.set(row.clinicId, (recentAppointmentCounts.get(row.clinicId) ?? 0) + 1);
  }
  return res.json(clinics.map((clinic) => {
    const patientCount = patientCounts.get(clinic.id) ?? 0;
    const recentAppointments = recentAppointmentCounts.get(clinic.id) ?? 0;
    const score = Math.min(100, patientCount * 2 + recentAppointments * 10);
    return { clinicId: clinic.id, clinicName: clinic.name, subscriptionStatus: clinic.subscriptionStatus, patientCount, recentAppointments, engagementScore: score };
  }).sort((a, b) => b.engagementScore - a.engagementScore));
});

router.post("/messages", async (req, res) => {
  const title = cleanText(req.body?.title);
  const message = cleanText(req.body?.message);
  if (!title || !message) return res.status(400).json({ error: "Title and message are required" });
  const row = (await db.insert(systemMessagesTable).values({ id: randomUUID(), title, message, active: true }).returning())[0];
  await writeAudit(req, "CREATE_BROADCAST", `Created broadcast: ${title}`);
  return res.status(201).json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.patch("/messages/:id", async (req, res) => {
  const active = Boolean(req.body?.active);
  const row = (await db.update(systemMessagesTable).set({ active }).where(eq(systemMessagesTable.id, req.params.id)).returning())[0];
  if (!row) return res.status(404).json({ error: "Message not found" });
  await writeAudit(req, active ? "ACTIVATE_BROADCAST" : "ARCHIVE_BROADCAST", `Updated broadcast: ${row.title}`);
  return res.json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.post("/promo-codes", async (req, res) => {
  const code = cleanText(req.body?.code).toUpperCase();
  const discountPercent = Number(req.body?.discountPercent);
  if (!code || !Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 100) {
    return res.status(400).json({ error: "A code and a discount from 1 to 100 are required" });
  }
  const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return res.status(400).json({ error: "Invalid expiry date" });
  try {
    const row = (await db.insert(promoCodesTable).values({ id: randomUUID(), code, discountPercent, expiresAt, active: true }).returning())[0];
    await writeAudit(req, "CREATE_PROMO_CODE", `Created ${code} (${discountPercent}% discount)`);
    return res.status(201).json({ ...row, expiresAt: row.expiresAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() });
  } catch {
    return res.status(409).json({ error: "Promo code already exists" });
  }
});

router.patch("/promo-codes/:id", async (req, res) => {
  const active = Boolean(req.body?.active);
  const row = (await db.update(promoCodesTable).set({ active }).where(eq(promoCodesTable.id, req.params.id)).returning())[0];
  if (!row) return res.status(404).json({ error: "Promo code not found" });
  await writeAudit(req, active ? "ACTIVATE_PROMO_CODE" : "DISABLE_PROMO_CODE", `Updated promo code: ${row.code}`);
  return res.json({ ...row, expiresAt: row.expiresAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() });
});

router.post("/clinics/:clinicId/extend-trial", async (req, res) => {
  const days = Number(req.body?.days);
  if (!Number.isInteger(days) || days < 1 || days > 90) return res.status(400).json({ error: "Days must be between 1 and 90" });
  const clinic = (await db.select().from(clinicsTable).where(eq(clinicsTable.id, req.params.clinicId)).limit(1))[0];
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });
  const base = clinic.trialEndDate > new Date() ? clinic.trialEndDate : new Date();
  const trialEndDate = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  const updated = (await db.update(clinicsTable).set({ trialEndDate, subscriptionStatus: "trial" }).where(eq(clinicsTable.id, clinic.id)).returning())[0];
  await writeAudit(req, "EXTEND_TRIAL", `Extended trial for ${clinic.name} by ${days} days`);
  return res.json({ id: updated.id, trialEndDate: updated.trialEndDate.toISOString(), subscriptionStatus: updated.subscriptionStatus });
});

export default router;
