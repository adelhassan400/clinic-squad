import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, patientsTable } from "@workspace/db";
import { CreatePatientBody } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router = Router({ mergeParams: true });

function serialize(p: typeof patientsTable.$inferSelect) {
  return {
    id: p.id,
    clinicId: p.clinicId,
    code: p.code,
    name: p.name,
    phone: p.phone,
    dateOfBirth: p.dateOfBirth,
    gender: p.gender,
    bloodType: p.bloodType,
    allergies: p.allergies,
    notes: p.notes,
    visitType: p.visitType,
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

  const { name, phone, dateOfBirth, gender, bloodType, allergies, notes, visitType } = parsed.data;
  const id = randomUUID();
  const code = await nextPatientCode(clinicId);

  await db.insert(patientsTable).values({
    id, clinicId, code, name, phone,
    dateOfBirth: dateOfBirth ?? null,
    gender,
    bloodType: bloodType ?? null,
    allergies: allergies ?? null,
    notes: notes ?? null,
    visitType: visitType ?? null,
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

  const { name, phone, dateOfBirth, gender, bloodType, allergies, notes, visitType } = parsed.data;
  await db.update(patientsTable)
    .set({
      name,
      phone,
      dateOfBirth: dateOfBirth ?? null,
      gender,
      bloodType: bloodType ?? null,
      allergies: allergies ?? null,
      notes: notes ?? null,
      visitType: visitType ?? null,
    })
    .where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId)));

  const p = (await db.select().from(patientsTable).where(eq(patientsTable.id, patientId)).limit(1))[0];
  return res.json(serialize(p));
});

router.delete("/:patientId", async (req, res) => {
  const { clinicId, patientId } = req.params;
  await db.delete(patientsTable).where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId)));
  return res.status(204).send();
});

export default router;
