import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, prescriptionTemplatesTable } from "@workspace/db";
import { requireClinicAccess, requireRole } from "../middlewares/auth.js";

const router = Router({ mergeParams: true });
router.use(requireClinicAccess);
router.use(requireRole("admin", "doctor", "superadmin"));

function cleanItems(input: unknown) {
  if (!Array.isArray(input)) return null;
  const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 300) : "");
  const items = input
    .map((i: any) => ({
      drug: str(i?.drug),
      dosage: str(i?.dosage),
      frequency: str(i?.frequency),
      duration: str(i?.duration),
      notes: str(i?.notes) || null,
    }))
    .filter((i) => i.drug)
    .slice(0, 30);
  return items.length ? items : null;
}

// Each doctor sees only their own templates.
router.get("/", async (req: any, res) => {
  try {
    const rows = await db
      .select()
      .from(prescriptionTemplatesTable)
      .where(and(eq(prescriptionTemplatesTable.clinicId, req.params.clinicId), eq(prescriptionTemplatesTable.doctorId, req.authUser.id)))
      .orderBy(asc(prescriptionTemplatesTable.name));
    return res.json({ data: rows.map((r) => ({ id: r.id, name: r.name, diagnosis: r.diagnosis, items: r.items })) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Saving a template with an existing name replaces it.
router.post("/", async (req: any, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 80) : "";
    const items = cleanItems(req.body?.items);
    if (!name) return res.status(400).json({ error: "Name is required" });
    if (!items) return res.status(400).json({ error: "Add at least one medication" });
    const diagnosis = typeof req.body?.diagnosis === "string" && req.body.diagnosis.trim() ? req.body.diagnosis.trim().slice(0, 300) : null;
    const now = new Date();
    const [row] = await db
      .insert(prescriptionTemplatesTable)
      .values({ id: randomUUID(), clinicId: req.params.clinicId, doctorId: req.authUser.id, name, diagnosis, items })
      .onConflictDoUpdate({
        target: [prescriptionTemplatesTable.clinicId, prescriptionTemplatesTable.doctorId, prescriptionTemplatesTable.name],
        set: { diagnosis, items, updatedAt: now },
      })
      .returning();
    return res.status(201).json({ id: row.id, name: row.name, diagnosis: row.diagnosis, items: row.items });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete("/:templateId", async (req: any, res) => {
  try {
    await db
      .delete(prescriptionTemplatesTable)
      .where(
        and(
          eq(prescriptionTemplatesTable.id, req.params.templateId),
          eq(prescriptionTemplatesTable.clinicId, req.params.clinicId),
          eq(prescriptionTemplatesTable.doctorId, req.authUser.id),
        ),
      );
    return res.status(204).send();
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
