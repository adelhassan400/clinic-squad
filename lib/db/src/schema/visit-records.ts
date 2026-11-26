import { pgTable, text, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

export interface Vitals {
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  pulse?: number | null;
  temperature?: number | null;
  weight?: number | null;
  bloodSugar?: number | null;
  spo2?: number | null;
}

// One row per patient per day: nurse vitals + the doctor's diagnosis/notes snapshot for that visit.
export const visitRecordsTable = pgTable(
  "visit_records",
  {
    id: text("id").primaryKey(),
    clinicId: text("clinic_id").notNull(),
    patientId: text("patient_id").notNull(),
    visitDate: text("visit_date").notNull(),
    vitals: jsonb("vitals").$type<Vitals>(),
    vitalsBy: text("vitals_by"),
    vitalsByName: text("vitals_by_name"),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    diagnosis: text("diagnosis"),
    clinicalNotes: text("clinical_notes"),
    doctorId: text("doctor_id"),
    doctorName: text("doctor_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("visit_records_patient_day_idx").on(t.clinicId, t.patientId, t.visitDate)],
);

export type VisitRecord = typeof visitRecordsTable.$inferSelect;
