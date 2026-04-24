import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, appointmentsTable, patientsTable } from "@workspace/db";
import { CreateAppointmentBody, UpdateAppointmentBody } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  const { clinicId } = req.params;
  const date = req.query.date as string | undefined;
  const status = req.query.status as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  let appointments = await db.select().from(appointmentsTable).where(eq(appointmentsTable.clinicId, clinicId));
  if (date) appointments = appointments.filter(a => a.date === date);
  if (status) appointments = appointments.filter(a => a.status === status);

  const total = appointments.length;
  const paged = appointments.slice(offset, offset + limit);

  return res.json({
    data: paged.map(a => ({
      id: a.id, clinicId: a.clinicId, patientId: a.patientId, patientName: a.patientName,
      date: a.date, time: a.time, status: a.status, type: a.type, notes: a.notes,
      fee: a.fee ? parseFloat(a.fee) : null, createdAt: a.createdAt.toISOString(),
    })),
    total, page, limit,
  });
});

router.post("/", async (req, res) => {
  const { clinicId } = req.params;
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

  const { patientId, date, time, type, notes, fee } = parsed.data;

  // Get patient name
  const patients = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId)).limit(1);
  const patient = patients[0];
  if (!patient) return res.status(404).json({ error: "Patient not found" });

  const id = randomUUID();
  await db.insert(appointmentsTable).values({
    id, clinicId, patientId, patientName: patient.name,
    date, time, type,
    notes: notes ?? null,
    fee: fee?.toString() ?? null,
    status: "scheduled",
  });

  const appt = (await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, id)).limit(1))[0];
  return res.status(201).json({
    id: appt.id, clinicId: appt.clinicId, patientId: appt.patientId, patientName: appt.patientName,
    date: appt.date, time: appt.time, status: appt.status, type: appt.type, notes: appt.notes,
    fee: appt.fee ? parseFloat(appt.fee) : null, createdAt: appt.createdAt.toISOString(),
  });
});

router.put("/:appointmentId", async (req, res) => {
  const { clinicId, appointmentId } = req.params;
  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.date !== undefined) updates.date = parsed.data.date;
  if (parsed.data.time !== undefined) updates.time = parsed.data.time;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  if (parsed.data.fee !== undefined) updates.fee = parsed.data.fee?.toString() ?? null;

  await db.update(appointmentsTable)
    .set(updates)
    .where(and(eq(appointmentsTable.id, appointmentId), eq(appointmentsTable.clinicId, clinicId)));

  const appt = (await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, appointmentId)).limit(1))[0];
  return res.json({
    id: appt.id, clinicId: appt.clinicId, patientId: appt.patientId, patientName: appt.patientName,
    date: appt.date, time: appt.time, status: appt.status, type: appt.type, notes: appt.notes,
    fee: appt.fee ? parseFloat(appt.fee) : null, createdAt: appt.createdAt.toISOString(),
  });
});

router.delete("/:appointmentId", async (req, res) => {
  const { clinicId, appointmentId } = req.params;
  await db.delete(appointmentsTable).where(and(eq(appointmentsTable.id, appointmentId), eq(appointmentsTable.clinicId, clinicId)));
  return res.status(204).send();
});

export default router;
