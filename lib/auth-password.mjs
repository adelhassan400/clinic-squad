import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_PASSWORD_BYTES = 4_096;
const SCRYPT_MAX_MEMORY = 32 * 1024 * 1024;
const LEGACY_SALT = "clinicsquad_salt";

function equalBuffers(left, right) {
  return left.length === right.length && timingSafeEqual(left, right);
}

function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const decoded = Buffer.from(value, "base64url");
  return decoded.toString("base64url") === value ? decoded : null;
}

function legacyHashMatches(password, storedHash) {
  const digest = createHash("sha256")
    .update(password + LEGACY_SALT)
    .digest();
  return (
    equalBuffers(Buffer.from(storedHash, "utf8"), Buffer.from(digest.toString("hex"), "utf8")) ||
    equalBuffers(Buffer.from(storedHash, "utf8"), Buffer.from(digest.toString("base64"), "utf8"))
  );
}

/**
 * Hashes a password using Node's scrypt implementation with a unique random salt.
 * The encoded format includes fixed, validated work parameters for safe verification.
 */
export async function hashPassword(password) {
  if (typeof password !== "string" || Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    throw new RangeError("Password exceeds the supported size");
  }

  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAX_MEMORY,
  });

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    Buffer.from(derivedKey).toString("base64url"),
  ].join("$");
}

/**
 * Verifies current scrypt hashes and the historical fixed-salt SHA-256 formats.
 * Legacy matches are marked for an immediate login-time upgrade.
 */
export async function verifyPassword(password, storedHash) {
  if (
    typeof password !== "string" ||
    typeof storedHash !== "string" ||
    Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES
  ) {
    return { valid: false, needsUpgrade: false, legacy: false };
  }

  const parts = storedHash.split("$");
  if (parts[0] === "scrypt") {
    if (
      parts.length !== 6 ||
      parts[1] !== String(SCRYPT_N) ||
      parts[2] !== String(SCRYPT_R) ||
      parts[3] !== String(SCRYPT_P)
    ) {
      return { valid: false, needsUpgrade: false, legacy: false };
    }
    const salt = decodeBase64Url(parts[4]);
    const expected = decodeBase64Url(parts[5]);
    if (!salt || salt.length !== SALT_LENGTH || !expected || expected.length !== KEY_LENGTH) {
      return { valid: false, needsUpgrade: false, legacy: false };
    }
    const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAX_MEMORY,
    });
    return {
      valid: equalBuffers(Buffer.from(derivedKey), expected),
      needsUpgrade: false,
      legacy: false,
    };
  }

  if (storedHash.length !== 64 && storedHash.length !== 44) {
    return { valid: false, needsUpgrade: false, legacy: false };
  }
  const valid = legacyHashMatches(password, storedHash);
  return { valid, needsUpgrade: valid, legacy: true };
}

/**
 * Upgrades a verified legacy hash only after the caller has accepted the login.
 */
export async function upgradeLegacyPassword(password, storedHash, persistHash) {
  const verification = await verifyPassword(password, storedHash);
  if (!verification.valid || !verification.needsUpgrade) return false;
  await persistHash(await hashPassword(password));
  return true;
}
