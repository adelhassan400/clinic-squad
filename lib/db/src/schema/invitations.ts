import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const invitationsTable = pgTable("invitations", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"),
  invitedBy: text("invited_by").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Invitation = typeof invitationsTable.$inferSelect;
