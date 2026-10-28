// Restores an encrypted Setrya backup into a fresh, migrated, empty database.
// Usage: pnpm --filter @setrya/web restore-backup <file>. The same master key file must be configured,
// and the vault passphrase from backup time unlocks the restored data afterwards.
import { getDb, schema, sql } from '@setrya/db';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

import { openJson } from '@setrya/security';

const ORDER: [string, keyof typeof schema][] = [
  ['system_settings', 'systemSettings'], ['owners', 'owners'], ['projects', 'projects'], ['sources', 'sources'], ['import_batches', 'importBatches'],
  ['revenue_entries', 'revenueEntries'], ['partners', 'partners'], ['partner_addresses', 'partnerAddresses'], ['agreements', 'agreements'],
  ['agreement_versions', 'agreementVersions'], ['fx_rate_snapshots', 'fxRateSnapshots'], ['periods', 'periods'], ['period_sources', 'periodSources'],
  ['period_decisions', 'periodDecisions'], ['calculation_rows', 'calculationRows'], ['period_exceptions', 'periodExceptions'], ['approvals', 'approvals'],
  ['payment_batches', 'paymentBatches'], ['payout_intents', 'payoutIntents'], ['chain_transactions', 'chainTransactions'], ['payment_outputs', 'paymentOutputs'],
  ['payment_attempts', 'paymentAttempts'], ['statements', 'statements'], ['statement_shares', 'statementShares'], ['recipient_acknowledgments', 'recipientAcknowledgments'],
  ['adjustments', 'adjustments'], ['audit_events', 'auditEvents'],
];

const path = process.argv[2];
if (!path) throw new Error('Pass the backup file path');
const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question('Backup password: ');
rl.close();
const backup = openJson<{ createdAt: string; tables: Record<string, unknown[]> }>(readFileSync(path, 'utf8'), password, 'setrya-backup');
const db = getDb();
const [{ n }] = (await db.execute(sql`select count(*)::int as n from owners`)) as unknown as [{ n: number }];
if (n > 0) throw new Error('Refusing to restore into a database that already has an owner. Use a fresh, migrated database.');
await db.transaction(async (tx) => {
  for (const [name, key] of ORDER) {
    const rows = (backup.tables[name] ?? []).map((r) => Object.fromEntries(Object.entries(r as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v) : v])));
    for (let i = 0; i < rows.length; i += 500) await tx.insert(schema[key] as never).values(rows.slice(i, i + 500) as never);
    console.log(`${name}: ${rows.length}`);
  }
});
console.log('Restore complete. Start Setrya, sign in, and unlock with the vault passphrase from backup time.');
console.log('Then let the wallet reconcile every submitted or unknown transaction before preparing anything new.');
process.exit(0);
