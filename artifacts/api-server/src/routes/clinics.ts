import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, clinicsTable, usersTable, subscriptionsTable, patientsTable, appointmentsTable, financesTable } from "@workspace/db";
import { CreateSubscriptionBody } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router = Router();

router.get("/:clinicId", async (req, res) => {
  const { clinicId } = req.params;
  const clinics = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1);
  const clinic = clinics[0];
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });

  // Auto-update trial expiry
  if (clinic.subscriptionStatus === "trial" && new Date() > clinic.trialEndDate) {
    await db.update(clinicsTable).set({ subscriptionStatus: "expired" }).where(eq(clinicsTable.id, clinicId));
    clinic.subscriptionStatus = "expired";
  }

  return res.json({
    id: clinic.id,
    name: clinic.name,
    ownerId: clinic.ownerId,
    status: clinic.status,
    subscriptionStatus: clinic.subscriptionStatus,
    trialEndDate: clinic.trialEndDate.toISOString(),
    subscriptionPlan: clinic.subscriptionPlan,
    createdAt: clinic.createdAt.toISOString(),
  });
});

router.get("/:clinicId/subscription", async (req, res) => {
  const { clinicId } = req.params;
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

router.post("/:clinicId/subscription", async (req, res) => {
  const { clinicId } = req.params;
  const parsed = CreateSubscriptionBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

  const { planType, paymentProof } = parsed.data;
  const amount = planType === "basic" ? 200 : 400;
  const startDate = new Date();
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 1);

  const subId = randomUUID();
  await db.insert(subscriptionsTable).values({
    id: subId,
    clinicId,
    planType,
    startDate,
    endDate,
    paymentStatus: "pending",
    amount: amount.toString(),
    paymentProof: paymentProof ?? null,
  });

  // Update clinic subscription plan
  await db.update(clinicsTable).set({ subscriptionPlan: planType }).where(eq(clinicsTable.id, clinicId));

  const sub = (await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId)).limit(1))[0];
  return res.status(201).json({
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

router.get("/:clinicId/dashboard", async (req, res) => {
  const { clinicId } = req.params;

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
    monthlyRevenue: monthlyIncome,
    monthlyExpenses,
    upcomingAppointments,
    subscriptionStatus: clinic.subscriptionStatus,
    trialDaysLeft,
  });
});

router.get("/:clinicId/appointments/today", async (req, res) => {
  const { clinicId } = req.params;
  const today = new Date().toISOString().split("T")[0];
  const appointments = await db.select().from(appointmentsTable)
    .where(eq(appointmentsTable.clinicId, clinicId));

  const todayAppts = appointments.filter(a => a.date === today);
  return res.json(todayAppts.map(a => ({
    id: a.id, clinicId: a.clinicId, patientId: a.patientId, patientName: a.patientName,
    date: a.date, time: a.time, status: a.status, type: a.type, notes: a.notes,
    fee: a.fee ? parseFloat(a.fee) : null, createdAt: a.createdAt.toISOString(),
  })));
});

// Tomorrow's scheduled appointments — for WhatsApp reminder workflow.
// Includes patient phone (joined client-side here for simplicity) so the UI
// can deep-link to wa.me without a second round-trip.
router.get("/:clinicId/appointments/tomorrow", async (req, res) => {
  const { clinicId } = req.params;
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

router.get("/:clinicId/finances/summary", async (req, res) => {
  const { clinicId } = req.params;
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
