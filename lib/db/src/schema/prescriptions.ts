import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export interface PrescriptionItem {
  drug: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string | null;
}

export const prescriptionsTable = pgTable("prescriptions", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  patientId: text("patient_id").notNull(),
  doctorId: text("doctor_id").notNull(),
  doctorName: text("doctor_name").notNull(),
  date: text("date").notNull(),
  diagnosis: text("diagnosis"),
  notes: text("notes"),
  items: jsonb("items").$type<PrescriptionItem[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPrescriptionSchema = createInsertSchema(prescriptionsTable).omit({ createdAt: true, updatedAt: true });
export type InsertPrescription = z.infer<typeof insertPrescriptionSchema>;
export type Prescription = typeof prescriptionsTable.$inferSelect;
