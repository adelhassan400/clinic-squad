import { pgTable, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subscriptionsTable = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  planType: text("plan_type").notNull(),
  billingPeriod: text("billing_period").notNull().default("monthly"), // monthly | annual
  durationMonths: text("duration_months").notNull().default("1"), // e.g. 1, 3, 6, 12, etc.
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  paymentStatus: text("payment_status").notNull().default("pending"), // pending | approved | rejected
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentProof: text("payment_proof"),
  transactionReference: text("transaction_reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ createdAt: true, updatedAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;
