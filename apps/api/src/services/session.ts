import { getDb, schema, eq, and, isNull, gt } from '@setrya/db';
import { randomToken, sha256 } from '@setrya/security';
import { requestCookies } from '../http/context';

import { Cipher } from './crypto-ctx';
import { takeKey } from './vault-store';

export const SESSION_COOKIE = 'setrya_session';
const SESSION_HOURS = 12;
const REMEMBER_DAYS = 7;

export interface OwnerSession {
  sessionId: string;
  ownerId: string;
  ownerName: string;
  timezone: string;
}

export interface UnlockedContext extends OwnerSession {
  cipher: Cipher;
}

export async function createSession(ownerId: string, authVersion: number, remember: boolean, userAgent: string | null): Promise<void> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + (remember ? REMEMBER_DAYS * 24 : SESSION_HOURS) * 3_600_000);
  await getDb().insert(schema.sessions).values({ ownerId, hashedToken: sha256(token), authVersion, expiresAt, userAgent: userAgent?.slice(0, 200) ?? null });
  requestCookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });
}

export async function readSession(): Promise<OwnerSession | null> {
  const token = requestCookies().get(SESSION_COOKIE);
  if (!token) return null;
  const db = getDb();
  const rows = await db
    .select({ id: schema.sessions.id, ownerId: schema.sessions.ownerId, authVersion: schema.sessions.authVersion, ownerAuthVersion: schema.owners.authVersion, name: schema.owners.displayName, timezone: schema.owners.timezone })
    .from(schema.sessions)
    .innerJoin(schema.owners, eq(schema.owners.id, schema.sessions.ownerId))
    .where(and(eq(schema.sessions.hashedToken, sha256(token)), isNull(schema.sessions.revokedAt), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || row.authVersion !== row.ownerAuthVersion) return null;
  return { sessionId: row.id, ownerId: row.ownerId, ownerName: row.name, timezone: row.timezone };
}

export async function revokeCurrentSession(): Promise<string | null> {
  const store = requestCookies();
  const token = store.get(SESSION_COOKIE);
  store.delete(SESSION_COOKIE);
  if (!token) return null;
  const [row] = await getDb().update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.hashedToken, sha256(token))).returning({ id: schema.sessions.id });
  return row?.id ?? null;
}

export function unlockedFrom(session: OwnerSession): UnlockedContext | null {
  const key = takeKey(session.sessionId);
  return key ? { ...session, cipher: new Cipher(key) } : null;
}
