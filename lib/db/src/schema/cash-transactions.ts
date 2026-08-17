import { pgTable, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cashTransactionsTable = pgTable("cash_transactions", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  patientId: text("patient_id").notNull(),
  doctorId: text("doctor_id"),
  collectedBy: text("collected_by"),
  visitType: text("visit_type").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull(),
  paymentMethod: text("payment_method"),
  shiftDate: text("shift_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCashTransactionSchema = createInsertSchema(cashTransactionsTable).omit({ createdAt: true, updatedAt: true });
export type InsertCashTransaction = z.infer<typeof insertCashTransactionSchema>;
export type CashTransaction = typeof cashTransactionsTable.$inferSelect;
