import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const authEventsTable = pgTable(
  "auth_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_events_user_id_created_at_idx").on(t.userId, t.createdAt)],
);

export type AuthEvent = typeof authEventsTable.$inferSelect;
