import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, visitRecordsTable, patientsTable, type Vitals } from "@workspace/db";
import { requireClinicAccess, requireRole } from "../middlewares/auth.js";

const router = Router({ mergeParams: true });
router.use(requireClinicAccess);

const CLINICAL_ROLES = new Set(["admin", "doctor", "superadmin"]);
const VITAL_ROLES = ["admin", "doctor", "nurse", "assistant", "secretary", "superadmin"];

// Clinic-local calendar day (Cairo), so "today" matches the waiting room.
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
}

function num(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : NaN;
}

function cleanVitals(input: any): Vitals | null {
  const out: Record<string, number | null> = {
    bpSystolic: num(input?.bpSystolic, 40, 300),
    bpDiastolic: num(input?.bpDiastolic, 20, 200),
    pulse: num(input?.pulse, 20, 300),
    temperature: num(input?.temperature, 30, 45),
    weight: num(input?.weight, 1, 500),
    bloodSugar: num(input?.bloodSugar, 10, 1500),
    spo2: num(input?.spo2, 30, 100),
  };
  if (Object.values(out).some((v) => Number.isNaN(v))) return null;
  return out as Vitals;
}

function serialize(row: any, role: string) {
  const clinical = CLINICAL_ROLES.has(role);
  return {
    id: row.id,
    patientId: row.patientId,
    visitDate: row.visitDate,
    vitals: row.vitals ?? null,
    vitalsByName: row.vitalsByName ?? null,
    ready: !!row.readyAt,
    readyAt: row.readyAt ? new Date(row.readyAt).toISOString() : null,
    // Diagnosis and notes stay doctor-only, same as on the patient record.
    diagnosis: clinical ? row.diagnosis ?? null : null,
    clinicalNotes: clinical ? row.clinicalNotes ?? null : null,
    doctorName: row.doctorName ?? null,
  };
}

// GET /visit-records?date=YYYY-MM-DD   (all patients that day)  or  ?patientId=...  (one patient's history)
router.get("/", async (req: any, res) => {
  try {
    const { clinicId } = req.params;
    const role = req.authUser.role as string;
    const patientId = typeof req.query.patientId === "string" ? req.query.patientId : undefined;
    const date = typeof req.query.date === "string" ? req.query.date : patientId ? undefined : today();
    if (role === "manager") return res.status(403).json({ error: "Forbidden" });
    const conditions = [eq(visitRecordsTable.clinicId, clinicId)];
    if (patientId) conditions.push(eq(visitRecordsTable.patientId, patientId));
    if (date) conditions.push(eq(visitRecordsTable.visitDate, date));
    const rows = await db
      .select()
      .from(visitRecordsTable)
      .where(and(...conditions))
      .orderBy(desc(visitRecordsTable.visitDate))
      .limit(500);
    return res.json({ data: rows.map((r) => serialize(r, role)) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

async function assertPatient(clinicId: string, patientId: unknown) {
  if (typeof patientId !== "string" || !patientId) return false;
  const [p] = await db
    .select({ id: patientsTable.id })
    .from(patientsTable)
    .where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId)))
    .limit(1);
  return !!p;
}

// PUT /visit-records/vitals  { patientId, vitals, ready? }  nurse/assistant/secretary/doctor
router.put("/vitals", requireRole(...VITAL_ROLES), async (req: any, res) => {
  try {
    const { clinicId } = req.params;
    const { patientId, ready } = req.body ?? {};
    if (!(await assertPatient(clinicId, patientId))) return res.status(404).json({ error: "Patient not found" });
    const vitals = cleanVitals(req.body?.vitals);
    if (!vitals) return res.status(400).json({ error: "Invalid vitals" });
    const date = today();
    const now = new Date();
    const values = {
      vitals,
      vitalsBy: req.authUser.id,
      vitalsByName: req.authUser.name,
      ...(ready ? { readyAt: now } : {}),
    };
    const [row] = await db
      .insert(visitRecordsTable)
      .values({ id: randomUUID(), clinicId, patientId, visitDate: date, ...values })
      .onConflictDoUpdate({
        target: [visitRecordsTable.clinicId, visitRecordsTable.patientId, visitRecordsTable.visitDate],
        set: { ...values, updatedAt: now },
      })
      .returning();
    return res.json(serialize(row, req.authUser.role));
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PUT /visit-records/notes  { patientId, diagnosis, clinicalNotes }  doctor/admin: snapshot of today's visit
router.put("/notes", requireRole("admin", "doctor", "superadmin"), async (req: any, res) => {
  try {
    const { clinicId } = req.params;
    const { patientId } = req.body ?? {};
    if (!(await assertPatient(clinicId, patientId))) return res.status(404).json({ error: "Patient not found" });
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 10000) : null);
    const date = today();
    const now = new Date();
    const values = {
      diagnosis: str(req.body?.diagnosis),
      clinicalNotes: str(req.body?.clinicalNotes),
      doctorId: req.authUser.id,
      doctorName: req.authUser.name,
    };
    const [row] = await db
      .insert(visitRecordsTable)
      .values({ id: randomUUID(), clinicId, patientId, visitDate: date, ...values })
      .onConflictDoUpdate({
        target: [visitRecordsTable.clinicId, visitRecordsTable.patientId, visitRecordsTable.visitDate],
        set: { ...values, updatedAt: now },
      })
      .returning();
    return res.json(serialize(row, req.authUser.role));
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
