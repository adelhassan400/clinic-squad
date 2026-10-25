import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  hashPassword,
  upgradeLegacyPassword,
  verifyPassword,
} from "../../lib/auth-password.mjs";
import {
  createAuthSessionManager,
  hashSessionToken,
} from "../../artifacts/api-server/src/lib/auth-session-manager.ts";

function legacyHash(password, encoding = "hex") {
  return createHash("sha256")
    .update(`${password}clinicsquad_salt`)
    .digest(encoding);
}

function createMemorySessionStore() {
  const rows = new Map();
  return {
    rows,
    async insert(session) {
      rows.set(session.tokenHash, { ...session });
    },
    async findByTokenHash(tokenHash) {
      return rows.get(tokenHash) ?? null;
    },
    async revokeById(id, revokedAt) {
      for (const session of rows.values()) {
        if (session.id === id && !session.revokedAt) session.revokedAt = revokedAt;
      }
    },
    async revokeByUserId(userId, revokedAt) {
      for (const session of rows.values()) {
        if (session.userId === userId && !session.revokedAt) session.revokedAt = revokedAt;
      }
    },
  };
}

test("scrypt password hashes use unique salts and verify only the right password", async () => {
  const password = "test-only-password";
  const firstHash = await hashPassword(password);
  const secondHash = await hashPassword(password);

  assert.equal(firstHash.startsWith("scrypt$16384$8$1$"), true);
  assert.equal(firstHash === secondHash, false);
  assert.equal((await verifyPassword(password, firstHash)).valid, true);
  assert.equal((await verifyPassword("wrong-test-password", firstHash)).valid, false);
});

test("legacy SHA-256 hashes verify in both historical formats and upgrade only on a match", async () => {
  const password = "legacy-test-password";
  const hexHash = legacyHash(password);
  const base64Hash = legacyHash(password, "base64");
  const hexResult = await verifyPassword(password, hexHash);
  const base64Result = await verifyPassword(password, base64Hash);
  let persistedHash = null;

  assert.equal(hexResult.valid && hexResult.needsUpgrade && hexResult.legacy, true);
  assert.equal(base64Result.valid && base64Result.needsUpgrade && base64Result.legacy, true);
  assert.equal(
    await upgradeLegacyPassword(password, hexHash, async (hash) => {
      persistedHash = hash;
    }),
    true,
  );
  assert.equal((await verifyPassword(password, persistedHash)).valid, true);
  assert.equal(
    await upgradeLegacyPassword("wrong-test-password", hexHash, async () => {
      throw new Error("Invalid passwords must not be persisted as upgrades");
    }),
    false,
  );
  assert.equal((await verifyPassword("wrong-test-password", base64Hash)).valid, false);
});

test("sessions are opaque, server-verifiable, expiring, and individually revocable", async () => {
  let currentTime = new Date("2026-01-01T00:00:00.000Z");
  const store = createMemorySessionStore();
  const sessions = createAuthSessionManager(store, {
    ttlMs: 1_000,
    now: () => new Date(currentTime),
  });

  const token = await sessions.issue("user-a");
  const stored = store.rows.get(hashSessionToken(token));
  const active = await sessions.resolve(token);
  const forgedLegacyToken = Buffer.from("user-a:9999999999999").toString("base64");

  assert.equal(/^[A-Za-z0-9_-]{43}$/.test(token), true);
  assert.equal(stored?.tokenHash === token, false);
  assert.equal(active?.userId === "user-a", true);
  assert.equal(await sessions.resolve(forgedLegacyToken) === null, true);

  await sessions.revoke(active.id);
  assert.equal(await sessions.resolve(token) === null, true);

  const expiringToken = await sessions.issue("user-b");
  currentTime = new Date(currentTime.getTime() + 1_001);
  assert.equal(await sessions.resolve(expiringToken) === null, true);
});

test("password reset revocation can invalidate every session for one user", async () => {
  const store = createMemorySessionStore();
  const sessions = createAuthSessionManager(store);
  const firstToken = await sessions.issue("user-a");
  const secondToken = await sessions.issue("user-a");
  const otherUserToken = await sessions.issue("user-b");

  await sessions.revokeAllForUser("user-a");

  assert.equal(await sessions.resolve(firstToken) === null, true);
  assert.equal(await sessions.resolve(secondToken) === null, true);
  assert.equal((await sessions.resolve(otherUserToken))?.userId === "user-b", true);
});
