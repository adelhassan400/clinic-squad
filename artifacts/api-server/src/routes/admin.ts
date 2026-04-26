import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  clinicsTable,
  subscriptionsTable,
  usersTable,
  patientsTable,
  appointmentsTable,
} from "@workspace/db";

const router = Router();

router.get("/clinics", async (_req, res) => {
  const clinics = await db.select().from(clinicsTable);
  return res.json(clinics.map(c => ({
    id: c.id, name: c.name, ownerId: c.ownerId, status: c.status,
    subscriptionStatus: c.subscriptionStatus, trialEndDate: c.trialEndDate.toISOString(),
    subscriptionPlan: c.subscriptionPlan, createdAt: c.createdAt.toISOString(),
  })));
});

router.get("/stats", async (_req, res) => {
  const [clinics, users, subs, patients] = await Promise.all([
    db.select().from(clinicsTable),
    db.select().from(usersTable),
    db.select().from(subscriptionsTable),
    db.select().from(patientsTable),
  ]);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const byStatus: Record<string, number> = { pending: 0, active: 0, blocked: 0, deleted: 0 };
  const bySub: Record<string, number> = { trial: 0, basic: 0, premium: 0, expired: 0 };
  let trialEndingSoon = 0;
  let newSignupsWeek = 0;

  for (const c of clinics) {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    bySub[c.subscriptionStatus] = (bySub[c.subscriptionStatus] ?? 0) + 1;
    if (c.subscriptionStatus === "trial" && c.trialEndDate <= threeDaysFromNow && c.trialEndDate >= now) {
      trialEndingSoon += 1;
    }
    if (c.createdAt >= sevenDaysAgo) newSignupsWeek += 1;
  }

  const pendingPayments = subs.filter(s => s.paymentStatus === "pending").length;
  const confirmedRevenue = subs
    .filter(s => s.paymentStatus === "confirmed")
    .reduce((sum, s) => sum + parseFloat(s.amount ?? "0"), 0);

  return res.json({
    totalClinics: clinics.length,
    totalUsers: users.length,
    totalPatients: patients.length,
    byStatus, bySub,
    trialEndingSoon,
    newSignupsWeek,
    pendingPayments,
    confirmedRevenue,
  });
});

router.get("/subscriptions", async (req, res) => {
  const status = req.query.status as string | undefined;

  const rows = await db
    .select({
      id: subscriptionsTable.id,
      clinicId: subscriptionsTable.clinicId,
      planType: subscriptionsTable.planType,
      startDate: subscriptionsTable.startDate,
      endDate: subscriptionsTable.endDate,
      paymentStatus: subscriptionsTable.paymentStatus,
      amount: subscriptionsTable.amount,
      createdAt: subscriptionsTable.createdAt,
      clinicName: clinicsTable.name,
    })
    .from(subscriptionsTable)
    .leftJoin(clinicsTable, eq(subscriptionsTable.clinicId, clinicsTable.id))
    .orderBy(desc(subscriptionsTable.createdAt));

  const filtered = status ? rows.filter(r => r.paymentStatus === status) : rows;

  return res.json(filtered.map(r => ({
    id: r.id,
    clinicId: r.clinicId,
    clinicName: r.clinicName ?? "(deleted)",
    planType: r.planType,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    paymentStatus: r.paymentStatus,
    amount: parseFloat(r.amount ?? "0"),
    createdAt: r.createdAt.toISOString(),
  })));
});

router.get("/clinics/:clinicId/detail", async (req, res) => {
  const { clinicId } = req.params;

  const clinic = (
    await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1)
  )[0];
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });

  const [members, patients, appointments, subscriptions] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.clinicId, clinicId)),
    db.select().from(patientsTable).where(eq(patientsTable.clinicId, clinicId)),
    db.select().from(appointmentsTable).where(eq(appointmentsTable.clinicId, clinicId)),
    db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.clinicId, clinicId))
      .orderBy(desc(subscriptionsTable.createdAt)),
  ]);

  const owner = members.find((m) => m.id === clinic.ownerId) ?? null;
  const membersByRole: Record<string, number> = {};
  for (const m of members) {
    membersByRole[m.role] = (membersByRole[m.role] ?? 0) + 1;
  }

  const confirmed = subscriptions.filter((s) => s.paymentStatus === "confirmed");
  const totalRevenue = confirmed.reduce((sum, s) => sum + parseFloat(s.amount ?? "0"), 0);
  const lastConfirmedPayment = confirmed[0]?.createdAt?.toISOString() ?? null;
  const pendingPayment = subscriptions.find((s) => s.paymentStatus === "pending") ?? null;

  return res.json({
    clinic: {
      id: clinic.id,
      name: clinic.name,
      ownerId: clinic.ownerId,
      status: clinic.status,
      subscriptionStatus: clinic.subscriptionStatus,
      subscriptionPlan: clinic.subscriptionPlan,
      trialEndDate: clinic.trialEndDate.toISOString(),
      createdAt: clinic.createdAt.toISOString(),
    },
    owner: owner
      ? {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          role: owner.role,
          specialty: owner.specialty ?? null,
          phone: owner.phone ?? null,
          isBlocked: owner.isBlocked,
          createdAt: owner.createdAt.toISOString(),
        }
      : null,
    counts: {
      members: members.length,
      patients: patients.length,
      appointments: appointments.length,
      membersByRole,
    },
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      isBlocked: m.isBlocked,
      createdAt: m.createdAt.toISOString(),
    })),
    subscriptions: subscriptions.map((s) => ({
      id: s.id,
      planType: s.planType,
      paymentStatus: s.paymentStatus,
      amount: parseFloat(s.amount ?? "0"),
      startDate: s.startDate.toISOString(),
      endDate: s.endDate.toISOString(),
      createdAt: s.createdAt.toISOString(),
    })),
    revenue: {
      totalConfirmed: totalRevenue,
      lastConfirmedPayment,
      pendingPaymentId: pendingPayment?.id ?? null,
    },
  });
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
