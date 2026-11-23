/**
 * Security regression tests for the production auth handlers.
 *
 * These tests run the real Express app (artifacts/api-server/dist/index.mjs)
 * against a real PostgreSQL database, not the synthetic SQLite test double
 * used by the Playwright suite. They lock in the auth hardening:
 *   - bearer tokens must be HMAC-signed and unexpired (the old format was an
 *     unsigned base64 "userId:timestamp" that anyone could forge);
 *   - /api/auth/forgot-password must never return a usable reset token;
 *   - passwords are stored as scrypt hashes, with legacy SHA-256 hashes still
 *     accepted once and then upgraded.
 *
 * Prerequisites: `pnpm --filter @workspace/api-server run build`, PostgreSQL
 * with the schema applied (drizzle-kit push), and DATABASE_URL pointing at a
 * throwaway database. Run via `pnpm run test:security`.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHmac, createHash, randomBytes, scryptSync } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = Number(process.env.SECURITY_TEST_PORT ?? 18099);
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = "test-only-auth-token-secret-0123456789abcdef";
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must point at a throwaway PostgreSQL database to run these tests",
  );
}

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

function signPayload(payloadB64, secret) {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function forgedToken(payload, secret) {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${signPayload(payloadB64, secret)}`;
}

function legacySha256(password) {
  return createHash("sha256").update(password + "clinicsquad_salt").digest("hex");
}

function scryptHash(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt}$${derived.toString("hex")}`;
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
      if (res.ok) return;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      throw new Error(`server did not become healthy. Log:\n${serverLog}`);
    }
    if (server.exitCode !== null) {
      throw new Error(`server exited with ${server.exitCode}. Log:\n${serverLog}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
});

after(() => {
  server?.kill("SIGTERM");
});

test("login/register issue signed tokens that authenticate the user", async () => {
  const { email, password, token } = await registerClinic("signed");
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

  const me = await api("/auth/me", { token });
  assert.equal(me.status, 200);
  assert.equal(me.json.email, email);

  const login = await api("/auth/login", { method: "POST", body: { email, password } });
  assert.equal(login.status, 200);
  assert.match(login.json.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
});

test("the old unsigned base64 token format is rejected", async () => {
  const { userId } = await registerClinic("legacy-token");
  const forged = Buffer.from(`${userId}:${Date.now()}`).toString("base64");
  const res = await api("/auth/me", { token: forged });
  assert.equal(res.status, 401);

  const garbage = await api("/auth/me", { token: "not-a-token" });
  assert.equal(garbage.status, 401);
});

test("tampered and wrongly-signed tokens are rejected", async () => {
  const { token, userId } = await registerClinic("tampered");

  // Same payload, signature computed with a different secret.
  const payloadB64 = token.split(".")[0];
  const wrongSecret = `t${payloadB64}.${signPayload(payloadB64, "wrong-secret-wrong-secret-wrong-secret")}`;
  assert.equal((await api("/auth/me", { token: wrongSecret })).status, 401);

  // Payload rewritten to impersonate another user id, unsigned.
  const other = await registerClinic("victim");
  const reEncoded = `${Buffer.from(
    JSON.stringify({ sub: other.userId, iat: Date.now(), exp: Date.now() + 60_000 }),
  ).toString("base64url")}.invalidsignature`;
  const res = await api("/auth/me", { token: reEncoded });
  assert.equal(res.status, 401);
  assert.notEqual(res.json?.id, other.userId);
  assert.ok(userId !== other.userId);
});

test("expired tokens are rejected", async () => {
  const { userId } = await registerClinic("expired");
  const expired = forgedToken(
    { sub: userId, iat: Date.now() - 8 * 24 * 3600 * 1000, exp: Date.now() - 1000 },
    SECRET,
  );
  assert.equal((await api("/auth/me", { token: expired })).status, 401);

  // Sanity check: a correctly signed, unexpired token still works.
  const valid = forgedToken({ sub: userId, iat: Date.now(), exp: Date.now() + 60_000 }, SECRET);
  assert.equal((await api("/auth/me", { token: valid })).status, 200);
});

test("login rejects a wrong password", async () => {
  const { email } = await registerClinic("wrongpass");
  const res = await api("/auth/login", {
    method: "POST",
    body: { email, password: "definitely wrong" },
  });
  assert.equal(res.status, 401);
});

test("forgot-password never returns a usable reset token or link", async () => {
  const { email } = await registerClinic("forgot");

  const known = await api("/auth/forgot-password", { method: "POST", body: { email } });
  assert.equal(known.status, 200);
  assert.equal(known.json.resetToken ?? null, null);
  assert.equal(known.json.resetUrl ?? null, null);

  const unknown = await api("/auth/forgot-password", {
    method: "POST",
    body: { email: uniqueEmail("nobody") },
  });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.json.resetToken ?? null, null);
  assert.equal(unknown.json.resetUrl ?? null, null);

  // Identical message either way, so the endpoint cannot enumerate accounts.
  assert.equal(known.json.message, unknown.json.message);
});

test("password reset works end to end via the superadmin support link", async () => {
  const account = await registerClinic("reset");

  // Seed a superadmin directly (production seed data does the same).
  const superEmail = uniqueEmail("super");
  sql(
    `INSERT INTO users (id, email, password_hash, name, role, clinic_id, is_blocked, email_verified_at) VALUES ('${randomBytes(16).toString("hex")}', '${superEmail}', '${scryptHash("super-pass-123")}', 'Test Superadmin', 'superadmin', 'platform', false, now())`,
  );
  const superLogin = await api("/auth/login", {
    method: "POST",
    body: { email: superEmail, password: "super-pass-123" },
  });
  assert.equal(superLogin.status, 200, JSON.stringify(superLogin.json));

  // A regular user cannot mint reset links.
  const forbidden = await api("/admin/password-reset-link", {
    method: "POST",
    token: account.token,
    body: { email: account.email },
  });
  assert.equal(forbidden.status, 403);

  const link = await api("/admin/password-reset-link", {
    method: "POST",
    token: superLogin.json.token,
    body: { email: account.email },
  });
  assert.equal(link.status, 200, JSON.stringify(link.json));
  const resetToken = new URL(link.json.resetUrl).searchParams.get("token");
  assert.ok(resetToken, "reset link carries a token");

  const newPassword = "brand new password 456";
  const reset = await api("/auth/reset-password", {
    method: "POST",
    body: { token: resetToken, password: newPassword },
  });
  assert.equal(reset.status, 200);

  // The token is single-use.
  const replay = await api("/auth/reset-password", {
    method: "POST",
    body: { token: resetToken, password: "another password 789" },
  });
  assert.equal(replay.status, 400);

  assert.equal(
    (await api("/auth/login", { method: "POST", body: { email: account.email, password: account.password } })).status,
    401,
  );
  assert.equal(
    (await api("/auth/login", { method: "POST", body: { email: account.email, password: newPassword } })).status,
    200,
  );
});

test("passwords are stored as scrypt and legacy hashes verify once then upgrade", async () => {
  const account = await registerClinic("hashing");

  const stored = sql(`SELECT password_hash FROM users WHERE email = '${account.email}'`);
  assert.ok(stored.startsWith("scrypt$"), `expected scrypt hash, got ${stored.slice(0, 12)}...`);

  // Simulate a pre-hardening account: fixed-salt SHA-256 hash in the database.
  const legacyPassword = "legacy password 123";
  sql(`UPDATE users SET password_hash = '${legacySha256(legacyPassword)}' WHERE email = '${account.email}'`);

  const login = await api("/auth/login", {
    method: "POST",
    body: { email: account.email, password: legacyPassword },
  });
  assert.equal(login.status, 200, "legacy hash should still authenticate");

  const upgraded = sql(`SELECT password_hash FROM users WHERE email = '${account.email}'`);
  assert.ok(upgraded.startsWith("scrypt$"), "legacy hash should be upgraded to scrypt on login");

  assert.equal(
    (await api("/auth/login", { method: "POST", body: { email: account.email, password: "wrong password" } })).status,
    401,
  );
});

test("change-password verifies the current password and stores scrypt", async () => {
  const account = await registerClinic("changepass");

  const wrongCurrent = await api("/auth/change-password", {
    method: "POST",
    token: account.token,
    body: { currentPassword: "not the password", newPassword: "new password 999" },
  });
  assert.equal(wrongCurrent.status, 401);

  const newPassword = "new password 999";
  const changed = await api("/auth/change-password", {
    method: "POST",
    token: account.token,
    body: { currentPassword: account.password, newPassword },
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.json));

  const stored = sql(`SELECT password_hash FROM users WHERE email = '${account.email}'`);
  assert.ok(stored.startsWith("scrypt$"), "new password should be stored as scrypt");

  assert.equal(
    (await api("/auth/login", { method: "POST", body: { email: account.email, password: account.password } })).status,
    401,
  );
  assert.equal(
    (await api("/auth/login", { method: "POST", body: { email: account.email, password: newPassword } })).status,
    200,
  );
});
