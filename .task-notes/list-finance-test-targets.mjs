import pg from "/home/ubuntu/clinic-squad/node_modules/.pnpm/pg@8.20.0/node_modules/pg/esm/index.mjs";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const clinics = await pool.query(`
    select id, name, status, subscription_status as "subscriptionStatus"
    from clinics
    order by created_at asc
    limit 20
  `);
  const subscriptions = await pool.query(`
    select id, clinic_id as "clinicId", plan_type as "planType", billing_period as "billingPeriod",
           duration_months as "durationMonths", payment_status as "paymentStatus", amount,
           transaction_reference as "transactionReference", created_at as "createdAt"
    from subscriptions
    order by created_at desc
    limit 20
  `);
  console.log(JSON.stringify({ clinics: clinics.rows, subscriptions: subscriptions.rows }, null, 2));
} finally {
  await pool.end();
}
