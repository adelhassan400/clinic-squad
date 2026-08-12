import { pgTable, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";

export const systemSettingsTable = pgTable("system_settings", {
  id: text("id").primaryKey().default("global"),
  basicMonthlyPrice: text("basic_monthly_price").notNull().default("200"),
  premiumMonthlyPrice: text("premium_monthly_price").notNull().default("400"),
  vodafoneCashNumber: text("vodafone_cash_number").notNull().default("01000000000"),
  instapayHandle: text("instapay_handle").notNull().default("clinicsquad@instapay"),
  whatsappNumber: text("whatsapp_number").notNull().default("201000000000"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  adminId: text("admin_id").notNull(),
  adminEmail: text("admin_email").notNull(),
  action: text("action").notNull(), // e.g. "APPROVE_SUBSCRIPTION", "BLOCK_CLINIC", "EXTEND_TRIAL"
  details: text("details").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const systemMessagesTable = pgTable("system_messages", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const promoCodesTable = pgTable("promo_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountPercent: integer("discount_percent").notNull().default(10),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
