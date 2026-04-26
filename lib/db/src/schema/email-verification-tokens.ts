import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const emailVerificationTokensTable = pgTable(
  "email_verification_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_verification_tokens_user_id_idx").on(t.userId)],
);

export type EmailVerificationToken = typeof emailVerificationTokensTable.$inferSelect;
