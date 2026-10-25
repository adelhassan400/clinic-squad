import { createHash, randomBytes, randomUUID } from "node:crypto";

export const AUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface StoredAuthSession {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface AuthSessionStore {
  insert(session: StoredAuthSession): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<StoredAuthSession | null>;
  revokeById(id: string, revokedAt: Date): Promise<void>;
  revokeByUserId(userId: string, revokedAt: Date): Promise<void>;
}

export interface AuthSessionManager {
  issue(userId: string): Promise<string>;
  resolve(token: string): Promise<{ id: string; userId: string } | null>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createAuthSessionManager(
  store: AuthSessionStore,
  options: { ttlMs?: number; now?: () => Date } = {},
): AuthSessionManager {
  const ttlMs = options.ttlMs ?? AUTH_SESSION_TTL_MS;
  const now = options.now ?? (() => new Date());

  return {
    async issue(userId) {
      const token = randomBytes(32).toString("base64url");
      const createdAt = now();
      await store.insert({
        id: randomUUID(),
        userId,
        tokenHash: hashSessionToken(token),
        createdAt,
        expiresAt: new Date(createdAt.getTime() + ttlMs),
        revokedAt: null,
      });
      return token;
    },
    async resolve(token) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
      const session = await store.findByTokenHash(hashSessionToken(token));
      if (!session || session.revokedAt || session.expiresAt.getTime() <= now().getTime()) {
        return null;
      }
      return { id: session.id, userId: session.userId };
    },
    async revoke(id) {
      await store.revokeById(id, now());
    },
    async revokeAllForUser(userId) {
      await store.revokeByUserId(userId, now());
    },
  };
}
