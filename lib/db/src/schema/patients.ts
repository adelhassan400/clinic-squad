import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const patientsTable = pgTable("patients", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  code: text("code"),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  dateOfBirth: text("date_of_birth"),
  gender: text("gender").notNull(),
  bloodType: text("blood_type"),
  allergies: text("allergies"),
  notes: text("notes"),
  visitType: text("visit_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPatientSchema = createInsertSchema(patientsTable).omit({ createdAt: true, updatedAt: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patientsTable.$inferSelect;
