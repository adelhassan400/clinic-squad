import { and, eq, isNull } from "drizzle-orm";
import { authSessionsTable, db } from "@workspace/db";
import {
  createAuthSessionManager,
  type AuthSessionStore,
  type StoredAuthSession,
} from "./auth-session-manager";

export {
  AUTH_SESSION_TTL_MS,
  createAuthSessionManager,
  hashSessionToken,
} from "./auth-session-manager";
export type {
  AuthSessionManager,
  AuthSessionStore,
  StoredAuthSession,
} from "./auth-session-manager";

const databaseSessionStore: AuthSessionStore = {
  async insert(session) {
    await db.insert(authSessionsTable).values(session);
  },
  async findByTokenHash(tokenHash) {
    const rows = await db
      .select()
      .from(authSessionsTable)
      .where(eq(authSessionsTable.tokenHash, tokenHash))
      .limit(1);
    return rows[0] ?? null;
  },
  async revokeById(id, revokedAt) {
    await db
      .update(authSessionsTable)
      .set({ revokedAt })
      .where(and(eq(authSessionsTable.id, id), isNull(authSessionsTable.revokedAt)));
  },
  async revokeByUserId(userId, revokedAt) {
    await db
      .update(authSessionsTable)
      .set({ revokedAt })
      .where(and(eq(authSessionsTable.userId, userId), isNull(authSessionsTable.revokedAt)));
  },
};

export const authSessions = createAuthSessionManager(databaseSessionStore);
