import { pgTable, text, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import type { PrescriptionItem } from "./prescriptions.js";

export const prescriptionTemplatesTable = pgTable(
  "prescription_templates",
  {
    id: text("id").primaryKey(),
    clinicId: text("clinic_id").notNull(),
    doctorId: text("doctor_id").notNull(),
    name: text("name").notNull(),
    diagnosis: text("diagnosis"),
    items: jsonb("items").$type<PrescriptionItem[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("prescription_templates_doctor_name_idx").on(t.clinicId, t.doctorId, t.name)],
);

export type PrescriptionTemplate = typeof prescriptionTemplatesTable.$inferSelect;
