import { pgTable, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appointmentsTable = pgTable("appointments", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  patientId: text("patient_id").notNull(),
  patientName: text("patient_name").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  status: text("status").notNull().default("scheduled"),
  type: text("type").notNull(),
  notes: text("notes"),
  fee: numeric("fee", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({ createdAt: true, updatedAt: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
