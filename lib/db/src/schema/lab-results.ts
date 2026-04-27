import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const labResultsTable = pgTable("lab_results", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  patientId: text("patient_id").notNull(),
  testName: text("test_name").notNull(),
  testDate: text("test_date").notNull(),
  resultValue: text("result_value"),
  attachmentName: text("attachment_name"),
  attachmentMime: text("attachment_mime"),
  attachmentData: text("attachment_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LabResult = typeof labResultsTable.$inferSelect;
