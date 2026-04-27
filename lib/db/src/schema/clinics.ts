import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clinicsTable = pgTable("clinics", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  ownerId: text("owner_id").notNull(),
  status: text("status").notNull().default("pending"),
  subscriptionStatus: text("subscription_status").notNull().default("trial"),
  trialEndDate: timestamp("trial_end_date", { withTimezone: true }).notNull(),
  subscriptionPlan: text("subscription_plan"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClinicSchema = createInsertSchema(clinicsTable).omit({ createdAt: true, updatedAt: true });
export type InsertClinic = z.infer<typeof insertClinicSchema>;
export type Clinic = typeof clinicsTable.$inferSelect;
