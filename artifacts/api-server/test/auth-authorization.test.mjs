import assert from "node:assert/strict";
import test from "node:test";

process.env.SESSION_SECRET ??= "unit-test-session-secret-with-at-least-32-characters";
process.env.DATABASE_URL ??= "postgres://unused:unused@127.0.0.1:5432/unused";

const {
  createAuthToken,
  requireAuth,
  requireClinicAccess,
  requireRole,
  verifyAuthToken,
} = await import("../src/middlewares/auth.ts");

function request(authorization, authUser, params = {}) {
  return {
    headers: authorization ? { authorization } : {},
    authUser,
    params,
  };
}

function responseHarness() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

async function callMiddleware(middleware, req) {
  const res = responseHarness();
  let continued = false;
  await middleware(req, res, () => {
    continued = true;
  });
  return { res, continued };
}

test("new access tokens are signed and unsigned legacy tokens are rejected", () => {
  const token = createAuthToken("user-clinic-a");
  assert.equal(verifyAuthToken(token), "user-clinic-a");
  assert.equal(verifyAuthToken(Buffer.from("user-clinic-a:timestamp").toString("base64")), null);
});

test("tampered and expired access tokens are rejected", () => {
  const token = createAuthToken("user-clinic-a");
  const [version, payload, signature] = token.split(".");
  const tamperedPayload = Buffer.from(
    JSON.stringify({ sub: "user-clinic-b", iat: 1, exp: 4_000_000_000 }),
  ).toString("base64url");
  assert.equal(verifyAuthToken(`${version}.${tamperedPayload}.${signature}`), null);

  const originalNow = Date.now;
  try {
    Date.now = () => 1_700_000_000_000;
    const expired = createAuthToken("user-clinic-a");
    Date.now = () => 1_700_000_000_000 + 13 * 60 * 60 * 1000;
    assert.equal(verifyAuthToken(expired), null);
  } finally {
    Date.now = originalNow;
  }
});

test("authentication rejects absent and forged bearer credentials", async () => {
  const absent = await callMiddleware(requireAuth, request(null));
  assert.equal(absent.res.statusCode, 401);
  assert.equal(absent.continued, false);

  const forged = await callMiddleware(
    requireAuth,
    request(`Bearer ${Buffer.from("admin-id:forged").toString("base64")}`),
  );
  assert.equal(forged.res.statusCode, 401);
  assert.equal(forged.continued, false);
});

test("clinic access rejects a different tenant and preserves explicit superadmin scope", async () => {
  const clinicUser = {
    id: "user-a",
    email: "a@example.test",
    name: "Clinic A",
    role: "doctor",
    clinicId: "clinic-a",
  };
  const denied = await callMiddleware(
    requireClinicAccess,
    request(null, clinicUser, { clinicId: "clinic-b" }),
  );
  assert.equal(denied.res.statusCode, 403);
  assert.equal(denied.continued, false);

  const superadmin = {
    ...clinicUser,
    id: "platform-admin",
    role: "superadmin",
  };
  const allowed = await callMiddleware(
    requireClinicAccess,
    request(null, superadmin, { clinicId: "clinic-b" }),
  );
  assert.equal(allowed.continued, true);
});

test("role checks deny reception staff from manager operations and allow authorized roles", async () => {
  const deny = await callMiddleware(
    requireRole("admin", "doctor"),
    request(null, { id: "staff", role: "assistant", clinicId: "clinic-a" }),
  );
  assert.equal(deny.res.statusCode, 403);
  assert.equal(deny.continued, false);

  const allow = await callMiddleware(
    requireRole("admin", "doctor"),
    request(null, { id: "doctor", role: "doctor", clinicId: "clinic-a" }),
  );
  assert.equal(allow.continued, true);
});
