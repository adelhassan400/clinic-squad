import { pgTable, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const financesTable = pgTable("finances", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  type: text("type").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  date: text("date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFinanceSchema = createInsertSchema(financesTable).omit({ createdAt: true, updatedAt: true });
export type InsertFinance = z.infer<typeof insertFinanceSchema>;
export type Finance = typeof financesTable.$inferSelect;
