import express, { type Express, type Request } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const databasePath = process.env.SQLITE_DATABASE_PATH ?? path.resolve(process.cwd(), ".data/clinicsquad.sqlite");
mkdirSync(path.dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);

database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS clinics (
    id TEXT PRIMARY KEY,
    request_number TEXT,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    status TEXT NOT NULL,
    subscription_status TEXT NOT NULL,
    trial_end_date TEXT NOT NULL,
    subscription_plan TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    specialty TEXT,
    whatsapp_number TEXT,
    role TEXT NOT NULL,
    clinic_id TEXT,
    is_blocked INTEGER NOT NULL DEFAULT 0,
    email_verified_at TEXT,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id)
  );
  CREATE TABLE IF NOT EXISTS auth_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS auth_sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    age INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    diagnosis TEXT,
    clinical_notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    type TEXT NOT NULL,
    notes TEXT,
    fee TEXT NOT NULL DEFAULT '0',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cash_transactions (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    doctor_id TEXT,
    visit_type TEXT NOT NULL,
    amount TEXT NOT NULL,
    status TEXT NOT NULL,
    payment_method TEXT,
    shift_date TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS prescriptions (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    doctor_id TEXT NOT NULL,
    doctor_name TEXT NOT NULL,
    date TEXT NOT NULL,
    diagnosis TEXT,
    notes TEXT,
    items TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

function hashPassword(password: string): string {
  return createHash("sha256").update(password + "clinicsquad_salt").digest("hex");
}

function nowIso(): string {
  return new Date().toISOString();
}

function seedUser(input: {
  email: string;
  password: string;
  name: string;
  role: string;
  clinicId?: string | null;
  specialty?: string;
}) {
  const existing = database.prepare("SELECT id FROM users WHERE email = ?").get(input.email) as { id?: string } | undefined;
  if (existing?.id) return existing.id;
  const id = randomUUID();
  database.prepare(`
    INSERT INTO users (id, email, password_hash, name, specialty, role, clinic_id, is_blocked, email_verified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(id, input.email, hashPassword(input.password), input.name, input.specialty ?? null, input.role, input.clinicId ?? null, nowIso());
  return id;
}

function seedDemoData() {
  const demoClinic = database.prepare("SELECT id, owner_id FROM clinics WHERE id = ?").get("local-demo-clinic") as { id?: string; owner_id?: string } | undefined;
  const ownerId = demoClinic?.owner_id ?? randomUUID();
  if (!demoClinic) {
    database.prepare(`
      INSERT INTO clinics (id, request_number, name, owner_id, status, subscription_status, trial_end_date, subscription_plan, created_at)
      VALUES (?, ?, ?, ?, 'active', 'trial', ?, NULL, ?)
    `).run("local-demo-clinic", "LOCAL-001", "ClinicSquad Local Demo Clinic", ownerId, new Date(Date.now() + 30 * 86400000).toISOString(), nowIso());
  }

  seedUser({ email: "admin@demo.com", password: "demo1234", name: "Demo Doctor", role: "admin", clinicId: "local-demo-clinic", specialty: "General Practice" });
  seedUser({ email: "doctor@demo.com", password: "demo1234", name: "Demo Doctor", role: "doctor", clinicId: "local-demo-clinic", specialty: "General Practice" });
  seedUser({ email: "assistant@demo.com", password: "demo1234", name: "Demo Assistant", role: "assistant", clinicId: "local-demo-clinic" });
  seedUser({ email: "super@clinicsquad.com", password: "super1234", name: "ClinicSquad Super Admin", role: "superadmin", clinicId: null });
}

seedDemoData();

function tokenFor(userId: string): string {
  const token = randomUUID();
  database.prepare("INSERT INTO auth_sessions (token, user_id, created_at) VALUES (?, ?, ?)").run(token, userId, nowIso());
  return token;
}

function userFromToken(req: Request): { id: string } | null {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const session = database.prepare("SELECT user_id FROM auth_sessions WHERE token = ?").get(header.slice(7)) as { user_id?: string } | undefined;
  return session?.user_id ? { id: session.user_id } : null;
}

function clinicForUser(clinicId: string | null) {
  if (!clinicId) return null;
  const row = database.prepare("SELECT * FROM clinics WHERE id = ?").get(clinicId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id,
    requestNumber: row.request_number ?? null,
    name: row.name,
    phone: null,
    address: null,
    ownerId: row.owner_id,
    status: row.status,
    subscriptionStatus: row.subscription_status,
    trialEndDate: row.trial_end_date,
    subscriptionPlan: row.subscription_plan ?? null,
    createdAt: row.created_at,
  };
}

function responseForUser(user: Record<string, unknown>) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    clinicId: user.clinic_id ?? null,
    name: user.name,
    specialty: user.specialty ?? null,
    whatsappNumber: user.whatsapp_number ?? null,
    isBlocked: Boolean(user.is_blocked),
    emailVerifiedAt: user.email_verified_at ?? null,
  };
}

const app: Express = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

app.get("/api/healthz", (_req, res) => res.json({ status: "ok", database: "sqlite", synthetic: true }));

app.post("/api/auth/login", (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const user = database.prepare("SELECT * FROM users WHERE email = ? LIMIT 1").get(email) as Record<string, unknown> | undefined;
  if (!user || user.password_hash !== hashPassword(password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (Boolean(user.is_blocked)) return res.status(403).json({ error: "Account is blocked" });
  const clinic = clinicForUser((user.clinic_id as string | null) ?? null);
  if (!clinic && user.role !== "superadmin") return res.status(404).json({ error: "Clinic not found" });
  database.prepare("INSERT INTO auth_events (id, user_id, type, created_at) VALUES (?, ?, ?, ?)").run(randomUUID(), String(user.id), "login_success", nowIso());
  return res.json({ user: responseForUser(user), clinic, token: tokenFor(String(user.id)) });
});

app.get("/api/auth/me", (req, res) => {
  const tokenUser = userFromToken(req);
  if (!tokenUser) return res.status(401).json({ error: "Unauthorized" });
  const user = database.prepare("SELECT * FROM users WHERE id = ? LIMIT 1").get(tokenUser.id) as Record<string, unknown> | undefined;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  return res.json({ user: responseForUser(user), clinic: clinicForUser((user.clinic_id as string | null) ?? null), token: "local" });
});

app.post("/api/auth/logout", (_req, res) => res.status(204).end());

function currentUser(req: Request, res: express.Response): Record<string, unknown> | null {
  const tokenUser = userFromToken(req);
  if (!tokenUser) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const user = database.prepare("SELECT * FROM users WHERE id = ? LIMIT 1").get(tokenUser.id) as Record<string, unknown> | undefined;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return user;
}

function clinicAccess(req: Request, res: express.Response, clinicId: string): Record<string, unknown> | null {
  const user = currentUser(req, res);
  if (!user) return null;
  if (user.role !== "superadmin" && user.clinic_id !== clinicId) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return user;
}

function patientResponse(row: Record<string, unknown>) {
  return {
    ...row,
    clinicId: row.clinic_id,
    patientCode: row.code,
    clinicalNotes: row.clinical_notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function appointmentResponse(row: Record<string, unknown>) {
  return { ...row, clinicId: row.clinic_id, patientId: row.patient_id, patientName: row.patient_name, createdAt: row.created_at, updatedAt: row.updated_at };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

app.get("/api/clinics/:clinicId/patients", (req, res) => {
  if (!clinicAccess(req, res, req.params.clinicId)) return;
  const search = typeof req.query.search === "string" ? `%${req.query.search.toLowerCase()}%` : "%";
  const rows = database.prepare("SELECT * FROM patients WHERE clinic_id = ? AND (lower(name) LIKE ? OR lower(phone) LIKE ? OR lower(code) LIKE ?) ORDER BY created_at DESC").all(req.params.clinicId, search, search, search) as Record<string, unknown>[];
  return res.json({ data: rows.map(patientResponse), total: rows.length, page: 1, limit: 100 });
});

app.post("/api/clinics/:clinicId/patients", (req, res) => {
  if (!clinicAccess(req, res, req.params.clinicId)) return;
  const body = req.body ?? {};
  if (typeof body.name !== "string" || typeof body.phone !== "string" || typeof body.age !== "number") return res.status(400).json({ error: "Invalid input" });
  const id = randomUUID();
  const now = nowIso();
  const count = Number((database.prepare("SELECT count(*) AS count FROM patients WHERE clinic_id = ?").get(req.params.clinicId) as { count: number }).count) + 1;
  database.prepare("INSERT INTO patients (id, clinic_id, code, name, phone, age, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)").run(id, req.params.clinicId, `PT-${String(count).padStart(4, "0")}`, body.name.trim(), body.phone.trim(), body.age, now, now);
  const row = database.prepare("SELECT * FROM patients WHERE id = ?").get(id) as Record<string, unknown>;
  return res.status(201).json(patientResponse(row));
});

app.get("/api/clinics/:clinicId/patients/:patientId", (req, res) => {
  if (!clinicAccess(req, res, req.params.clinicId)) return;
  const row = database.prepare("SELECT * FROM patients WHERE id = ? AND clinic_id = ?").get(req.params.patientId, req.params.clinicId) as Record<string, unknown> | undefined;
  return row ? res.json(patientResponse(row)) : res.status(404).json({ error: "Patient not found" });
});

app.patch("/api/clinics/:clinicId/patients/:patientId", (req, res) => {
  const user = clinicAccess(req, res, req.params.clinicId);
  if (!user) return;
  if (!["admin", "doctor", "superadmin"].includes(String(user.role))) return res.status(403).json({ error: "Forbidden" });
  const body = req.body ?? {};
  const existing = database.prepare("SELECT * FROM patients WHERE id = ? AND clinic_id = ?").get(req.params.patientId, req.params.clinicId) as Record<string, unknown> | undefined;
  if (!existing) return res.status(404).json({ error: "Patient not found" });
  database.prepare("UPDATE patients SET name = ?, phone = ?, age = ?, diagnosis = ?, clinical_notes = ?, status = ?, updated_at = ? WHERE id = ? AND clinic_id = ?").run(body.name ?? existing.name, body.phone ?? existing.phone, body.age ?? existing.age, body.diagnosis ?? existing.diagnosis ?? null, body.clinicalNotes ?? existing.clinical_notes ?? null, body.status ?? existing.status, nowIso(), req.params.patientId, req.params.clinicId);
  return res.json(patientResponse(database.prepare("SELECT * FROM patients WHERE id = ?").get(req.params.patientId) as Record<string, unknown>));
});

app.post("/api/clinics/:clinicId/patients/register-and-queue", (req, res) => {
  const user = clinicAccess(req, res, req.params.clinicId);
  if (!user) return;
  const body = req.body ?? {};
  let patientId = body.patientId as string | undefined;
  database.exec("BEGIN IMMEDIATE");
  try {
    if (patientId) {
      const existing = database.prepare("SELECT * FROM patients WHERE id = ? AND clinic_id = ?").get(patientId, req.params.clinicId) as Record<string, unknown> | undefined;
      if (!existing) throw new Error("Patient not found");
    } else {
      patientId = randomUUID();
      const now = nowIso();
      const count = Number((database.prepare("SELECT count(*) AS count FROM patients WHERE clinic_id = ?").get(req.params.clinicId) as { count: number }).count) + 1;
      database.prepare("INSERT INTO patients (id, clinic_id, code, name, phone, age, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?, ?)").run(patientId, req.params.clinicId, `PT-${String(count).padStart(4, "0")}`, body.name, body.phone, body.age, now, now);
    }
    const active = database.prepare("SELECT id FROM appointments WHERE clinic_id = ? AND patient_id = ? AND date = ? AND status IN ('waiting', 'in-progress')").get(req.params.clinicId, patientId, today());
    if (active) { database.exec("ROLLBACK"); return res.status(409).json({ error: "Patient is already in the queue" }); }
    const patient = database.prepare("SELECT name FROM patients WHERE id = ?").get(patientId) as { name: string };
    const visitType = body.visitType ?? "New Consultation";
    const amount = Number(body.collectedAmount ?? ({ "New Consultation": 200, "Follow-up": 150, "Emergency": 300 } as Record<string, number>)[visitType] ?? 0);
    if (body.cashCollected === false && body.paymentStatus !== "free") { database.exec("ROLLBACK"); return res.status(403).json({ error: "Payment is required before queue admission" }); }
    const appointmentId = randomUUID();
    const now = nowIso();
    database.prepare("INSERT INTO appointments (id, clinic_id, patient_id, patient_name, date, time, status, type, fee, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?, ?, ?, ?)").run(appointmentId, req.params.clinicId, patientId, patient.name, today(), new Date().toISOString().slice(11, 16), visitType, String(amount), now, now);
    database.prepare("INSERT INTO cash_transactions (id, clinic_id, patient_id, doctor_id, visit_type, amount, status, payment_method, shift_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(randomUUID(), req.params.clinicId, patientId, body.doctorId ?? null, visitType, body.paymentStatus === "free" ? "0" : String(amount), body.paymentStatus === "free" ? "free" : "paid", body.paymentStatus === "free" ? null : "cash", today(), now);
    database.prepare("UPDATE patients SET status = 'waiting', updated_at = ? WHERE id = ?").run(now, patientId);
    database.exec("COMMIT");
    return res.status(201).json({ id: patientId, patientId, appointmentId, status: "waiting", paymentStatus: body.paymentStatus === "free" ? "free" : "paid", amount });
  } catch (error) {
    database.exec("ROLLBACK");
    return res.status(400).json({ error: error instanceof Error ? error.message : "Queue admission failed" });
  }
});

app.get("/api/clinics/:clinicId/appointments", (req, res) => {
  if (!clinicAccess(req, res, req.params.clinicId)) return;
  const dateFilter = typeof req.query.date === "string" ? req.query.date : null;
  const rows = database.prepare("SELECT * FROM appointments WHERE clinic_id = ? AND (? IS NULL OR date = ?) ORDER BY date, time").all(req.params.clinicId, dateFilter, dateFilter) as Record<string, unknown>[];
  return res.json({ data: rows.map(appointmentResponse), total: rows.length, page: 1, limit: 100 });
});

app.post("/api/clinics/:clinicId/appointments", (req, res) => {
  if (!clinicAccess(req, res, req.params.clinicId)) return;
  const body = req.body ?? {};
  const patient = database.prepare("SELECT name FROM patients WHERE id = ? AND clinic_id = ?").get(body.patientId, req.params.clinicId) as { name: string } | undefined;
  if (!patient) return res.status(404).json({ error: "Patient not found" });
  const id = randomUUID(); const now = nowIso();
  database.prepare("INSERT INTO appointments (id, clinic_id, patient_id, patient_name, date, time, status, type, notes, fee, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?)").run(id, req.params.clinicId, body.patientId, patient.name, body.date, body.time, body.type ?? body.visitType ?? "New Consultation", body.notes ?? null, String(body.fee ?? 0), now, now);
  return res.status(201).json(appointmentResponse(database.prepare("SELECT * FROM appointments WHERE id = ?").get(id) as Record<string, unknown>));
});

app.put("/api/clinics/:clinicId/appointments/:appointmentId", (req, res) => {
  if (!clinicAccess(req, res, req.params.clinicId)) return;
  const body = req.body ?? {};
  const existing = database.prepare("SELECT * FROM appointments WHERE id = ? AND clinic_id = ?").get(req.params.appointmentId, req.params.clinicId) as Record<string, unknown> | undefined;
  if (!existing) return res.status(404).json({ error: "Appointment not found" });
  database.prepare("UPDATE appointments SET date = ?, time = ?, status = ?, type = ?, notes = ?, updated_at = ? WHERE id = ? AND clinic_id = ?").run(body.date ?? existing.date, body.time ?? existing.time, body.status ?? existing.status, body.type ?? existing.type, body.notes ?? existing.notes ?? null, nowIso(), req.params.appointmentId, req.params.clinicId);
  return res.json(appointmentResponse(database.prepare("SELECT * FROM appointments WHERE id = ?").get(req.params.appointmentId) as Record<string, unknown>));
});

app.delete("/api/clinics/:clinicId/appointments/:appointmentId", (req, res) => {
  if (!clinicAccess(req, res, req.params.clinicId)) return;
  database.prepare("UPDATE appointments SET status = 'cancelled', updated_at = ? WHERE id = ? AND clinic_id = ?").run(nowIso(), req.params.appointmentId, req.params.clinicId);
  return res.status(204).end();
});

app.get("/api/clinics/:clinicId/cash-transactions/daily", (req, res) => {
  if (!clinicAccess(req, res, req.params.clinicId)) return;
  const date = typeof req.query.date === "string" ? req.query.date : today();
  const rows = database.prepare("SELECT * FROM cash_transactions WHERE clinic_id = ? AND shift_date = ? ORDER BY created_at").all(req.params.clinicId, date) as Record<string, unknown>[];
  const paid = rows.filter((row) => row.status === "paid");
  return res.json({ date, shiftDate: date, totalCollected: paid.reduce((sum, row) => sum + Number(row.amount), 0).toFixed(2), paidCount: paid.length, freeCount: rows.filter((row) => row.status === "free").length, unpaidCount: rows.filter((row) => row.status === "unpaid").length, transactionCount: rows.length, transactions: rows });
});

app.get("/api/clinics/:clinicId/prescriptions", (req, res) => {
  if (!clinicAccess(req, res, req.params.clinicId)) return;
  const patientFilter = typeof req.query.patientId === "string" ? req.query.patientId : null;
  const rows = database.prepare("SELECT * FROM prescriptions WHERE clinic_id = ? AND (? IS NULL OR patient_id = ?) ORDER BY created_at DESC").all(req.params.clinicId, patientFilter, patientFilter) as Record<string, unknown>[];
  return res.json({ data: rows.map((row) => ({ ...row, clinicId: row.clinic_id, patientId: row.patient_id, doctorId: row.doctor_id, doctorName: row.doctor_name, items: JSON.parse(String(row.items)) })), total: rows.length });
});

app.post("/api/clinics/:clinicId/prescriptions", (req, res) => {
  const user = clinicAccess(req, res, req.params.clinicId);
  if (!user) return;
  if (!["admin", "doctor", "superadmin"].includes(String(user.role))) return res.status(403).json({ error: "Forbidden" });
  const body = req.body ?? {};
  const patient = database.prepare("SELECT id FROM patients WHERE id = ? AND clinic_id = ?").get(body.patientId, req.params.clinicId);
  if (!patient) return res.status(404).json({ error: "Patient not found" });
  const id = randomUUID(); const now = nowIso();
  database.prepare("INSERT INTO prescriptions (id, clinic_id, patient_id, doctor_id, doctor_name, date, diagnosis, notes, items, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, req.params.clinicId, body.patientId, String(user.id), String(user.name), today(), body.diagnosis ?? null, body.notes ?? null, JSON.stringify(body.items ?? body.medications ?? []), now);
  return res.status(201).json({ id, clinicId: req.params.clinicId, patientId: body.patientId, doctorId: user.id, doctorName: user.name, date: today(), diagnosis: body.diagnosis ?? null, notes: body.notes ?? null, items: body.items ?? body.medications ?? [], createdAt: now });
});

export default app;
export { databasePath };
