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

router.get("/stats", async (req, res) => {
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
  const confirmedSubs = subs.filter(s => s.paymentStatus === "confirmed");
  const confirmedRevenue = confirmedSubs.reduce(
    (sum, s) => sum + parseFloat(s.amount ?? "0"),
    0,
  );

  // Determine which months to bucket: rolling 12 (default) or a specific year.
  const yearParam = typeof req.query.year === "string" ? Number(req.query.year) : NaN;
  const isSpecificYear = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100;

  const months: { key: string; year: number; month: number }[] = [];
  if (isSpecificYear) {
    for (let m = 0; m < 12; m += 1) {
      const d = new Date(Date.UTC(yearParam, m, 1));
      months.push({
        key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
      });
    }
  } else {
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      months.push({
        key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
      });
    }
  }

  const monthBuckets = new Map<string, { amount: number; count: number }>();
  for (const m of months) monthBuckets.set(m.key, { amount: 0, count: 0 });

  // Always compute current-month total (regardless of selected year).
  const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  let currentMonthRevenue = 0;

  // Track years that have any confirmed payment so the UI can populate a year selector.
  const availableYears = new Set<number>();

  for (const s of confirmedSubs) {
    const d = s.createdAt;
    const amount = parseFloat(s.amount ?? "0");
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    availableYears.add(d.getUTCFullYear());
    if (key === currentMonthKey) currentMonthRevenue += amount;
    const bucket = monthBuckets.get(key);
    if (bucket) {
      bucket.amount += amount;
      bucket.count += 1;
    }
  }

  // Always include the current year so the user can switch to it even with no payments yet.
  availableYears.add(now.getUTCFullYear());

  const revenueByMonth = months.map((m) => ({
    month: m.key,
    amount: monthBuckets.get(m.key)!.amount,
    count: monthBuckets.get(m.key)!.count,
  }));

  return res.json({
    totalClinics: clinics.length,
    totalUsers: users.length,
    totalPatients: patients.length,
    byStatus, bySub,
    trialEndingSoon,
    newSignupsWeek,
    pendingPayments,
    confirmedRevenue,
    currentMonthRevenue,
    revenueByMonth,
    revenueRange: isSpecificYear
      ? { mode: "year" as const, year: yearParam }
      : { mode: "rolling12" as const },
    availableYears: Array.from(availableYears).sort((a, b) => b - a),
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

router.get("/pending-clinics", async (_req, res) => {
  const rows = await db
    .select({
      clinicId: clinicsTable.id,
      clinicName: clinicsTable.name,
      ownerId: clinicsTable.ownerId,
      createdAt: clinicsTable.createdAt,
      trialEndDate: clinicsTable.trialEndDate,
      ownerName: usersTable.name,
      ownerEmail: usersTable.email,
      specialty: usersTable.specialty,
      whatsappNumber: usersTable.whatsappNumber,
    })
    .from(clinicsTable)
    .leftJoin(usersTable, eq(usersTable.id, clinicsTable.ownerId))
    .where(eq(clinicsTable.status, "pending_approval"))
    .orderBy(desc(clinicsTable.createdAt));

  return res.json(
    rows.map((r) => ({
      clinicId: r.clinicId,
      clinicName: r.clinicName,
      ownerId: r.ownerId,
      ownerName: r.ownerName ?? "",
      ownerEmail: r.ownerEmail ?? "",
      specialty: r.specialty,
      whatsappNumber: r.whatsappNumber,
      createdAt: r.createdAt.toISOString(),
      trialEndDate: r.trialEndDate.toISOString(),
    })),
  );
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
