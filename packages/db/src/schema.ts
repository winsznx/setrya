import { sql } from 'drizzle-orm';
import { bigint, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Columns ending in `_enc` hold AES-256-GCM ciphertext (packages/security encryptField) bound to `table:id:column`.
 * Money: decimal strings for source currencies, bigint zatoshis for ZEC. Timestamps are UTC.
 */

const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const zat = (name: string) => bigint(name, { mode: 'bigint' });

export const systemSettings = pgTable('system_settings', {
  id: integer('id').primaryKey().default(1),
  vaultSalt: text('vault_salt'),
  vaultWrappedDek: text('vault_wrapped_dek'),
  vaultVersion: integer('vault_version'),
  setupTokenHash: text('setup_token_hash'),
  autoLockMinutes: integer('auto_lock_minutes').notNull().default(15),
  network: text('network'),
  updatedAt: updatedAt(),
});

export const owners = pgTable('owners', {
  id: id(),
  emailNormalized: text('email_normalized').notNull(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  authVersion: integer('auth_version').notNull().default(1),
  timezone: text('timezone').notNull().default('UTC'),
  singleton: boolean('singleton').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex('owners_singleton').on(t.singleton)]);

export const sessions = pgTable('sessions', {
  id: id(),
  ownerId: uuid('owner_id').notNull().references(() => owners.id),
  hashedToken: text('hashed_token').notNull().unique(),
  authVersion: integer('auth_version').notNull(),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const loginAttempts = pgTable('login_attempts', {
  id: id(),
  bucket: text('bucket').notNull(),
  createdAt: createdAt(),
}, (t) => [index('login_attempts_bucket').on(t.bucket, t.createdAt)]);

export const stepUpTokens = pgTable('step_up_tokens', {
  id: id(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id),
  hashedToken: text('hashed_token').notNull().unique(),
  action: text('action').notNull(),
  scopeDigest: text('scope_digest').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const projects = pgTable('projects', {
  id: id(),
  ownerId: uuid('owner_id').notNull().references(() => owners.id),
  nameEnc: text('name_enc').notNull(),
  orgNameEnc: text('org_name_enc').notNull(),
  issuerLabelEnc: text('issuer_label_enc').notNull(),
  descriptionEnc: text('description_enc'),
  contactEnc: text('contact_enc'),
  logoEnc: text('logo_enc'),
  currency: text('currency').notNull(),
  timezone: text('timezone').notNull(),
  cadence: text('cadence').notNull().default('monthly'),
  minConfirmations: integer('min_confirmations').notNull().default(1),
  targetConfirmations: integer('target_confirmations').notNull().default(3),
  rateExpiryHours: integer('rate_expiry_hours').notNull().default(72),
  stepUpWindowSeconds: integer('step_up_window_seconds').notNull().default(300),
  maxRecipientsPerBatch: integer('max_recipients_per_batch').notNull().default(10),
  minPayoutZat: zat('min_payout_zat').notNull().default(sql`10000`),
  shareExpiryDays: integer('share_expiry_days').notNull().default(14),
  revealTimeoutSeconds: integer('reveal_timeout_seconds').notNull().default(30),
  defaultClassification: text('default_classification').notNull().default('realised_fee'),
  onboardingStep: text('onboarding_step').notNull().default('workspace'),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sources = pgTable('sources', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  nameEnc: text('name_enc').notNull(),
  platformEnc: text('platform_enc'),
  noteEnc: text('note_enc'),
  referenceUrlEnc: text('reference_url_enc'),
  defaultCurrency: text('default_currency').notNull(),
  feeType: text('fee_type').notNull(),
  timezone: text('timezone').notNull(),
  kind: text('kind').notNull().default('csv'),
  enabled: boolean('enabled').notNull().default(true),
  version: integer('version').notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const importBatches = pgTable('import_batches', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  sourceId: uuid('source_id').notNull().references(() => sources.id),
  fileHash: text('file_hash').notNull(),
  filenameEnc: text('filename_enc').notNull(),
  mappingEnc: text('mapping_enc').notNull(),
  status: text('status').notNull(),
  rowCount: integer('row_count').notNull(),
  eligibleCount: integer('eligible_count').notNull(),
  heldCount: integer('held_count').notNull(),
  excludedCount: integer('excluded_count').notNull(),
  duplicateCount: integer('duplicate_count').notNull(),
  duplicatePolicy: text('duplicate_policy').notNull(),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidReasonEnc: text('void_reason_enc'),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('import_batches_fingerprint').on(t.projectId, t.sourceId, t.fileHash)]);

export const revenueEntries = pgTable('revenue_entries', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  batchId: uuid('batch_id').references(() => importBatches.id),
  sourceId: uuid('source_id').notNull().references(() => sources.id),
  externalIdHash: text('external_id_hash'),
  rawFieldsEnc: text('raw_fields_enc').notNull(),
  descriptionEnc: text('description_enc'),
  referenceEnc: text('reference_enc'),
  amountDecimal: text('amount_decimal').notNull(),
  amountRaw: text('amount_raw').notNull(),
  currency: text('currency').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  entryType: text('entry_type').notNull(),
  classification: text('classification').notNull(),
  issues: jsonb('issues').$type<string[]>().notNull().default([]),
  noteEnc: text('note_enc'),
  rowHash: text('row_hash').notNull(),
  rowIndex: integer('row_index'),
  origin: text('origin').notNull().default('csv'),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index('revenue_entries_project_time').on(t.projectId, t.occurredAt), index('revenue_entries_external').on(t.sourceId, t.externalIdHash)]);

export const partners = pgTable('partners', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  displayNameEnc: text('display_name_enc').notNull(),
  shortRefEnc: text('short_ref_enc'),
  contactEnc: text('contact_enc'),
  notesEnc: text('notes_enc'),
  category: text('category').notNull(),
  active: boolean('active').notNull().default(true),
  latestAddressVersion: integer('latest_address_version').notNull().default(0),
  version: integer('version').notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const partnerAddresses = pgTable('partner_addresses', {
  id: id(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  version: integer('version').notNull(),
  network: text('network').notNull(),
  addressEnc: text('address_enc').notNull(),
  fingerprint: text('fingerprint').notNull(),
  assessment: jsonb('assessment').notNull(),
  ownerConfirmedAt: timestamp('owner_confirmed_at', { withTimezone: true }),
  changeReasonEnc: text('change_reason_enc'),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull().defaultNow(),
  retiredAt: timestamp('retired_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('partner_addresses_version').on(t.partnerId, t.version)]);

export const agreements = pgTable('agreements', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  sourceIds: jsonb('source_ids').$type<string[]>().notNull(),
  titleEnc: text('title_enc').notNull(),
  externalRefEnc: text('external_ref_enc'),
  currentVersion: integer('current_version').notNull().default(0),
  status: text('status').notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const agreementVersions = pgTable('agreement_versions', {
  id: id(),
  agreementId: uuid('agreement_id').notNull().references(() => agreements.id),
  version: integer('version').notNull(),
  status: text('status').notNull(),
  termsEnc: text('terms_enc').notNull(),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  reasonEnc: text('reason_enc'),
  createdBy: uuid('created_by').notNull().references(() => owners.id),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  supersededAt: timestamp('superseded_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('agreement_versions_number').on(t.agreementId, t.version)]);

export const fxRateSnapshots = pgTable('fx_rate_snapshots', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  base: text('base').notNull(),
  quote: text('quote').notNull(),
  numerator: text('numerator').notNull(),
  denominator: text('denominator').notNull(),
  enteredAs: text('entered_as').notNull(),
  sourceEnc: text('source_enc').notNull(),
  quotedAt: timestamp('quoted_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  intendedConversionAt: timestamp('intended_conversion_at', { withTimezone: true }),
  approvedBy: uuid('approved_by').references(() => owners.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const periods = pgTable('periods', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  labelEnc: text('label_enc').notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  sourceIds: jsonb('source_ids').$type<string[]>().notNull(),
  rateSnapshotIds: jsonb('rate_snapshot_ids').$type<Record<string, string>>().notNull().default({}),
  status: text('status').notNull(),
  revision: integer('revision').notNull().default(1),
  totalsJson: jsonb('totals_json'),
  frozenSnapshotEnc: text('frozen_snapshot_enc'),
  frozenSnapshotHash: text('frozen_snapshot_hash'),
  frozenAt: timestamp('frozen_at', { withTimezone: true }),
  approvedSnapshotId: uuid('approved_snapshot_id'),
  calculatedAt: timestamp('calculated_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closeRecordEnc: text('close_record_enc'),
  version: integer('version').notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const periodSources = pgTable('period_sources', {
  periodId: uuid('period_id').notNull().references(() => periods.id),
  revenueEntryId: uuid('revenue_entry_id').notNull().references(() => revenueEntries.id),
  inclusion: text('inclusion').notNull(),
  reasonEnc: text('reason_enc'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.periodId, t.revenueEntryId] })]);

export const calculationRows = pgTable('calculation_rows', {
  id: id(),
  periodId: uuid('period_id').notNull().references(() => periods.id),
  revision: integer('revision').notNull(),
  rowKey: text('row_key').notNull(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  agreementId: uuid('agreement_id').notNull().references(() => agreements.id),
  agreementVersionId: uuid('agreement_version_id').notNull().references(() => agreementVersions.id),
  sourceIdsHash: text('source_ids_hash').notNull(),
  sourceEntryIds: jsonb('source_entry_ids').$type<string[]>().notNull(),
  formulaEnc: text('formula_enc').notNull(),
  owedDecimal: text('owed_decimal').notNull(),
  currency: text('currency').notNull(),
  amountZat: zat('amount_zat'),
  residualZat: text('residual_zat'),
  rateSnapshotId: uuid('rate_snapshot_id'),
  status: text('status').notNull(),
  holds: jsonb('holds').$type<{ code: string; detail?: string }[]>().notNull().default([]),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('calculation_rows_key').on(t.periodId, t.revision, t.rowKey)]);

export const periodExceptions = pgTable('period_exceptions', {
  id: id(),
  periodId: uuid('period_id').notNull().references(() => periods.id),
  revision: integer('revision').notNull(),
  key: text('key').notNull(),
  code: text('code').notNull(),
  severity: text('severity').notNull(),
  affectedEntryIds: jsonb('affected_entry_ids').$type<string[]>().notNull(),
  affectedRowKeys: jsonb('affected_row_keys').$type<string[]>().notNull(),
  partnerId: uuid('partner_id'),
  moneyAtRiskEnc: text('money_at_risk_enc'),
  detail: text('detail').notNull(),
  status: text('status').notNull().default('open'),
  decision: text('decision'),
  beforeAfterEnc: text('before_after_enc'),
  reasonEnc: text('reason_enc'),
  resolvedBy: uuid('resolved_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('period_exceptions_key').on(t.periodId, t.revision, t.key)]);

/** Operator decisions that persist across recalculation of the same revision. */
export const periodDecisions = pgTable('period_decisions', {
  id: id(),
  periodId: uuid('period_id').notNull().references(() => periods.id),
  revision: integer('revision').notNull(),
  kind: text('kind').notNull(),
  targetKey: text('target_key').notNull(),
  reasonEnc: text('reason_enc').notNull(),
  decidedBy: uuid('decided_by').notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('period_decisions_target').on(t.periodId, t.revision, t.kind, t.targetKey)]);

export const approvals = pgTable('approvals', {
  id: id(),
  periodId: uuid('period_id').notNull().references(() => periods.id),
  revision: integer('revision').notNull(),
  snapshotHash: text('snapshot_hash').notNull(),
  snapshotEnc: text('snapshot_enc').notNull(),
  recipientsDigest: text('recipients_digest').notNull(),
  approvedBy: uuid('approved_by').notNull().references(() => owners.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }).notNull().defaultNow(),
  network: text('network').notNull(),
  accountId: text('account_id').notNull(),
  totalZat: zat('total_zat').notNull(),
  invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
  invalidationReason: text('invalidation_reason'),
}, (t) => [uniqueIndex('approvals_period_revision').on(t.periodId, t.revision)]);

export const payoutIntents = pgTable('payout_intents', {
  id: id(),
  approvalId: uuid('approval_id').notNull().references(() => approvals.id),
  periodId: uuid('period_id').notNull().references(() => periods.id),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  calculationRowId: uuid('calculation_row_id').notNull().references(() => calculationRows.id),
  batchId: uuid('batch_id'),
  addressVersionId: uuid('address_version_id').notNull().references(() => partnerAddresses.id),
  addressFingerprint: text('address_fingerprint').notNull(),
  amountZat: zat('amount_zat').notNull(),
  memoRef: text('memo_ref').notNull(),
  state: text('state').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  chainTransactionId: uuid('chain_transaction_id'),
  disposition: text('disposition'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const paymentBatches = pgTable('payment_batches', {
  id: id(),
  approvalId: uuid('approval_id').notNull().references(() => approvals.id),
  sequence: integer('sequence').notNull(),
  of: integer('of').notNull(),
  network: text('network').notNull(),
  payerAccountId: text('payer_account_id').notNull(),
  status: text('status').notNull(),
  totalZat: zat('total_zat').notNull(),
  feeZat: zat('fee_zat'),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex('payment_batches_sequence').on(t.approvalId, t.sequence)]);

export const chainTransactions = pgTable('chain_transactions', {
  id: id(),
  batchId: uuid('batch_id').notNull().references(() => paymentBatches.id),
  lineage: integer('lineage').notNull().default(1),
  txid: text('txid'),
  network: text('network').notNull(),
  state: text('state').notNull(),
  pcztEnc: text('pczt_enc'),
  pcztHash: text('pczt_hash'),
  inspectionEnc: text('inspection_enc'),
  signedHexEnc: text('signed_hex_enc'),
  feeZat: zat('fee_zat'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  diagnosis: text('diagnosis'),
  broadcastAt: timestamp('broadcast_at', { withTimezone: true }),
  minedAt: timestamp('mined_at', { withTimezone: true }),
  height: integer('height'),
  blockhash: text('blockhash'),
  confirmations: integer('confirmations').notNull().default(0),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  walletObservedAt: timestamp('wallet_observed_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex('chain_transactions_txid').on(t.network, t.txid), uniqueIndex('chain_transactions_lineage').on(t.batchId, t.lineage)]);

export const paymentOutputs = pgTable('payment_outputs', {
  id: id(),
  chainTransactionId: uuid('chain_transaction_id').notNull().references(() => chainTransactions.id),
  payoutIntentId: uuid('payout_intent_id').notNull().references(() => payoutIntents.id),
  outputRef: text('output_ref').notNull(),
  amountZat: zat('amount_zat').notNull(),
  recipientCommitment: text('recipient_commitment').notNull(),
}, (t) => [uniqueIndex('payment_outputs_intent').on(t.chainTransactionId, t.payoutIntentId)]);

export const paymentAttempts = pgTable('payment_attempts', {
  id: id(),
  batchId: uuid('batch_id').notNull().references(() => paymentBatches.id),
  chainTransactionId: uuid('chain_transaction_id'),
  stage: text('stage').notNull(),
  outcome: text('outcome').notNull(),
  requestId: text('request_id').notNull(),
  detail: text('detail'),
  errorCode: text('error_code'),
  createdAt: createdAt(),
}, (t) => [index('payment_attempts_batch').on(t.batchId, t.createdAt)]);

export const statements = pgTable('statements', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  periodId: uuid('period_id').notNull().references(() => periods.id),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  payoutIntentId: uuid('payout_intent_id').references(() => payoutIntents.id),
  reference: text('reference').notNull().unique(),
  documentVersion: integer('document_version').notNull().default(1),
  snapshotEnc: text('snapshot_enc').notNull(),
  evidenceLevel: text('evidence_level').notNull(),
  downloadedAt: timestamp('downloaded_at', { withTimezone: true }),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('statements_period_partner').on(t.periodId, t.partnerId)]);

export const statementShares = pgTable('statement_shares', {
  id: id(),
  statementId: uuid('statement_id').notNull().references(() => statements.id),
  shareId: text('share_id').notNull().unique(),
  ciphertext: text('ciphertext'),
  documentVersion: integer('document_version').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  purgedAt: timestamp('purged_at', { withTimezone: true }),
  accessCount: integer('access_count').notNull().default(0),
  createdAt: createdAt(),
});

export const recipientAcknowledgments = pgTable('recipient_acknowledgments', {
  id: id(),
  statementShareId: uuid('statement_share_id').notNull().references(() => statementShares.id),
  kind: text('kind').notNull(),
  evidenceType: text('evidence_type').notNull(),
  encryptedMessage: text('encrypted_message'),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('recipient_ack_share').on(t.statementShareId)]);

export const adjustments = pgTable('adjustments', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  originPeriodId: uuid('origin_period_id').notNull().references(() => periods.id),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  calculationRowId: uuid('calculation_row_id'),
  kind: text('kind').notNull(),
  amountDecimal: text('amount_decimal').notNull(),
  currency: text('currency').notNull(),
  reasonEnc: text('reason_enc').notNull(),
  appliedPeriodId: uuid('applied_period_id'),
  createdAt: createdAt(),
});

export const auditEvents = pgTable('audit_events', {
  id: id(),
  projectId: uuid('project_id'),
  actor: text('actor').notNull(),
  eventType: text('event_type').notNull(),
  objectType: text('object_type'),
  objectId: text('object_id'),
  diffEnc: text('diff_enc'),
  reasonEnc: text('reason_enc'),
  createdAt: createdAt(),
}, (t) => [index('audit_events_project_time').on(t.projectId, t.createdAt)]);

export const backgroundJobs = pgTable('background_jobs', {
  id: id(),
  type: text('type').notNull(),
  key: text('key').notNull().unique(),
  payload: jsonb('payload').notNull(),
  state: text('state').notNull(),
  leaseUntil: timestamp('lease_until', { withTimezone: true }),
  attemptCounter: integer('attempt_counter').notNull().default(0),
  lastErrorRedacted: text('last_error_redacted'),
  runAfter: timestamp('run_after', { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const walletObservations = pgTable('wallet_observations', {
  id: integer('id').primaryKey().default(1),
  healthJson: jsonb('health_json'),
  observedAt: timestamp('observed_at', { withTimezone: true }),
});
