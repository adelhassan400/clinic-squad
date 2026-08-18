import { Router } from "express";
import { randomUUID } from "crypto";
import { eq, desc, inArray, or } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  db,
  clinicsTable,
  subscriptionsTable,
  usersTable,
  patientsTable,
  appointmentsTable,
  auditLogsTable,
} from "@workspace/db";

const router = Router();

function asDate(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

router.use(requireAuth, requireRole("superadmin"));

router.get("/clinics", async (_req, res) => {
  const [clinics, confirmedSubscriptions] = await Promise.all([
    db
      .select({
        id: clinicsTable.id,
        requestNumber: clinicsTable.requestNumber,
        name: clinicsTable.name,
        phone: clinicsTable.phone,
        address: clinicsTable.address,
        ownerId: clinicsTable.ownerId,
        ownerEmail: usersTable.email,
        status: clinicsTable.status,
        subscriptionStatus: clinicsTable.subscriptionStatus,
        trialEndDate: clinicsTable.trialEndDate,
        subscriptionPlan: clinicsTable.subscriptionPlan,
        createdAt: clinicsTable.createdAt,
      })
      .from(clinicsTable)
      .leftJoin(usersTable, eq(usersTable.id, clinicsTable.ownerId)),
    db.select().from(subscriptionsTable).where(eq(subscriptionsTable.paymentStatus, "confirmed")),
  ]);

  const latestSubscriptionByClinic = new Map<string, (typeof confirmedSubscriptions)[number]>();
  for (const subscription of confirmedSubscriptions) {
    const current = latestSubscriptionByClinic.get(subscription.clinicId);
    if (!current || asDate(subscription.createdAt) > asDate(current.createdAt)) {
      latestSubscriptionByClinic.set(subscription.clinicId, subscription);
    }
  }

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  return res.json(clinics.map((clinic) => {
    const latestSubscription = latestSubscriptionByClinic.get(clinic.id);
    const rawAccessEndDate = clinic.subscriptionStatus === "trial"
      ? clinic.trialEndDate
      : latestSubscription?.endDate ?? clinic.trialEndDate;
    const accessEndDate = rawAccessEndDate ? asDate(rawAccessEndDate) : null;
    const millisecondsUntilExpiry = accessEndDate ? accessEndDate.getTime() - now.getTime() : 0;
    const expiringSoon = Boolean(accessEndDate && accessEndDate > now && accessEndDate <= threeDaysFromNow);

    return {
      id: clinic.id,
      requestNumber: clinic.requestNumber ?? null,
      name: clinic.name,
      phone: clinic.phone ?? null,
      address: clinic.address ?? null,
      ownerId: clinic.ownerId,
      ownerEmail: clinic.ownerEmail ?? null,
      status: clinic.status,
      subscriptionStatus: clinic.subscriptionStatus,
      trialEndDate: clinic.trialEndDate ? asDate(clinic.trialEndDate).toISOString() : null,
      accessEndDate: accessEndDate?.toISOString() ?? null,
      expiryType: clinic.subscriptionStatus === "trial" ? "trial" : latestSubscription ? "subscription" : null,
      expiringSoon,
      daysUntilExpiry: accessEndDate ? Math.max(0, Math.ceil(millisecondsUntilExpiry / (24 * 60 * 60 * 1000))) : null,
      subscriptionPlan: clinic.subscriptionPlan,
      createdAt: clinic.createdAt.toISOString(),
    };
  }));
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
    const trialEndDate = asDate(c.trialEndDate);
    const createdAt = asDate(c.createdAt);
    if (c.subscriptionStatus === "trial" && trialEndDate <= threeDaysFromNow && trialEndDate >= now) {
      trialEndingSoon += 1;
    }
    if (createdAt >= sevenDaysAgo) newSignupsWeek += 1;
  }

  const pendingPayments = subs.filter(s => s.paymentStatus === "pending").length;
  const confirmedSubs = subs.filter(s => s.paymentStatus === "confirmed");
  const confirmedRevenue = confirmedSubs.reduce(
    (sum, s) => sum + (Number.parseFloat(s.amount ?? "0") || 0),
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
    const d = asDate(s.createdAt);
    const amount = Number.parseFloat(s.amount ?? "0") || 0;
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
    amount: monthBuckets.get(m.key)?.amount ?? 0,
    count: monthBuckets.get(m.key)?.count ?? 0,
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

router.get("/finance-report", async (req, res) => {
  const now = new Date();
  const requestedYear = typeof req.query.year === "string" ? Number(req.query.year) : now.getUTCFullYear();
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
    ? requestedYear
    : now.getUTCFullYear();
  const requestedMonth = typeof req.query.month === "string" ? Number(req.query.month) : NaN;
  const selectedMonth = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
    ? requestedMonth
    : null;

  const [subscriptions, pendingSubscriptions, clinics] = await Promise.all([
    db.select().from(subscriptionsTable).where(eq(subscriptionsTable.paymentStatus, "confirmed")),
    db.select().from(subscriptionsTable).where(eq(subscriptionsTable.paymentStatus, "pending")),
    db.select({ id: clinicsTable.id, name: clinicsTable.name }).from(clinicsTable),
  ]);
  const clinicNames = new Map(clinics.map((clinic) => [clinic.id, clinic.name]));
  const yearSubscriptions = subscriptions.filter((subscription) => asDate(subscription.createdAt).getUTCFullYear() === year);
  const periodSubscriptions = selectedMonth === null
    ? yearSubscriptions
    : yearSubscriptions.filter((subscription) => asDate(subscription.createdAt).getUTCMonth() + 1 === selectedMonth);
  const periodPendingSubscriptions = pendingSubscriptions.filter((subscription) => {
    if (asDate(subscription.createdAt).getUTCFullYear() !== year) return false;
    return selectedMonth === null || asDate(subscription.createdAt).getUTCMonth() + 1 === selectedMonth;
  });
  const amountOf = (subscription: (typeof subscriptions)[number]) => Number.parseFloat(subscription.amount ?? "0") || 0;

  const months = Array.from({ length: 12 }, (_, monthIndex) => {
    const month = monthIndex + 1;
    return {
      month: `${year}-${String(month).padStart(2, "0")}`,
      amount: 0,
      count: 0,
    };
  });
  const byPlan = new Map<string, { planType: string; amount: number; count: number }>();
  const byClinic = new Map<string, { clinicId: string; clinicName: string; amount: number; count: number }>();

  for (const subscription of yearSubscriptions) {
    const amount = amountOf(subscription);
    const month = asDate(subscription.createdAt).getUTCMonth();
    months[month].amount += amount;
    months[month].count += 1;
  }

  for (const subscription of periodSubscriptions) {
    const amount = amountOf(subscription);
    const plan = byPlan.get(subscription.planType) ?? { planType: subscription.planType, amount: 0, count: 0 };
    plan.amount += amount;
    plan.count += 1;
    byPlan.set(subscription.planType, plan);

    const clinic = byClinic.get(subscription.clinicId) ?? {
      clinicId: subscription.clinicId,
      clinicName: clinicNames.get(subscription.clinicId) ?? "Deleted clinic",
      amount: 0,
      count: 0,
    };
    clinic.amount += amount;
    clinic.count += 1;
    byClinic.set(subscription.clinicId, clinic);
  }

  const totalCollected = periodSubscriptions.reduce((sum, subscription) => sum + amountOf(subscription), 0);
  const pendingAmount = periodPendingSubscriptions.reduce((sum, subscription) => sum + amountOf(subscription), 0);
  const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const currentMonth = months.find((item) => item.month === currentMonthKey);
  const availableYears = new Set<number>([now.getUTCFullYear()]);
  subscriptions.forEach((subscription) => availableYears.add(asDate(subscription.createdAt).getUTCFullYear()));

  return res.json({
    year,
    month: selectedMonth,
    totalCollected,
    transactionCount: periodSubscriptions.length,
    averageTransaction: periodSubscriptions.length ? totalCollected / periodSubscriptions.length : 0,
    pendingAmount,
    pendingCount: periodPendingSubscriptions.length,
    currentMonthCollected: currentMonth?.amount ?? 0,
    monthly: months,
    byPlan: Array.from(byPlan.values()).sort((a, b) => b.amount - a.amount),
    topClinics: Array.from(byClinic.values()).sort((a, b) => b.amount - a.amount).slice(0, 10),
    transactions: [...periodSubscriptions]
      .sort((a, b) => asDate(b.createdAt).getTime() - asDate(a.createdAt).getTime())
      .slice(0, 100)
      .map((subscription) => ({
        id: subscription.id,
        clinicName: clinicNames.get(subscription.clinicId) ?? "Deleted clinic",
        planType: subscription.planType,
        billingPeriod: subscription.billingPeriod,
        durationMonths: subscription.durationMonths,
        amount: amountOf(subscription),
        transactionReference: subscription.transactionReference ?? null,
        createdAt: asDate(subscription.createdAt).toISOString(),
      })),
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
      billingPeriod: subscriptionsTable.billingPeriod,
      durationMonths: subscriptionsTable.durationMonths,
      startDate: subscriptionsTable.startDate,
      endDate: subscriptionsTable.endDate,
      paymentStatus: subscriptionsTable.paymentStatus,
      amount: subscriptionsTable.amount,
      paymentProof: subscriptionsTable.paymentProof,
      transactionReference: subscriptionsTable.transactionReference,
      createdAt: subscriptionsTable.createdAt,
      clinicName: clinicsTable.name,
      ownerName: usersTable.name,
      ownerEmail: usersTable.email,
      ownerWhatsappNumber: usersTable.whatsappNumber,
    })
    .from(subscriptionsTable)
    .leftJoin(clinicsTable, eq(subscriptionsTable.clinicId, clinicsTable.id))
    .leftJoin(usersTable, eq(usersTable.id, clinicsTable.ownerId))
    .orderBy(desc(subscriptionsTable.createdAt));

  const filtered = status ? rows.filter(r => r.paymentStatus === status) : rows;

  return res.json(filtered.map(r => ({
    id: r.id,
    clinicId: r.clinicId,
    clinicName: r.clinicName ?? "(deleted)",
    ownerName: r.ownerName ?? null,
    ownerEmail: r.ownerEmail ?? null,
    ownerWhatsappNumber: r.ownerWhatsappNumber ?? null,
    planType: r.planType,
    billingPeriod: r.billingPeriod,
    durationMonths: r.durationMonths,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    paymentStatus: r.paymentStatus,
    amount: parseFloat(r.amount ?? "0"),
    paymentProof: r.paymentProof ?? null,
    transactionReference: r.transactionReference ?? null,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/clinics/:clinicId/impersonate", async (req, res) => {
  const clinicId = String((req.params as Record<string, unknown>).clinicId ?? "");
  const clinic = (await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1))[0];
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });

  const owner = (await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, clinic.ownerId))
    .limit(1))[0];
  if (!owner || owner.clinicId !== clinic.id || owner.role !== "admin") {
    return res.status(409).json({ error: "Clinic owner account is unavailable" });
  }
  if (owner.isBlocked || clinic.status === "blocked" || clinic.status === "deactivated") {
    return res.status(409).json({ error: "The clinic owner account is blocked or deactivated" });
  }

  const token = Buffer.from(`${owner.id}:${Date.now()}`).toString("base64");
  await db.insert(auditLogsTable).values({
    id: randomUUID(),
    adminId: req.authUser!.id,
    adminEmail: req.authUser!.email,
    action: "IMPERSONATE_CLINIC_ADMIN",
    details: `Started a support session for ${clinic.name} (${clinic.id}) as ${owner.email}`,
  });

  return res.json({
    token,
    impersonation: {
      active: true,
      clinicId: clinic.id,
      clinicName: clinic.name,
      startedBy: req.authUser!.email,
    },
    user: {
      id: owner.id,
      email: owner.email,
      role: owner.role,
      clinicId: owner.clinicId,
      name: owner.name,
      specialty: owner.specialty ?? null,
      whatsappNumber: owner.whatsappNumber ?? null,
      isBlocked: owner.isBlocked,
      emailVerifiedAt: owner.emailVerifiedAt?.toISOString() ?? null,
    },
    clinic: {
      id: clinic.id,
      requestNumber: clinic.requestNumber ?? null,
      name: clinic.name,
      phone: clinic.phone ?? null,
      address: clinic.address ?? null,
      ownerId: clinic.ownerId,
      status: clinic.status,
      subscriptionStatus: clinic.subscriptionStatus,
      trialEndDate: clinic.trialEndDate.toISOString(),
      subscriptionPlan: clinic.subscriptionPlan,
      createdAt: clinic.createdAt.toISOString(),
    },
  });
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
          phone: owner.whatsappNumber ?? null,
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
      requestNumber: clinicsTable.requestNumber,
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
    .where(or(eq(clinicsTable.status, "pending"), eq(clinicsTable.status, "pending_approval")))
    .orderBy(desc(clinicsTable.createdAt));

  return res.json(
    rows.map((r) => ({
      clinicId: r.clinicId,
      requestNumber: r.requestNumber ?? null,
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

router.post("/clinics/bulk-action", async (req, res) => {
  const body = req.body as { clinicIds?: unknown; action?: unknown };
  const requestedIds = Array.isArray(body.clinicIds)
    ? body.clinicIds.filter((clinicId): clinicId is string => typeof clinicId === "string" && clinicId.trim().length > 0)
    : [];
  const clinicIds = Array.from(new Set(requestedIds));
  const action = body.action === "activate" || body.action === "deactivate" || body.action === "block" ? body.action : null;

  if (!clinicIds.length) return res.status(400).json({ error: "Select at least one clinic" });
  if (!action) return res.status(400).json({ error: "Bulk action must be activate or deactivate" });
  if (clinicIds.length > 100) return res.status(400).json({ error: "You can update up to 100 clinics at a time" });

  const clinics = await db
    .select({ id: clinicsTable.id, name: clinicsTable.name })
    .from(clinicsTable)
    .where(inArray(clinicsTable.id, clinicIds));

  if (!clinics.length) return res.status(404).json({ error: "No matching clinics found" });

  const status = action === "activate" ? "active" : "deactivated";
  await db.update(clinicsTable).set({ status }).where(inArray(clinicsTable.id, clinics.map((clinic) => clinic.id)));

  await db.insert(auditLogsTable).values({
    id: randomUUID(),
    adminId: req.authUser!.id,
    adminEmail: req.authUser!.email,
    action: action === "activate" ? "BULK_ACTIVATE_CLINICS" : "BULK_DEACTIVATE_CLINICS",
    details: `${action === "activate" ? "Activated" : "Deactivated"} ${clinics.length} clinics: ${clinics.map((clinic) => clinic.name).join(", ")}`,
  });

  return res.json({
    action,
    status,
    updatedCount: clinics.length,
    updatedClinicIds: clinics.map((clinic) => clinic.id),
    missingClinicIds: clinicIds.filter((clinicId) => !clinics.some((clinic) => clinic.id === clinicId)),
  });
});

router.post("/clinics/:clinicId/activate", async (req, res) => {
  const { clinicId } = req.params;
  const clinic = (await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1))[0];
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });

  const updated = (await db.update(clinicsTable)
    .set({ status: "active" })
    .where(eq(clinicsTable.id, clinicId))
    .returning())[0];
  if (!updated) return res.status(404).json({ error: "Clinic not found" });

  await db.insert(auditLogsTable).values({
    id: randomUUID(),
    adminId: req.authUser!.id,
    adminEmail: req.authUser!.email,
    action: "ACTIVATE_CLINIC_TRIAL",
    details: `Activated clinic ${clinic.name} (${clinic.id}) for trial access`,
  });

  return res.json({
    id: updated.id, requestNumber: updated.requestNumber ?? null, name: updated.name, ownerId: updated.ownerId, status: updated.status,
    subscriptionStatus: updated.subscriptionStatus, trialEndDate: updated.trialEndDate.toISOString(),
    subscriptionPlan: updated.subscriptionPlan, createdAt: updated.createdAt.toISOString(),
  });
});

router.post("/clinics/:clinicId/deactivate", async (req, res) => {
  const { clinicId } = req.params;
  const clinic = (await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1))[0];
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });

  const updated = (await db.update(clinicsTable)
    .set({ status: "deactivated" })
    .where(eq(clinicsTable.id, clinicId))
    .returning())[0];

  await db.insert(auditLogsTable).values({
    id: randomUUID(),
    adminId: req.authUser!.id,
    adminEmail: req.authUser!.email,
    action: "DEACTIVATE_CLINIC",
    details: `Deactivated clinic ${clinic.name}`,
  });

  return res.json({
    id: updated.id, requestNumber: updated.requestNumber ?? null, name: updated.name, ownerId: updated.ownerId, status: updated.status,
    subscriptionStatus: updated.subscriptionStatus, trialEndDate: updated.trialEndDate.toISOString(),
    subscriptionPlan: updated.subscriptionPlan, createdAt: updated.createdAt.toISOString(),
  });
});

router.post("/clinics/:clinicId/block", async (req, res) => {
  const { clinicId } = req.params;
  const original = (await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1))[0];
  if (!original) return res.status(404).json({ error: "Clinic not found" });
  await db.update(clinicsTable).set({ status: "blocked" }).where(eq(clinicsTable.id, clinicId));
  const clinic = (await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1))[0];
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });
  await db.insert(auditLogsTable).values({
    id: randomUUID(),
    adminId: req.authUser!.id,
    adminEmail: req.authUser!.email,
    action: "BLOCK_CLINIC_LEGACY",
    details: `Blocked clinic ${clinic.name}`,
  });
  return res.json({
    id: clinic.id, requestNumber: clinic.requestNumber ?? null, name: clinic.name, ownerId: clinic.ownerId, status: clinic.status,
    subscriptionStatus: clinic.subscriptionStatus, trialEndDate: clinic.trialEndDate.toISOString(),
    subscriptionPlan: clinic.subscriptionPlan, createdAt: clinic.createdAt.toISOString(),
  });
});

router.post("/subscriptions/:clinicId/confirm", async (req, res) => {
  const { clinicId } = req.params;
  const body = req.body as any;
  const subscriptionId = body.subscriptionId;
  const customMonths = body.durationMonths ? parseInt(body.durationMonths) : null;

  let sub = subscriptionId
    ? (await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subscriptionId)).limit(1))[0]
    : (await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.clinicId, clinicId)).orderBy(desc(subscriptionsTable.createdAt)).limit(1))[0];

  if (!sub) return res.status(404).json({ error: "Subscription not found" });

  const months = customMonths || parseInt(sub.durationMonths) || 1;
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + months);

  await db.update(subscriptionsTable).set({
    paymentStatus: "confirmed",
    startDate,
    endDate,
    durationMonths: months.toString(),
  }).where(eq(subscriptionsTable.id, sub.id));

  await db.update(clinicsTable).set({
    subscriptionStatus: sub.planType as "basic" | "premium",
    status: "active",
  }).where(eq(clinicsTable.id, clinicId));

  const updated = (await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, sub.id)).limit(1))[0];
  return res.json({
    id: updated.id,
    clinicId: updated.clinicId,
    planType: updated.planType,
    startDate: updated.startDate.toISOString(),
    endDate: updated.endDate.toISOString(),
    paymentStatus: updated.paymentStatus,
    amount: parseFloat(updated.amount ?? "0"),
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
