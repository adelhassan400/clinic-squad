import pg from "/home/ubuntu/clinic-squad/node_modules/.pnpm/pg@8.20.0/node_modules/pg/esm/index.mjs";
import { randomUUID } from "node:crypto";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const clinicId = "08944f38-b293-4f7d-bf95-029f884f798b";
const transactionReference = "TEST-REVENUE-2026-08";

try {
  await pool.query("BEGIN");

  const clinic = await pool.query(
    "select id, name from clinics where id = $1 limit 1",
    [clinicId],
  );
  if (clinic.rowCount !== 1) {
    throw new Error(`Demo Clinic was not found: ${clinicId}`);
  }

  const existing = await pool.query(
    "select id, amount, created_at from subscriptions where transaction_reference = $1 limit 1",
    [transactionReference],
  );
  if (existing.rowCount === 1) {
    await pool.query("COMMIT");
    console.log(JSON.stringify({
      inserted: false,
      reason: "already_exists",
      clinic: clinic.rows[0],
      subscription: existing.rows[0],
    }, null, 2));
    process.exit(0);
  }

  const settings = await pool.query(
    "select premium_monthly_price from system_settings where id = 'global' limit 1",
  );
  const amount = settings.rowCount === 1
    ? String(settings.rows[0].premium_monthly_price ?? "400")
    : "400";

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);

  const inserted = await pool.query(
    `insert into subscriptions
      (id, clinic_id, plan_type, billing_period, duration_months, start_date, end_date,
       payment_status, amount, payment_proof, transaction_reference, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     returning id, clinic_id as "clinicId", plan_type as "planType",
       billing_period as "billingPeriod", duration_months as "durationMonths",
       start_date as "startDate", end_date as "endDate", payment_status as "paymentStatus",
       amount, transaction_reference as "transactionReference", notes, created_at as "createdAt"`,
    [
      randomUUID(),
      clinicId,
      "premium",
      "monthly",
      "1",
      startDate,
      endDate,
      "confirmed",
      amount,
      null,
      transactionReference,
      "TEST DATA: added only to verify Super Admin financial reports; safe to delete by transaction reference.",
    ],
  );

  await pool.query("COMMIT");
  console.log(JSON.stringify({
    inserted: true,
    clinic: clinic.rows[0],
    configuredPremiumMonthlyPrice: amount,
    subscription: inserted.rows[0],
  }, null, 2));
} catch (error) {
  await pool.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await pool.end();
}
