import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, labResultsTable, patientsTable } from "@workspace/db";
import { CreateLabResultBody } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router = Router({ mergeParams: true });

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB on the raw payload string

function serialize(r: typeof labResultsTable.$inferSelect) {
  return {
    id: r.id,
    clinicId: r.clinicId,
    patientId: r.patientId,
    testName: r.testName,
    testDate: r.testDate,
    resultValue: r.resultValue,
    attachmentName: r.attachmentName,
    attachmentMime: r.attachmentMime,
    attachmentData: r.attachmentData,
    createdAt: r.createdAt.toISOString(),
  };
}

async function ensurePatient(clinicId: string, patientId: string) {
  const rows = await db
    .select({ id: patientsTable.id })
    .from(patientsTable)
    .where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId)))
    .limit(1);
  return rows.length > 0;
}

router.get("/", async (req, res) => {
  const { clinicId, patientId } = req.params;
  const ok = await ensurePatient(clinicId, patientId);
  if (!ok) return res.status(404).json({ error: "Patient not found" });

  const results = await db
    .select()
    .from(labResultsTable)
    .where(and(eq(labResultsTable.clinicId, clinicId), eq(labResultsTable.patientId, patientId)))
    .orderBy(desc(labResultsTable.testDate), desc(labResultsTable.createdAt));

  return res.json({ data: results.map(serialize) });
});

router.post("/", async (req, res) => {
  const { clinicId, patientId } = req.params;
  const ok = await ensurePatient(clinicId, patientId);
  if (!ok) return res.status(404).json({ error: "Patient not found" });

  const parsed = CreateLabResultBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }

  const { testName, testDate, resultValue, attachmentName, attachmentMime, attachmentData } =
    parsed.data;

  if (attachmentData && attachmentData.length > MAX_ATTACHMENT_BYTES) {
    return res.status(413).json({ error: "Attachment too large (max 5 MB)" });
  }

  const id = randomUUID();
  await db.insert(labResultsTable).values({
    id,
    clinicId,
    patientId,
    testName: testName.trim(),
    testDate,
    resultValue: resultValue ?? null,
    attachmentName: attachmentName ?? null,
    attachmentMime: attachmentMime ?? null,
    attachmentData: attachmentData ?? null,
  });

  const row = (
    await db.select().from(labResultsTable).where(eq(labResultsTable.id, id)).limit(1)
  )[0];
  return res.status(201).json(serialize(row));
});

router.delete("/:labResultId", async (req, res) => {
  const { clinicId, patientId, labResultId } = req.params;
  await db
    .delete(labResultsTable)
    .where(
      and(
        eq(labResultsTable.id, labResultId),
        eq(labResultsTable.patientId, patientId),
        eq(labResultsTable.clinicId, clinicId),
      ),
    );
  return res.status(204).send();
});

export default router;
