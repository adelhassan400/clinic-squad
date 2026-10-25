import { Router } from "express";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import {
  db,
  clinicsTable,
  usersTable,
  subscriptionsTable,
  patientsTable,
  appointmentsTable,
  financesTable,
  systemSettingsTable,
  promoCodesTable,
} from "@workspace/db";
import { CreateSubscriptionBody, UpdateClinicBody } from "@workspace/api-zod";
import { randomUUID } from "crypto";
import { requireClinicAccess, requireRole } from "../middlewares/auth";

const router = Router();

router.use("/:clinicId", requireClinicAccess);

function getParam(params: unknown, key: string): string {
  const value = (params as Record<string, string | string[] | undefined>)[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function serializeClinic(clinic: typeof clinicsTable.$inferSelect) {
  return {
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
  };
}

router.get("/:clinicId", async (req, res) => {
  const clinicId = getParam(req.params, "clinicId");
  const clinics = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1);
  const clinic = clinics[0];
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });

  // Auto-update trial expiry
  if (clinic.subscriptionStatus === "trial" && new Date() > clinic.trialEndDate) {
    await db.update(clinicsTable).set({ subscriptionStatus: "expired" }).where(eq(clinicsTable.id, clinicId));
    clinic.subscriptionStatus = "expired";
  }

  return res.json(serializeClinic(clinic));
});

router.patch("/:clinicId", requireRole("admin", "doctor", "superadmin"), async (req, res) => {
  const clinicId = getParam(req.params, "clinicId");
  const parsed = UpdateClinicBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }

  const existing = (await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1))[0];
  if (!existing) return res.status(404).json({ error: "Clinic not found" });

  const patch: Partial<typeof clinicsTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
  if (parsed.data.phone !== undefined) {
    const v = parsed.data.phone === null ? null : parsed.data.phone.trim();
    patch.phone = v && v.length > 0 ? v : null;
  }
  if (parsed.data.address !== undefined) {
    const v = parsed.data.address === null ? null : parsed.data.address.trim();
    patch.address = v && v.length > 0 ? v : null;
  }

  if (Object.keys(patch).length === 0) {
    return res.json(serializeClinic(existing));
  }

  await db.update(clinicsTable).set(patch).where(eq(clinicsTable.id, clinicId));
  const updated = (await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1))[0];
  return res.json(serializeClinic(updated));
});

router.get("/:clinicId/subscription", requireRole("admin", "doctor", "superadmin"), async (req, res) => {
  const clinicId = getParam(req.params, "clinicId");
  const subs = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.clinicId, clinicId)).limit(1);
  const sub = subs[0];
  if (!sub) return res.status(404).json({ error: "No subscription found" });

  return res.json({
    id: sub.id,
    clinicId: sub.clinicId,
    planType: sub.planType,
    startDate: sub.startDate.toISOString(),
    endDate: sub.endDate.toISOString(),
    paymentStatus: sub.paymentStatus,
    amount: parseFloat(sub.amount ?? "0"),
    createdAt: sub.createdAt.toISOString(),
  });
});

router.post("/:clinicId/subscription", requireRole("admin", "doctor", "superadmin"), async (req, res) => {
  const clinicId = getParam(req.params, "clinicId");
  const parsed = CreateSubscriptionBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid subscription request" });

  const { planType, billingPeriod = "monthly" } = parsed.data;
  const requestedDuration = parsed.data.durationMonths
    ? Number.parseInt(parsed.data.durationMonths, 10)
    : 1;
  // Annual billing is always a fixed one-year commitment.
  const durationMonths = billingPeriod === "annual" ? 12 : requestedDuration;
  const paymentProof = parsed.data.paymentProof;
  const transactionReference = parsed.data.transactionReference?.trim() || null;

  if (!Number.isInteger(durationMonths) || ![1, 3, 6, 12, 24].includes(durationMonths)) {
    return res.status(400).json({ error: "Duration must be 1, 3, 6, 12, or 24 months" });
  }
  if (paymentProof) {
    const imageDataUrl = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
    if (!imageDataUrl.test(paymentProof)) {
      return res.status(400).json({ error: "Receipt must be a JPG, PNG, or WebP image" });
    }
    if (paymentProof.length > 7_000_000) {
      return res.status(413).json({ error: "Receipt image is too large (max 5 MB)" });
    }
  } else {
    return res.status(400).json({ error: "Payment receipt image is required" });
  }

  const settings = (
    await db.select({
      basicMonthlyPrice: systemSettingsTable.basicMonthlyPrice,
      premiumMonthlyPrice: systemSettingsTable.premiumMonthlyPrice,
    }).from(systemSettingsTable).where(eq(systemSettingsTable.id, "global")).limit(1)
  )[0];
  const monthlyPrice = Number.parseFloat(
    planType === "basic"
      ? settings?.basicMonthlyPrice ?? "200"
      : settings?.premiumMonthlyPrice ?? "400",
  );
  if (!Number.isFinite(monthlyPrice) || monthlyPrice <= 0) {
    return res.status(503).json({ error: "Subscription pricing is unavailable" });
  }

  // Never accept a client-computed price. Annual billing costs 10 monthly
  // payments, and discounts are checked against an active server-side promo.
  let amount = billingPeriod === "annual"
    ? monthlyPrice * 10
    : monthlyPrice * durationMonths;
  const promoCode = parsed.data.promoCode?.trim().toUpperCase();
  if (promoCode) {
    const now = new Date();
    const promo = (
      await db.select().from(promoCodesTable).where(and(
        eq(promoCodesTable.code, promoCode),
        eq(promoCodesTable.active, true),
        or(isNull(promoCodesTable.expiresAt), gt(promoCodesTable.expiresAt, now)),
      )).limit(1)
    )[0];
    if (!promo) return res.status(400).json({ error: "Promo code is invalid or expired" });
    amount = Math.round(amount * (1 - promo.discountPercent / 100));
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + durationMonths);

  const subId = randomUUID();
  await db.insert(subscriptionsTable).values({
    id: subId,
    clinicId,
    planType,
    billingPeriod,
    durationMonths: durationMonths.toString(),
    startDate,
    endDate,
    paymentStatus: "pending",
    amount: amount.toString(),
    paymentProof,
    transactionReference: transactionReference || null,
  });

  // Update clinic subscription plan
  await db.update(clinicsTable).set({ subscriptionPlan: planType }).where(eq(clinicsTable.id, clinicId));

  const sub = (await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId)).limit(1))[0];
  return res.status(201).json({
    id: sub.id,
    clinicId: sub.clinicId,
    planType: sub.planType,
    billingPeriod: sub.billingPeriod,
    durationMonths: sub.durationMonths,
    startDate: sub.startDate.toISOString(),
    endDate: sub.endDate.toISOString(),
    paymentStatus: sub.paymentStatus,
    amount: parseFloat(sub.amount ?? "0"),
    createdAt: sub.createdAt.toISOString(),
  });
});

router.get("/:clinicId/dashboard", async (req, res) => {
  const clinicId = getParam(req.params, "clinicId");

  const clinic = (await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1))[0];
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });

  const patients = await db.select().from(patientsTable).where(eq(patientsTable.clinicId, clinicId));
  const appointments = await db.select().from(appointmentsTable).where(eq(appointmentsTable.clinicId, clinicId));
  const finances = await db.select().from(financesTable).where(eq(financesTable.clinicId, clinicId));

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalPatients = patients.length;
  const newPatientsThisMonth = patients.filter(p => p.createdAt >= firstOfMonth).length;
  const todayAppointments = appointments.filter(a => a.date === today).length;
  const completedAppointments = appointments.filter(a => a.status === "completed").length;
  const upcomingAppointments = appointments.filter(a => a.status === "scheduled" && a.date >= today).length;

  const monthlyIncome = finances
    .filter(f => f.type === "income" && new Date(f.date) >= firstOfMonth)
    .reduce((sum, f) => sum + parseFloat(f.amount), 0);
  const monthlyExpenses = finances
    .filter(f => f.type === "expense" && new Date(f.date) >= firstOfMonth)
    .reduce((sum, f) => sum + parseFloat(f.amount), 0);

  let trialDaysLeft: number | null = null;
  if (clinic.subscriptionStatus === "trial") {
    trialDaysLeft = Math.max(0, Math.ceil((clinic.trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  return res.json({
    totalPatients,
    newPatientsThisMonth,
    todayAppointments,
    completedAppointments,
    monthlyRevenue: ["admin", "doctor", "superadmin"].includes(req.authUser!.role) ? monthlyIncome : null,
    monthlyExpenses: ["admin", "doctor", "superadmin"].includes(req.authUser!.role) ? monthlyExpenses : null,
    upcomingAppointments,
    subscriptionStatus: clinic.subscriptionStatus,
    trialDaysLeft,
  });
});

router.get("/:clinicId/appointments/today", async (req, res) => {
  const clinicId = getParam(req.params, "clinicId");
  const canViewFees = ["admin", "doctor", "superadmin"].includes(req.authUser!.role);
  const today = new Date().toISOString().split("T")[0];
  const [appointments, patients] = await Promise.all([
    db.select().from(appointmentsTable).where(eq(appointmentsTable.clinicId, clinicId)),
    db.select({ id: patientsTable.id, visitType: patientsTable.visitType })
      .from(patientsTable)
      .where(eq(patientsTable.clinicId, clinicId)),
  ]);
  const visitTypeById = new Map(patients.map(p => [p.id, p.visitType ?? null]));

  const todayAppts = appointments.filter(a => a.date === today);
  return res.json(todayAppts.map(a => ({
    id: a.id, clinicId: a.clinicId, patientId: a.patientId, patientName: a.patientName,
    patientVisitType: visitTypeById.get(a.patientId) ?? null,
    date: a.date, time: a.time, status: a.status, type: a.type, notes: a.notes,
    fee: canViewFees && a.fee ? parseFloat(a.fee) : null, createdAt: a.createdAt.toISOString(),
  })));
});

// Tomorrow's scheduled appointments — for WhatsApp reminder workflow.
// Includes patient phone (joined client-side here for simplicity) so the UI
// can deep-link to wa.me without a second round-trip.
router.get("/:clinicId/appointments/tomorrow", async (req, res) => {
  const clinicId = getParam(req.params, "clinicId");
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toISOString().split("T")[0];

  const [appointments, patients] = await Promise.all([
    db.select().from(appointmentsTable).where(eq(appointmentsTable.clinicId, clinicId)),
    db.select().from(patientsTable).where(eq(patientsTable.clinicId, clinicId)),
  ]);

  const phoneById = new Map(patients.map(p => [p.id, p.phone]));
  const list = appointments
    .filter(a => a.date === tomorrow && a.status === "scheduled")
    .sort((a, b) => a.time.localeCompare(b.time))
    .map(a => ({
      id: a.id, clinicId: a.clinicId, patientId: a.patientId,
      patientName: a.patientName, patientPhone: phoneById.get(a.patientId) ?? null,
      date: a.date, time: a.time, status: a.status, type: a.type,
    }));

  return res.json(list);
});

router.get("/:clinicId/finances/summary", requireRole("admin", "doctor", "superadmin"), async (req, res) => {
  const clinicId = getParam(req.params, "clinicId");
  const year = parseInt(req.query.year as string) || new Date().getFullYear();

  const finances = await db.select().from(financesTable).where(eq(financesTable.clinicId, clinicId));
  const yearFinances = finances.filter(f => new Date(f.date).getFullYear() === year);

  const totalIncome = yearFinances.filter(f => f.type === "income").reduce((s, f) => s + parseFloat(f.amount), 0);
  const totalExpense = yearFinances.filter(f => f.type === "expense").reduce((s, f) => s + parseFloat(f.amount), 0);
  const netProfit = totalIncome - totalExpense;

  const monthlyBreakdown = Array.from({ length: 12 }, (_, i) => {
    const monthFinances = yearFinances.filter(f => new Date(f.date).getMonth() === i);
    return {
      month: i + 1,
      income: monthFinances.filter(f => f.type === "income").reduce((s, f) => s + parseFloat(f.amount), 0),
      expense: monthFinances.filter(f => f.type === "expense").reduce((s, f) => s + parseFloat(f.amount), 0),
    };
  });

  return res.json({ totalIncome, totalExpense, netProfit, monthlyBreakdown });
});

export default router;
