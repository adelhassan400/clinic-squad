import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, financesTable } from "@workspace/db";
import { CreateFinanceRecordBody } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router = Router({ mergeParams: true });

router.get("/", async (req, res) => {
  const { clinicId } = req.params;
  const type = req.query.type as string | undefined;
  const month = req.query.month ? parseInt(req.query.month as string) : undefined;
  const year = req.query.year ? parseInt(req.query.year as string) : undefined;

  let finances = await db.select().from(financesTable).where(eq(financesTable.clinicId, clinicId));
  if (type) finances = finances.filter(f => f.type === type);
  if (month !== undefined) finances = finances.filter(f => new Date(f.date).getMonth() + 1 === month);
  if (year !== undefined) finances = finances.filter(f => new Date(f.date).getFullYear() === year);

  const totalIncome = finances.filter(f => f.type === "income").reduce((s, f) => s + parseFloat(f.amount), 0);
  const totalExpense = finances.filter(f => f.type === "expense").reduce((s, f) => s + parseFloat(f.amount), 0);

  return res.json({
    data: finances.map(f => ({
      id: f.id, clinicId: f.clinicId, type: f.type, category: f.category,
      amount: parseFloat(f.amount), description: f.description, date: f.date,
      createdAt: f.createdAt.toISOString(),
    })),
    total: finances.length,
    totalIncome,
    totalExpense,
  });
});

router.post("/", async (req, res) => {
  const { clinicId } = req.params;
  const parsed = CreateFinanceRecordBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

  const { type, category, amount, description, date } = parsed.data;
  const id = randomUUID();
  await db.insert(financesTable).values({ id, clinicId, type, category, amount: amount.toString(), description, date });

  const f = (await db.select().from(financesTable).where(eq(financesTable.id, id)).limit(1))[0];
  return res.status(201).json({
    id: f.id, clinicId: f.clinicId, type: f.type, category: f.category,
    amount: parseFloat(f.amount), description: f.description, date: f.date,
    createdAt: f.createdAt.toISOString(),
  });
});

export default router;
