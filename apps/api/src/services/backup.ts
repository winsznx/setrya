import { getDb, schema } from '@setrya/db';
import { openJson, sealJson } from '@setrya/security';

/**
 * Encrypted backup of every Setrya table. Sensitive columns are already ciphertext under the vault key; the whole
 * file is additionally sealed with AES-256-GCM under a key derived from the backup password. Restoring needs the
 * file, its password, the host master key and the vault passphrase. Zcash wallet keys are never included.
 */

const TABLES = {
  system_settings: schema.systemSettings,
  owners: schema.owners,
  projects: schema.projects,
  sources: schema.sources,
  import_batches: schema.importBatches,
  revenue_entries: schema.revenueEntries,
  partners: schema.partners,
  partner_addresses: schema.partnerAddresses,
  agreements: schema.agreements,
  agreement_versions: schema.agreementVersions,
  fx_rate_snapshots: schema.fxRateSnapshots,
  periods: schema.periods,
  period_sources: schema.periodSources,
  period_decisions: schema.periodDecisions,
  calculation_rows: schema.calculationRows,
  period_exceptions: schema.periodExceptions,
  approvals: schema.approvals,
  payout_intents: schema.payoutIntents,
  payment_batches: schema.paymentBatches,
  chain_transactions: schema.chainTransactions,
  payment_outputs: schema.paymentOutputs,
  payment_attempts: schema.paymentAttempts,
  statements: schema.statements,
  statement_shares: schema.statementShares,
  recipient_acknowledgments: schema.recipientAcknowledgments,
  adjustments: schema.adjustments,
  audit_events: schema.auditEvents,
} as const;

export async function createBackup(password: string): Promise<Buffer> {
  const tables: Record<string, unknown[]> = {};
  for (const [name, table] of Object.entries(TABLES)) tables[name] = await getDb().select().from(table);
  return sealJson({ createdAt: new Date().toISOString(), tables }, password, 'setrya-backup');
}

export function openBackup(file: string, password: string): { createdAt: string; tables: Record<string, unknown[]> } {
  return openJson(file, password, 'setrya-backup');
}

export const BACKUP_TABLES = Object.keys(TABLES);
