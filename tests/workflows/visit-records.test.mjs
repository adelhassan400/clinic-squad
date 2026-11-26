import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes, createHmac } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = Number(process.env.VISIT_TEST_PORT ?? 18110);
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = "test-only-auth-token-secret-0123456789abcdef";
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("Use a throwaway PostgreSQL DATABASE_URL");
let server;
let log = "";

const sql = (q) => execFileSync("psql", [DATABASE_URL, "-X", "-A", "-t", "-c", q], { encoding: "utf8" }).trim();

async function api(p, { method = "GET", token, body } = {}) {
  const res = await fetch(`${BASE}/api${p}`, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json };
}

function tokenFor(id) {
  const p = Buffer.from(JSON.stringify({ sub: id, exp: Date.now() + 3600000, iat: Date.now() })).toString("base64url");
  return `${p}.${createHmac("sha256", SECRET).update(p).digest("base64url")}`;
}

let owner, clinic, nurse, patient, otherClinicOwner;

async function register(prefix) {
  const email = `${prefix}-${Date.now()}-${randomBytes(3).toString("hex")}@example.com`;
  const res = await api("/auth/register", {
    method: "POST",
    body: { email, password: "correct horse battery staple", clinicName: "Visit Test Clinic", ownerName: "Test Doctor", specialty: "GP", whatsappNumber: "+201000000000" },
  });
  assert.equal(res.status, 201, JSON.stringify(res.json));
  return { token: res.json.token, userId: res.json.user.id };
}

before(async () => {
  server = spawn("node", ["artifacts/api-server/dist/index.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, NODE_ENV: "test", PORT: String(PORT), DATABASE_URL, AUTH_TOKEN_SECRET: SECRET },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  const deadline = Date.now() + 30000;
  for (;;) {
    try { if ((await fetch(`${BASE}/api/healthz`)).ok) break; } catch {}
    if (Date.now() > deadline || server.exitCode !== null) throw new Error(`server not healthy:\n${log}`);
    await new Promise((r) => setTimeout(r, 250));
  }
  owner = await register("visit");
  otherClinicOwner = await register("visit-other");
  clinic = sql(`select clinic_id from users where id='${owner.userId}'`);
  sql(`update clinics set status='active' where id in (select clinic_id from users where id in ('${owner.userId}','${otherClinicOwner.userId}'))`);
  const nurseId = `nurse-${randomBytes(4).toString("hex")}`;
  sql(`insert into users (id,email,password_hash,name,role,clinic_id,email_verified_at) values ('${nurseId}','${nurseId}@example.com','x','Nurse Test','nurse','${clinic}',now())`);
  nurse = { userId: nurseId, token: tokenFor(nurseId) };
  const p = await api(`/clinics/${clinic}/patients`, { method: "POST", token: owner.token, body: { name: "Visit Patient", phone: "01000000001", age: 30 } });
  assert.equal(p.status, 201, JSON.stringify(p.json));
  patient = p.json;
});

after(() => server?.kill("SIGTERM"));

test("nurse saves vitals and marks ready; doctor sees them; diagnosis stays hidden from nurse", async () => {
  const bad = await api(`/clinics/${clinic}/visit-records/vitals`, { method: "PUT", token: nurse.token, body: { patientId: patient.id, vitals: { pulse: 9000 } } });
  assert.equal(bad.status, 400);
  const r = await api(`/clinics/${clinic}/visit-records/vitals`, {
    method: "PUT",
    token: nurse.token,
    body: { patientId: patient.id, ready: true, vitals: { bpSystolic: 120, bpDiastolic: 80, pulse: 72, temperature: 37.2, weight: 80, bloodSugar: 110, spo2: 98 } },
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.ready, true);
  assert.equal(r.json.vitals.pulse, 72);
  assert.equal(r.json.vitalsByName, "Nurse Test");

  const n = await api(`/clinics/${clinic}/patients/${patient.id}`, { token: owner.token });
  assert.equal(n.status, 200);

  const note = await api(`/clinics/${clinic}/visit-records/notes`, { method: "PUT", token: owner.token, body: { patientId: patient.id, diagnosis: "Flu", clinicalNotes: "Rest" } });
  assert.equal(note.status, 200);
  assert.equal(note.json.vitals.pulse, 72, "notes keep the vitals on the same day record");
  assert.equal(note.json.diagnosis, "Flu");

  const asNurse = await api(`/clinics/${clinic}/visit-records`, { token: nurse.token });
  assert.equal(asNurse.status, 200);
  assert.equal(asNurse.json.data.length, 1);
  assert.equal(asNurse.json.data[0].diagnosis, null, "nurse must not see diagnosis");
  assert.equal(asNurse.json.data[0].clinicalNotes, null);
  assert.equal(asNurse.json.data[0].ready, true);

  const asDoctor = await api(`/clinics/${clinic}/visit-records?patientId=${patient.id}`, { token: owner.token });
  assert.equal(asDoctor.json.data[0].diagnosis, "Flu");
  assert.equal(sql(`select count(*) from visit_records where patient_id='${patient.id}'`), "1", "one row per patient per day");
});

test("nurse cannot write notes; other clinic is blocked", async () => {
  const w = await api(`/clinics/${clinic}/visit-records/notes`, { method: "PUT", token: nurse.token, body: { patientId: patient.id, diagnosis: "x" } });
  assert.equal(w.status, 403);
  const x = await api(`/clinics/${clinic}/visit-records`, { token: otherClinicOwner.token });
  assert.equal(x.status, 403);
  const y = await api(`/clinics/${clinic}/visit-records/vitals`, { method: "PUT", token: owner.token, body: { patientId: "nope", vitals: {} } });
  assert.equal(y.status, 404);
});

test("templates: save, replace by name, list own only, delete; nurse blocked", async () => {
  const items = [{ drug: "Amoxicillin 500 mg", dosage: "500 mg", frequency: "3 times daily", duration: "7 days" }];
  const a = await api(`/clinics/${clinic}/prescription-templates`, { method: "POST", token: owner.token, body: { name: "Flu adult", diagnosis: "Flu", items } });
  assert.equal(a.status, 201, JSON.stringify(a.json));
  const b = await api(`/clinics/${clinic}/prescription-templates`, { method: "POST", token: owner.token, body: { name: "Flu adult", items: [...items, { drug: "Paracetamol", dosage: "500 mg", frequency: "8h", duration: "3 days" }] } });
  assert.equal(b.status, 201);
  const l = await api(`/clinics/${clinic}/prescription-templates`, { token: owner.token });
  assert.equal(l.json.data.length, 1);
  assert.equal(l.json.data[0].items.length, 2);
  assert.equal((await api(`/clinics/${clinic}/prescription-templates`, { token: nurse.token })).status, 403);
  assert.equal((await api(`/clinics/${clinic}/prescription-templates`, { method: "POST", token: owner.token, body: { name: "", items } })).status, 400);
  assert.equal((await api(`/clinics/${clinic}/prescription-templates/${a.json.id}`, { method: "DELETE", token: owner.token })).status, 204);
  assert.equal((await api(`/clinics/${clinic}/prescription-templates`, { token: owner.token })).json.data.length, 0);
});
