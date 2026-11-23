import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes, createHmac } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const PORT = Number(process.env.WORKFLOW_TEST_PORT ?? 18100);
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = "test-only-auth-token-secret-0123456789abcdef";
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("Use a throwaway PostgreSQL DATABASE_URL");
let server;
let serverLog = "";

function sql(query) {
  return execFileSync("psql", [DATABASE_URL, "-X", "-A", "-t", "-c", query], {
    encoding: "utf8",
  }).trim();
}

async function api(pathname, { method = "GET", token, body } = {}) {
  const res = await fetch(`${BASE}/api${pathname}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // leave json null
  }
  return { status: res.status, json };
}

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${randomBytes(3).toString("hex")}@example.com`;
}

async function registerClinic(prefix) {
  const email = uniqueEmail(prefix);
  const password = "correct horse battery staple";
  const res = await api("/auth/register", {
    method: "POST",
    body: {
      email,
      password,
      clinicName: "Security Test Clinic",
      ownerName: "Test Doctor",
      specialty: "Cardiology",
      whatsappNumber: "+201000000000",
    },
  });
  assert.equal(res.status, 201, `register failed: ${JSON.stringify(res.json)}`);
  return { email, password, token: res.json.token, userId: res.json.user.id };
}

before(async () => {
  server = spawn("node", ["artifacts/api-server/dist/index.mjs"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(PORT),
      DATABASE_URL,
      AUTH_TOKEN_SECRET: SECRET,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => (serverLog += d));
  server.stderr.on("data", (d) => (serverLog += d));

  const deadline = Date.now() + 30_000;
  for (;;) {
    try {
      const res = await fetch(`${BASE}/api/healthz`);
      if (res.ok) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      throw new Error(`server did not become healthy. Log:\n${serverLog}`);
    }
    if (server.exitCode !== null) {
      throw new Error(
        `server exited with ${server.exitCode}. Log:\n${serverLog}`,
      );
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  owner = await registerClinic("queue");
  clinic = sql(`select clinic_id from users where id='${owner.userId}'`);
});

after(() => {
  server?.kill("SIGTERM");
});

function tokenFor(id) {
  const p = Buffer.from(
    JSON.stringify({ sub: id, exp: Date.now() + 3600000, iat: Date.now() }),
  ).toString("base64url");
  return `${p}.${createHmac("sha256", SECRET).update(p).digest("base64url")}`;
}
let owner, clinic, patient, appt;

const endpoint = (p = "") => `/clinics/${clinic}/patients${p}`;
async function create(name = "Test Patient") {
  const r = await api(endpoint(), {
    method: "POST",
    token: owner.token,
    body: { name, phone: "01000000000", age: 30 },
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json;
}

test("queue is complete beyond 20 records and orders by arrival, not file age", async () => {
  const old = await create("ZZZ old file");
  const first = await create("ZZZ first arrival");
  for (let i = 0; i < 22; i++) await create(`AAA registered ${i}`);
  const arrive = async (p) =>
    api(endpoint("/register-and-queue"), {
      method: "POST",
      token: owner.token,
      body: { patientId: p.id, doctorId: owner.userId },
    });
  assert.equal((await arrive(first)).status, 201);
  await new Promise((r) => setTimeout(r, 15));
  assert.equal((await arrive(old)).status, 201);
  const r = await api(endpoint("/queue"), { token: owner.token });
  assert.equal(r.status, 200);
  assert.deepEqual(
    r.json.data.map((p) => p.id),
    [first.id, old.id],
  );
  assert.ok(r.json.data.every((p) => p.checkedInAt));
  assert.equal(r.json.data[0].paymentStatus, "unpaid");
});

test("scheduled arrivals reuse the appointment and fee, never mark completed or invent collected cash", async () => {
  patient = await create("Scheduled patient");
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const r = await api(`/clinics/${clinic}/appointments`, {
    method: "POST",
    token: owner.token,
    body: {
      patientId: patient.id,
      date,
      time: "12:00",
      type: "Follow-up",
      fee: 125,
    },
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  appt = r.json;
  const check = await api(endpoint("/register-and-queue"), {
    method: "POST",
    token: owner.token,
    body: { patientId: patient.id, appointmentId: appt.id },
  });
  assert.equal(check.status, 201, JSON.stringify(check.json));
  assert.equal(check.json.status, "waiting");
  assert.equal(check.json.paymentStatus, "unpaid");
  assert.equal(Number(check.json.paymentAmount), 125);
  assert.equal(check.json.paymentReceivedAt, null);
  assert.equal(
    sql(`select count(*) from appointments where patient_id='${patient.id}'`),
    "1",
  );
  assert.equal(
    sql(`select status from appointments where id='${appt.id}'`),
    "waiting",
  );
  assert.equal(
    sql(
      `select count(*) from cash_transactions where patient_id='${patient.id}'`,
    ),
    "1",
  );
});

test("concurrent duplicate arrivals create just one visit and one cash transaction", async () => {
  const p = await create("Duplicate");
  const body = {
    patientId: p.id,
    visitType: "New Consultation",
    cashCollected: true,
    collectedAmount: 200,
  };
  const replies = await Promise.all(
    [1, 2].map(() =>
      api(endpoint("/register-and-queue"), {
        method: "POST",
        token: owner.token,
        body,
      }),
    ),
  );
  assert.deepEqual(replies.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    sql(`select count(*) from appointments where patient_id='${p.id}'`),
    "1",
  );
  assert.equal(
    sql(`select count(*) from cash_transactions where patient_id='${p.id}'`),
    "1",
  );
});

test("invalid doctor or mismatched appointment rolls back patient, visit and ledger changes", async () => {
  const p = await create("Rollback");
  for (const extra of [
    { doctorId: "missing-doctor" },
    { appointmentId: appt.id },
  ]) {
    const r = await api(endpoint("/register-and-queue"), {
      method: "POST",
      token: owner.token,
      body: { patientId: p.id, ...extra },
    });
    assert.equal(r.status, 400, JSON.stringify(r.json));
    assert.equal(
      sql(`select status from patients where id='${p.id}'`),
      "registered",
    );
    assert.equal(
      sql(`select count(*) from appointments where patient_id='${p.id}'`),
      "0",
    );
    assert.equal(
      sql(`select count(*) from cash_transactions where patient_id='${p.id}'`),
      "0",
    );
  }
});

test("clinical save and completion use real handlers and synchronize the linked appointment", async () => {
  let r = await api(endpoint(`/${patient.id}`), {
    method: "PATCH",
    token: owner.token,
    body: { status: "in-progress" },
  });
  assert.equal(r.status, 200);
  assert.equal(
    sql(`select status from appointments where id='${appt.id}'`),
    "in-progress",
  );
  r = await api(endpoint(`/${patient.id}`), {
    method: "PATCH",
    token: owner.token,
    body: { diagnosis: "Test diagnosis", clinicalNotes: "Test notes" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.clinicalNotes, "Test notes");
  r = await api(endpoint(`/${patient.id}`), {
    method: "PATCH",
    token: owner.token,
    body: { status: "completed" },
  });
  assert.equal(r.status, 200);
  assert.equal(
    sql(`select status from appointments where id='${appt.id}'`),
    "completed",
  );
});

test("doctor queue is enforced server-side and assistant queue hides clinical fields", async () => {
  const doctor = `doctor-${Date.now()}`,
    assistant = `assistant-${Date.now()}`;
  for (const [id, role] of [
    [doctor, "doctor"],
    [assistant, "assistant"],
  ])
    sql(
      `insert into users(id,email,password_hash,name,role,clinic_id) values('${id}','${id}@example.com','unused','Test','${role}','${clinic}')`,
    );
  const p = await create("Other doctor");
  await api(endpoint("/register-and-queue"), {
    method: "POST",
    token: owner.token,
    body: { patientId: p.id, doctorId: doctor },
  });
  const d = await api(endpoint(`/queue?doctorId=${owner.userId}`), {
    token: tokenFor(doctor),
  });
  assert.equal(d.status, 200, JSON.stringify(d.json));
  assert.deepEqual(
    d.json.data.map((p) => p.id),
    [p.id],
  );
  const a = await api(endpoint("/queue"), { token: tokenFor(assistant) });
  assert.equal(a.status, 200);
  assert.ok(
    a.json.data.every((p) => p.diagnosis === null && p.clinicalNotes === null),
  );
});

test("legacy single and bulk check-ins use the same visit and ledger transaction", async () => {
  const a = await create("Legacy"),
    b = await create("Bulk paid");
  const r = await api(endpoint(`/${a.id}`), {
    method: "PATCH",
    token: owner.token,
    body: { status: "waiting", visitType: "Follow-up" },
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.ok(r.json.checkedInAt);
  sql(
    `update patients set status='paid',payment_status='paid',payment_amount=100,payment_method='cash' where id='${b.id}'`,
  );
  const bulk = await api(endpoint("/bulk-check-in"), {
    method: "POST",
    token: owner.token,
    body: { patientIds: [a.id, b.id], visitType: "Follow-up" },
  });
  assert.equal(bulk.status, 200);
  assert.equal(bulk.json.updatedCount, 1);
  assert.equal(bulk.json.skippedCount, 1);
  for (const p of [a, b]) {
    assert.equal(
      sql(`select count(*) from appointments where patient_id='${p.id}'`),
      "1",
    );
    assert.equal(
      sql(`select count(*) from cash_transactions where patient_id='${p.id}'`),
      "1",
    );
  }
});
