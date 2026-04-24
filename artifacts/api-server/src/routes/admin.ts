import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, clinicsTable, subscriptionsTable } from "@workspace/db";

const router = Router();

router.get("/clinics", async (_req, res) => {
  const clinics = await db.select().from(clinicsTable);
  return res.json(clinics.map(c => ({
    id: c.id, name: c.name, ownerId: c.ownerId, status: c.status,
    subscriptionStatus: c.subscriptionStatus, trialEndDate: c.trialEndDate.toISOString(),
    subscriptionPlan: c.subscriptionPlan, createdAt: c.createdAt.toISOString(),
  })));
});

router.post("/clinics/:clinicId/activate", async (req, res) => {
  const { clinicId } = req.params;
  await db.update(clinicsTable).set({ status: "active" }).where(eq(clinicsTable.id, clinicId));
  const clinic = (await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1))[0];
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });
  return res.json({
    id: clinic.id, name: clinic.name, ownerId: clinic.ownerId, status: clinic.status,
    subscriptionStatus: clinic.subscriptionStatus, trialEndDate: clinic.trialEndDate.toISOString(),
    subscriptionPlan: clinic.subscriptionPlan, createdAt: clinic.createdAt.toISOString(),
  });
});

router.post("/clinics/:clinicId/block", async (req, res) => {
  const { clinicId } = req.params;
  await db.update(clinicsTable).set({ status: "blocked" }).where(eq(clinicsTable.id, clinicId));
  const clinic = (await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1))[0];
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });
  return res.json({
    id: clinic.id, name: clinic.name, ownerId: clinic.ownerId, status: clinic.status,
    subscriptionStatus: clinic.subscriptionStatus, trialEndDate: clinic.trialEndDate.toISOString(),
    subscriptionPlan: clinic.subscriptionPlan, createdAt: clinic.createdAt.toISOString(),
  });
});

router.post("/subscriptions/:clinicId/confirm", async (req, res) => {
  const { clinicId } = req.params;
  const sub = (await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.clinicId, clinicId)).limit(1))[0];
  if (!sub) return res.status(404).json({ error: "Subscription not found" });

  await db.update(subscriptionsTable).set({ paymentStatus: "confirmed" }).where(eq(subscriptionsTable.id, sub.id));
  await db.update(clinicsTable).set({ subscriptionStatus: sub.planType as "basic" | "premium", status: "active" }).where(eq(clinicsTable.id, clinicId));

  const updated = (await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, sub.id)).limit(1))[0];
  return res.json({
    id: updated.id, clinicId: updated.clinicId, planType: updated.planType,
    startDate: updated.startDate.toISOString(), endDate: updated.endDate.toISOString(),
    paymentStatus: updated.paymentStatus, amount: parseFloat(updated.amount ?? "0"),
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
