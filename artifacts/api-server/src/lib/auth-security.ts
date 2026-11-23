import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

/**
 * Bearer tokens are HMAC-SHA256 signed payloads with an explicit expiry.
 * AUTH_TOKEN_SECRET (at least 32 characters) signs them; it is required in
 * production. Outside production a fixed development secret is used so
 * logins keep working across local restarts.
 */
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEV_TOKEN_SECRET = "clinicsquad-dev-only-token-secret-not-for-production";

function tokenSecret(): string {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_TOKEN_SECRET must be set to at least 32 characters when NODE_ENV=production",
    );
  }
  return DEV_TOKEN_SECRET;
}

if (process.env.NODE_ENV === "production") {
  // Fail fast at startup instead of on the first authenticated request.
  tokenSecret();
}

function signPayload(payloadB64: string): string {
  return createHmac("sha256", tokenSecret()).update(payloadB64).digest("base64url");
}

export function generateToken(userId: string): string {
  const now = Date.now();
  const payloadB64 = Buffer.from(
    JSON.stringify({ sub: userId, iat: now, exp: now + TOKEN_TTL_MS }),
  ).toString("base64url");
  return `${payloadB64}.${signPayload(payloadB64)}`;
}

/** Returns the authenticated user id, or null when the token is invalid or expired. */
export function verifyToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const signature = Buffer.from(token.slice(dot + 1), "utf8");
  const expected = Buffer.from(signPayload(payloadB64), "utf8");
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
      sub?: unknown;
      exp?: unknown;
    };
    if (typeof payload.sub !== "string" || payload.sub.length === 0) return null;
    if (typeof payload.exp !== "number" || payload.exp <= Date.now()) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

/** SHA-256 hash used to store one-time tokens (reset / verification) at rest. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Passwords are hashed with scrypt and a per-password random salt, stored as
 * `scrypt$<salt-hex>$<hash-hex>`. The previous scheme (unsalted-per-user
 * SHA-256 with a fixed application salt) is still accepted on login so
 * existing accounts keep working, and those hashes are upgraded to scrypt on
 * the next successful login.
 */
const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = { N: 16384, r: 8, p: 1 };
const SCRYPT_PREFIX = "scrypt";
const LEGACY_SHA256_SALT = "clinicsquad_salt";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN, SCRYPT_COST)) as Buffer;
  return `${SCRYPT_PREFIX}$${salt}$${derived.toString("hex")}`;
}

export function isLegacyPasswordHash(stored: string): boolean {
  return !stored.startsWith(`${SCRYPT_PREFIX}$`);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (isLegacyPasswordHash(stored)) {
    const legacy = createHash("sha256").update(password + LEGACY_SHA256_SALT).digest("hex");
    const candidate = Buffer.from(legacy, "utf8");
    const expected = Buffer.from(stored, "utf8");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  }
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const [, salt, hash] = parts;
  try {
    const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN, SCRYPT_COST)) as Buffer;
    const expected = Buffer.from(hash, "hex");
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
