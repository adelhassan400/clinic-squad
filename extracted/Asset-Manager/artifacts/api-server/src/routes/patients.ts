import { Router } from "express";
import { eq, and, ilike } from "drizzle-orm";
import { db, patientsTable } from "@workspace/db";
import { CreatePatientBody } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  const { clinicId } = req.params;
  const search = (req.query.search as string) ?? "";
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  let patients = await db.select().from(patientsTable).where(eq(patientsTable.clinicId, clinicId));
  if (search) {
    patients = patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.phone.includes(search));
  }

  const total = patients.length;
  const paged = patients.slice(offset, offset + limit);

  return res.json({
    data: paged.map(p => ({
      id: p.id, clinicId: p.clinicId, name: p.name, phone: p.phone,
      dateOfBirth: p.dateOfBirth, gender: p.gender, bloodType: p.bloodType,
      allergies: p.allergies, notes: p.notes, createdAt: p.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  });
});

router.post("/", async (req, res) => {
  const { clinicId } = req.params;
  const parsed = CreatePatientBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

  const { name, phone, dateOfBirth, gender, bloodType, allergies, notes } = parsed.data;
  const id = randomUUID();

  await db.insert(patientsTable).values({
    id, clinicId, name, phone,
    dateOfBirth: dateOfBirth ?? null,
    gender,
    bloodType: bloodType ?? null,
    allergies: allergies ?? null,
    notes: notes ?? null,
  });

  const patient = (await db.select().from(patientsTable).where(eq(patientsTable.id, id)).limit(1))[0];
  return res.status(201).json({
    id: patient.id, clinicId: patient.clinicId, name: patient.name, phone: patient.phone,
    dateOfBirth: patient.dateOfBirth, gender: patient.gender, bloodType: patient.bloodType,
    allergies: patient.allergies, notes: patient.notes, createdAt: patient.createdAt.toISOString(),
  });
});

router.get("/:patientId", async (req, res) => {
  const { clinicId, patientId } = req.params;
  const patients = await db.select().from(patientsTable)
    .where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId))).limit(1);
  const p = patients[0];
  if (!p) return res.status(404).json({ error: "Patient not found" });

  return res.json({
    id: p.id, clinicId: p.clinicId, name: p.name, phone: p.phone,
    dateOfBirth: p.dateOfBirth, gender: p.gender, bloodType: p.bloodType,
    allergies: p.allergies, notes: p.notes, createdAt: p.createdAt.toISOString(),
  });
});

router.put("/:patientId", async (req, res) => {
  const { clinicId, patientId } = req.params;
  const parsed = CreatePatientBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { name, phone, dateOfBirth, gender, bloodType, allergies, notes } = parsed.data;
  await db.update(patientsTable)
    .set({ name, phone, dateOfBirth: dateOfBirth ?? null, gender, bloodType: bloodType ?? null, allergies: allergies ?? null, notes: notes ?? null })
    .where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId)));

  const p = (await db.select().from(patientsTable).where(eq(patientsTable.id, patientId)).limit(1))[0];
  return res.json({
    id: p.id, clinicId: p.clinicId, name: p.name, phone: p.phone,
    dateOfBirth: p.dateOfBirth, gender: p.gender, bloodType: p.bloodType,
    allergies: p.allergies, notes: p.notes, createdAt: p.createdAt.toISOString(),
  });
});

router.delete("/:patientId", async (req, res) => {
  const { clinicId, patientId } = req.params;
  await db.delete(patientsTable).where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId)));
  return res.status(204).send();
});

export default router;
