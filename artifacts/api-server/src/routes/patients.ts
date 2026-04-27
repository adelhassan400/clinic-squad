import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, patientsTable } from "@workspace/db";
import { CreatePatientBody, PatchPatientBody } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router = Router({ mergeParams: true });

function serialize(p: typeof patientsTable.$inferSelect) {
  return {
    id: p.id,
    clinicId: p.clinicId,
    code: p.code,
    name: p.name,
    phone: p.phone,
    age: p.age,
    dateOfBirth: p.dateOfBirth,
    bloodType: p.bloodType,
    allergies: p.allergies,
    notes: p.notes,
    visitType: p.visitType,
    status: p.status,
    diagnosis: p.diagnosis,
    clinicalNotes: p.clinicalNotes,
    createdAt: p.createdAt.toISOString(),
  };
}

async function nextPatientCode(clinicId: string): Promise<string> {
  const existing = await db
    .select({ code: patientsTable.code })
    .from(patientsTable)
    .where(eq(patientsTable.clinicId, clinicId));
  let max = 0;
  for (const row of existing) {
    const m = row.code?.match(/^PT-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `PT-${String(max + 1).padStart(4, "0")}`;
}

router.get("/", async (req, res) => {
  const { clinicId } = req.params;
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "";
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  let patients = await db.select().from(patientsTable).where(eq(patientsTable.clinicId, clinicId));
  if (search) {
    const s = search.toLowerCase();
    patients = patients.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.phone.includes(search) ||
        (p.code ?? "").toLowerCase().includes(s),
    );
  }
  if (status) {
    patients = patients.filter((p) => p.status === status);
  }

  const total = patients.length;
  const paged = patients.slice(offset, offset + limit);

  return res.json({
    data: paged.map(serialize),
    total,
    page,
    limit,
  });
});

router.post("/", async (req, res) => {
  const { clinicId } = req.params;
  const parsed = CreatePatientBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

  const { name, phone, age, dateOfBirth, bloodType, allergies, notes, visitType } = parsed.data;
  const id = randomUUID();
  const code = await nextPatientCode(clinicId);

  // Every new patient is automatically placed on the doctor's waiting list.
  await db.insert(patientsTable).values({
    id, clinicId, code, name, phone,
    age,
    dateOfBirth: dateOfBirth ?? null,
    bloodType: bloodType ?? null,
    allergies: allergies ?? null,
    notes: notes ?? null,
    visitType,
    status: "waiting",
  });

  const patient = (await db.select().from(patientsTable).where(eq(patientsTable.id, id)).limit(1))[0];
  return res.status(201).json(serialize(patient));
});

router.get("/:patientId", async (req, res) => {
  const { clinicId, patientId } = req.params;
  const patients = await db.select().from(patientsTable)
    .where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId))).limit(1);
  const p = patients[0];
  if (!p) return res.status(404).json({ error: "Patient not found" });

  return res.json(serialize(p));
});

router.put("/:patientId", async (req, res) => {
  const { clinicId, patientId } = req.params;
  const parsed = CreatePatientBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { name, phone, age, dateOfBirth, bloodType, allergies, notes, visitType } = parsed.data;
  await db.update(patientsTable)
    .set({
      name,
      phone,
      age,
      dateOfBirth: dateOfBirth ?? null,
      bloodType: bloodType ?? null,
      allergies: allergies ?? null,
      notes: notes ?? null,
      visitType,
    })
    .where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId)));

  const p = (await db.select().from(patientsTable).where(eq(patientsTable.id, patientId)).limit(1))[0];
  return res.json(serialize(p));
});

router.patch("/:patientId", async (req, res) => {
  const { clinicId, patientId } = req.params;
  const parsed = PatchPatientBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

  const data = parsed.data;
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.phone !== undefined) update.phone = data.phone;
  if (data.age !== undefined) update.age = data.age ?? null;
  if (data.dateOfBirth !== undefined) update.dateOfBirth = data.dateOfBirth ?? null;
  if (data.bloodType !== undefined) update.bloodType = data.bloodType ?? null;
  if (data.allergies !== undefined) update.allergies = data.allergies ?? null;
  if (data.notes !== undefined) update.notes = data.notes ?? null;
  if (data.visitType !== undefined) update.visitType = data.visitType;
  if (data.status !== undefined) update.status = data.status;
  if (data.diagnosis !== undefined) update.diagnosis = data.diagnosis ?? null;
  if (data.clinicalNotes !== undefined) update.clinicalNotes = data.clinicalNotes ?? null;

  if (Object.keys(update).length > 0) {
    await db.update(patientsTable)
      .set(update)
      .where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId)));
  }

  const p = (await db.select().from(patientsTable).where(eq(patientsTable.id, patientId)).limit(1))[0];
  if (!p) return res.status(404).json({ error: "Patient not found" });
  return res.json(serialize(p));
});

router.delete("/:patientId", async (req, res) => {
  const { clinicId, patientId } = req.params;
  await db.delete(patientsTable).where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId)));
  return res.status(204).send();
});

export default router;
