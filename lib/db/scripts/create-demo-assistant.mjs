import crypto, { randomUUID } from "node:crypto";
import pg from "pg";

const { Client } = pg;
const email = (process.env.DEMO_ASSISTANT_EMAIL || "assistant@demo.com").trim().toLowerCase();
const doctorEmail = "doctor@demo.com";
const password = process.env.DEMO_ASSISTANT_PASSWORD?.trim();
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

  // 1. Ensure Clinic exists
  let clinicResult = await client.query(
    `SELECT id, name FROM clinics WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [clinicName]
  );
  let clinic = clinicResult.rows[0];

  if (!clinic) {
    console.log(`Clinic "${clinicName}" not found. Creating demo environment...`);
    
    // Create a Demo Doctor first as the owner
    const doctorId = randomUUID();
    const doctorPasswordHash = hashPassword("doctor1234");
    
    await client.query(
      `INSERT INTO users 
        (id, email, password_hash, name, role, clinic_id, email_verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (email) DO UPDATE SET clinic_id = $6`,
      [doctorId, doctorEmail, doctorPasswordHash, "Demo Doctor", "admin", "TEMP_ID"]
    );

    const clinicId = randomUUID();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    await client.query(
      `INSERT INTO clinics 
        (id, name, owner_id, status, subscription_status, trial_end_date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [clinicId, clinicName, doctorId, "active", "trial", trialEndDate]
    );

    // Update doctor's clinic_id to the real one
    await client.query(
      `UPDATE users SET clinic_id = $1 WHERE id = $2`,
      [clinicId, doctorId]
    );

    clinic = { id: clinicId, name: clinicName };
    console.log(`Created Clinic: ${clinicName} (ID: ${clinicId})`);
    console.log(`Created Doctor: ${doctorEmail} (Password: doctor1234)`);
  }

  // 2. Ensure Assistant exists
  const passwordHash = hashPassword(password);
  const existingResult = await client.query(
    `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
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
      [passwordHash, clinic.id, existing.id]
    );
    console.log(`Updated existing Assistant: ${email}`);
  } else {
    await client.query(
      `INSERT INTO users
        (id, email, password_hash, name, role, clinic_id, is_blocked, email_verified_at)
       VALUES ($1, $2, $3, 'Demo Assistant', 'assistant', $4, false, NOW())`,
      [randomUUID(), email, passwordHash, clinic.id]
    );
    console.log(`Created new Assistant: ${email}`);
  }

  await client.query("COMMIT");
  console.log(`\n--- SETUP COMPLETE ---`);
  console.log(`Clinic: ${clinic.name}`);
  console.log(`Doctor Login: ${doctorEmail} / doctor1234`);
  console.log(`Assistant Login: ${email} / ${password}`);
  console.log(`------------------------`);
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Setup failed:", error);
  throw error;
} finally {
  await client.end();
}
