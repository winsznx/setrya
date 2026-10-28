/**
 * Unlocked data keys, in process memory only, keyed by session id. Locking, sign-out, idle expiry and process
 * restart all drop the key; nothing here is ever written to disk or sent to the browser.
 */

interface Entry {
  dek: Buffer;
  lastUsed: number;
  idleMs: number;
  /** Absolute end of the unlock, however active the session. Infinity unless a cap applies. */
  expiresAt: number;
}

const store: Map<string, Entry> = ((globalThis as { setryaVault?: Map<string, Entry> }).setryaVault ??= new Map());

export function putKey(sessionId: string, dek: Buffer, idleMinutes: number, maxLifetimeMs = Infinity): void {
  const now = Date.now();
  store.set(sessionId, { dek, lastUsed: now, idleMs: idleMinutes * 60_000, expiresAt: now + maxLifetimeMs });
}

export function takeKey(sessionId: string): Buffer | null {
  const entry = store.get(sessionId);
  if (!entry) return null;
  if (Date.now() - entry.lastUsed > entry.idleMs || Date.now() > entry.expiresAt) {
    dropKey(sessionId);
    return null;
  }
  entry.lastUsed = Date.now();
  return entry.dek;
}

export function dropKey(sessionId: string): void {
  const entry = store.get(sessionId);
  if (entry) entry.dek.fill(0);
  store.delete(sessionId);
}

export function dropAllKeys(): void {
  for (const id of [...store.keys()]) dropKey(id);
}

/** Every currently unlocked key, for durable jobs that must find the one that opens their stored data. */
export function unlockedKeys(): Buffer[] {
  const keys: Buffer[] = [];
  for (const [id] of [...store]) {
    const key = takeKey(id);
    if (key) keys.push(key);
  }
  return keys;
}
