import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, prescriptionsTable, patientsTable, clinicsTable } from "@workspace/db";
import { CreatePrescriptionBody } from "@workspace/api-zod";
import { randomUUID } from "crypto";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router({ mergeParams: true });

router.use(requireAuth);

async function loadClinic(clinicId: string) {
  const rows = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1);
  return rows[0] ?? null;
}

function isPremium(subscriptionStatus: string | null | undefined): boolean {
  return subscriptionStatus === "premium";
}

async function serializePrescription(row: typeof prescriptionsTable.$inferSelect) {
  const patientRows = await db.select().from(patientsTable).where(eq(patientsTable.id, row.patientId)).limit(1);
  const patient = patientRows[0];
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    patientName: patient?.name ?? "",
    patientPhone: patient?.phone ?? "",
    doctorId: row.doctorId,
    doctorName: row.doctorName,
    date: row.date,
    diagnosis: row.diagnosis,
    notes: row.notes,
    items: row.items ?? [],
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const { clinicId } = req.params;
  if (req.authUser?.clinicId !== clinicId && req.authUser?.role !== "superadmin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  const clinic = await loadClinic(clinicId);
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });
  if (!isPremium(clinic.subscriptionStatus)) {
    return res.status(402).json({ error: "Premium plan required" });
  }

  const patientId = req.query.patientId as string | undefined;
  const search = ((req.query.search as string) ?? "").toLowerCase();

  const where = patientId
    ? and(eq(prescriptionsTable.clinicId, clinicId), eq(prescriptionsTable.patientId, patientId))
    : eq(prescriptionsTable.clinicId, clinicId);

  const rows = await db.select().from(prescriptionsTable).where(where).orderBy(desc(prescriptionsTable.createdAt));
  const data = await Promise.all(rows.map(serializePrescription));
  const filtered = search
    ? data.filter(
        (p) =>
          p.patientName.toLowerCase().includes(search) ||
          (p.diagnosis ?? "").toLowerCase().includes(search) ||
          p.items.some((i) => i.drug.toLowerCase().includes(search)),
      )
    : data;
  return res.json({ data: filtered, total: filtered.length });
});

router.post("/", requireRole("admin", "superadmin"), async (req, res) => {
  const { clinicId } = req.params;
  if (req.authUser?.clinicId !== clinicId && req.authUser?.role !== "superadmin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  const clinic = await loadClinic(clinicId);
  if (!clinic) return res.status(404).json({ error: "Clinic not found" });
  if (!isPremium(clinic.subscriptionStatus)) {
    return res.status(402).json({ error: "Premium plan required" });
  }

  const parsed = CreatePrescriptionBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const { patientId, date, diagnosis, notes, items } = parsed.data;

  const patient = (await db.select().from(patientsTable).where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId))).limit(1))[0];
  if (!patient) return res.status(404).json({ error: "Patient not found" });

  const id = randomUUID();
  await db.insert(prescriptionsTable).values({
    id,
    clinicId,
    patientId,
    doctorId: req.authUser!.id,
    doctorName: req.authUser!.name,
    date,
    diagnosis: diagnosis ?? null,
    notes: notes ?? null,
    items: items.map((i) => ({
      drug: i.drug,
      dosage: i.dosage,
      frequency: i.frequency,
      duration: i.duration,
      notes: i.notes ?? null,
    })),
  });

  const row = (await db.select().from(prescriptionsTable).where(eq(prescriptionsTable.id, id)).limit(1))[0];
  return res.status(201).json(await serializePrescription(row));
});

router.get("/:prescriptionId", async (req, res) => {
  const { clinicId, prescriptionId } = req.params;
  if (req.authUser?.clinicId !== clinicId && req.authUser?.role !== "superadmin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  const row = (await db.select().from(prescriptionsTable)
    .where(and(eq(prescriptionsTable.id, prescriptionId), eq(prescriptionsTable.clinicId, clinicId))).limit(1))[0];
  if (!row) return res.status(404).json({ error: "Prescription not found" });
  return res.json(await serializePrescription(row));
});

router.delete("/:prescriptionId", requireRole("admin", "superadmin"), async (req, res) => {
  const { clinicId, prescriptionId } = req.params;
  if (req.authUser?.clinicId !== clinicId && req.authUser?.role !== "superadmin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  await db.delete(prescriptionsTable)
    .where(and(eq(prescriptionsTable.id, prescriptionId), eq(prescriptionsTable.clinicId, clinicId)));
  return res.status(204).send();
});

export default router;
