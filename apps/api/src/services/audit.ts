import { getDb, schema, type Tx } from '@setrya/db';
import { randomUUID } from 'node:crypto';

import type { Cipher } from './crypto-ctx';

export interface AuditInput {
  projectId: string | null;
  eventType: string;
  objectType?: string;
  objectId?: string;
  diff?: unknown;
  reason?: string | null;
}

/** Append-only application accountability record. Business values go in the encrypted diff, never in clear. */
export async function audit(cipher: Cipher | null, actor: string, input: AuditInput, tx?: Tx): Promise<void> {
  const id = randomUUID();
  const db = tx ?? getDb();
  await db.insert(schema.auditEvents).values({
    id,
    projectId: input.projectId,
    actor,
    eventType: input.eventType,
    objectType: input.objectType ?? null,
    objectId: input.objectId ?? null,
    diffEnc: cipher && input.diff !== undefined ? cipher.encJson('audit_events', id, 'diff', input.diff) : null,
    reasonEnc: cipher && input.reason ? cipher.enc('audit_events', id, 'reason', input.reason) : null,
  });
}
