import crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import pg from "pg";

const { Client } = pg;
const email = (process.env.DEMO_ASSISTANT_EMAIL || "assistant@demo.com").trim().toLowerCase();
const password = process.env.DEMO_ASSISTANT_PASSWORD;
const clinicName = (process.env.DEMO_CLINIC_NAME || "Demo Clinic").trim();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}
if (!password) {
  throw new Error("DEMO_ASSISTANT_PASSWORD is required");
}

function hashPassword(value) {
  return crypto.createHash("sha256").update(`${value}clinicsquad_salt`).digest("hex");
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("BEGIN");

  const clinicResult = await client.query(
    `SELECT id, name
       FROM clinics
      WHERE LOWER(name) = LOWER($1)
      ORDER BY created_at DESC
      LIMIT 1`,
    [clinicName],
  );
  const clinic = clinicResult.rows[0];
  if (!clinic) {
    throw new Error(`Clinic not found: ${clinicName}`);
  }

  const passwordHash = hashPassword(password);
  const existingResult = await client.query(
    `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email],
  );
  const existing = existingResult.rows[0];

  if (existing) {
    await client.query(
      `UPDATE users
          SET password_hash = $1,
              name = 'Demo Assistant',
              role = 'assistant',
              clinic_id = $2,
              is_blocked = false,
              email_verified_at = COALESCE(email_verified_at, NOW()),
              updated_at = NOW()
        WHERE id = $3`,
      [passwordHash, clinic.id, existing.id],
    );
  } else {
    await client.query(
      `INSERT INTO users
        (id, email, password_hash, name, specialty, whatsapp_number, role,
         clinic_id, is_blocked, email_verified_at)
       VALUES ($1, $2, $3, 'Demo Assistant', NULL, NULL, 'assistant', $4, false, NOW())`,
      [randomUUID(), email, passwordHash, clinic.id],
    );
  }

  await client.query("COMMIT");
  console.log(`Demo Assistant is ready for ${clinic.name}: ${email}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
