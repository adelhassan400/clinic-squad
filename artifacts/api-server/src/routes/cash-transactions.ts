import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, cashTransactionsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router({ mergeParams: true });
router.use(requireAuth);

function formatEgyptDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

router.get("/daily", async (req: any, res) => {
  const clinicId = req.params.clinicId;
  if (req.authUser?.clinicId !== clinicId && req.authUser?.role !== "superadmin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const date = typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
    ? req.query.date
    : formatEgyptDate();

  const rows = await db
    .select()
    .from(cashTransactionsTable)
    .where(and(eq(cashTransactionsTable.clinicId, clinicId), eq(cashTransactionsTable.shiftDate, date)))
    .orderBy(sql`${cashTransactionsTable.createdAt} ASC`);

  const paid = rows.filter((row) => row.status === "paid");
  const free = rows.filter((row) => row.status === "free");
  const unpaid = rows.filter((row) => row.status === "unpaid");
  const totalCollected = paid.reduce((sum, row) => sum + Number(row.amount), 0);

  return res.json({
    date,
    shiftDate: date,
    totalCollected: totalCollected.toFixed(2),
    paidCount: paid.length,
    freeCount: free.length,
    unpaidCount: unpaid.length,
    transactionCount: rows.length,
    transactions: rows,
  });
});

router.patch("/:transactionId/status", requireRole("admin", "doctor", "superadmin"), async (req: any, res) => {
  const clinicId = req.params.clinicId;
  const transactionId = req.params.transactionId;
  if (req.authUser?.clinicId !== clinicId && req.authUser?.role !== "superadmin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  const status = req.body?.status;
  if (!["paid", "free", "unpaid"].includes(status)) {
    return res.status(400).json({ error: "Status must be paid, free, or unpaid" });
  }

  const updates: Record<string, unknown> = { status };
  if (status !== "paid") {
    updates.amount = "0.00";
    updates.paymentMethod = null;
  }
  const updated = await db
    .update(cashTransactionsTable)
    .set(updates)
    .where(and(eq(cashTransactionsTable.id, transactionId), eq(cashTransactionsTable.clinicId, clinicId)))
    .returning();
  if (!updated[0]) return res.status(404).json({ error: "Cash transaction not found" });
  return res.json(updated[0]);
});

export default router;
