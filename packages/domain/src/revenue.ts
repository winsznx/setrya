import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

import { type Dec, isNegative, MoneyError, parseDec } from './money';
import { type DateFormat, parseImportedDate } from './time';

export const ENTRY_TYPES = ['realised_fee', 'gross_volume', 'refund', 'chargeback', 'payout_adjustment', 'other'] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const CLASSIFICATIONS = ['eligible', 'excluded', 'held'] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  realised_fee: 'Realised fee',
  gross_volume: 'Gross volume',
  refund: 'Refund',
  chargeback: 'Chargeback',
  payout_adjustment: 'Payout adjustment',
  other: 'Other',
};

export const MAPPABLE_FIELDS = ['date', 'amount', 'currency', 'externalId', 'description', 'status', 'type', 'feePeriod', 'reference'] as const;
export type MappableField = (typeof MAPPABLE_FIELDS)[number];
export const REQUIRED_FIELDS: readonly MappableField[] = ['date', 'amount'];

export type ColumnMapping = Partial<Record<MappableField, number>>;

export interface NormalizeOptions {
  mapping: ColumnMapping;
  timeZone: string;
  dateFormat: DateFormat;
  decimalSeparator: '.' | ',';
  defaultCurrency: string;
  defaultType: EntryType;
  /** External IDs already stored for this source, hashed with the project key by the caller. */
  existingExternalIds: ReadonlySet<string>;
}

export type IssueCode =
  | 'MISSING_DATE'
  | 'INVALID_DATE'
  | 'INVALID_AMOUNT'
  | 'NEGATIVE_AMOUNT'
  | 'DUPLICATE_IN_FILE'
  | 'DUPLICATE_EXISTING'
  | 'VOLUME_MISLABELED'
  | 'GROSS_VOLUME'
  | 'REFUND_NEEDS_RULE'
  | 'MISSING_EXTERNAL_ID'
  | 'CURRENCY_INVALID'
  | 'CURRENCY_MISMATCH';

export const ISSUE_TEXT: Record<IssueCode, string> = {
  MISSING_DATE: 'Missing date',
  INVALID_DATE: 'Date could not be read',
  INVALID_AMOUNT: 'Amount is not a number',
  NEGATIVE_AMOUNT: 'Amount is negative',
  DUPLICATE_IN_FILE: 'Same external_id appears twice in this file',
  DUPLICATE_EXISTING: 'Potential duplicate external_id already imported',
  VOLUME_MISLABELED: 'Row looks like gross trading volume labelled as fees',
  GROSS_VOLUME: 'Gross volume is not fee revenue',
  REFUND_NEEDS_RULE: 'Refund needs a decision before it changes the fee base',
  MISSING_EXTERNAL_ID: 'No external_id, duplicates can only be flagged by content',
  CURRENCY_INVALID: 'Currency code is not recognised',
  CURRENCY_MISMATCH: 'Currency differs from the source default',
};

/** Issues that make a row unusable as money until the operator decides. */
const BLOCKING: ReadonlySet<IssueCode> = new Set([
  'MISSING_DATE',
  'INVALID_DATE',
  'INVALID_AMOUNT',
  'DUPLICATE_IN_FILE',
  'DUPLICATE_EXISTING',
  'VOLUME_MISLABELED',
  'REFUND_NEEDS_RULE',
  'CURRENCY_INVALID',
]);

export interface NormalizedRow {
  rowIndex: number;
  raw: Record<string, string>;
  rawHash: string;
  externalId: string | null;
  occurredAt: Date | null;
  amountRaw: string;
  amount: Dec | null;
  currency: string;
  description: string;
  reference: string;
  statusText: string;
  type: EntryType;
  issues: IssueCode[];
  suggested: Classification;
  suggestedNote: string;
  /** True when the row cannot be committed at all, e.g. no readable amount. */
  unusable: boolean;
}

const TYPE_WORDS: [RegExp, EntryType][] = [
  [/charge\s*back/i, 'chargeback'],
  [/refund|reversal|reversed/i, 'refund'],
  [/volume|gross|turnover|notional/i, 'gross_volume'],
  [/adjust/i, 'payout_adjustment'],
  [/fee|commission|revenue|earning|royalt/i, 'realised_fee'],
];

export function detectType(text: string, fallback: EntryType): EntryType {
  const trimmed = text.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if ((ENTRY_TYPES as readonly string[]).includes(trimmed)) return trimmed as EntryType;
  for (const [pattern, type] of TYPE_WORDS) if (pattern.test(text)) return type;
  return fallback;
}

export function parseAmountCell(text: string, decimalSeparator: '.' | ','): Dec {
  let t = text.trim();
  let negative = false;
  if (/^\(.*\)$/.test(t)) {
    negative = true;
    t = t.slice(1, -1);
  }
  t = t.replace(/^[A-Z]{3}\s*/i, '').replace(/\s*[A-Z]{3}$/i, '').replace(/[$€£¥ⓩ\s]/g, '');
  if (decimalSeparator === ',') t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(/,/g, '');
  if (t.startsWith('+')) t = t.slice(1);
  const value = parseDec(t, 8);
  return negative ? { units: -value.units, scale: value.scale } : value;
}

export function rowHash(cells: readonly string[]): string {
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify(cells))));
}

export function normalizeRows(header: readonly string[], rows: readonly string[][], options: NormalizeOptions): NormalizedRow[] {
  const { mapping } = options;
  const cell = (row: readonly string[], field: MappableField) => {
    const index = mapping[field];
    return index === undefined ? '' : (row[index] ?? '').trim();
  };
  const seenInFile = new Map<string, number>();
  for (const row of rows) {
    const id = cell(row, 'externalId');
    if (id !== '') seenInFile.set(id, (seenInFile.get(id) ?? 0) + 1);
  }

  return rows.map((row, rowIndex) => {
    const issues: IssueCode[] = [];
    const raw: Record<string, string> = {};
    header.forEach((h, i) => {
      raw[h || `column_${i + 1}`] = row[i] ?? '';
    });
    const dateText = cell(row, 'date');
    const occurredAt = dateText === '' ? null : parseImportedDate(dateText, options.timeZone, options.dateFormat);
    if (dateText === '') issues.push('MISSING_DATE');
    else if (occurredAt === null) issues.push('INVALID_DATE');

    const amountRaw = cell(row, 'amount');
    let amount: Dec | null = null;
    try {
      amount = parseAmountCell(amountRaw, options.decimalSeparator);
    } catch (error) {
      if (!(error instanceof MoneyError)) throw error;
      issues.push('INVALID_AMOUNT');
    }

    const currencyText = cell(row, 'currency').toUpperCase();
    const currency = currencyText === '' ? options.defaultCurrency : currencyText;
    if (!/^[A-Z]{3,5}$/.test(currency)) issues.push('CURRENCY_INVALID');
    else if (currency !== options.defaultCurrency) issues.push('CURRENCY_MISMATCH');

    const description = cell(row, 'description');
    const typeText = cell(row, 'type');
    let type = typeText === '' ? detectType(description, options.defaultType) : detectType(typeText, options.defaultType);
    if (type === 'realised_fee' && /volume|gross|notional|turnover/i.test(`${description} ${cell(row, 'reference')}`)) {
      issues.push('VOLUME_MISLABELED');
    }
    if (amount !== null && isNegative(amount)) {
      issues.push('NEGATIVE_AMOUNT');
      if (type === 'realised_fee') type = 'refund';
    }
    if (type === 'gross_volume') issues.push('GROSS_VOLUME');
    if (type === 'refund' || type === 'chargeback') issues.push('REFUND_NEEDS_RULE');

    const externalId = cell(row, 'externalId') || null;
    if (externalId === null) issues.push('MISSING_EXTERNAL_ID');
    else if ((seenInFile.get(externalId) ?? 0) > 1) issues.push('DUPLICATE_IN_FILE');
    else if (options.existingExternalIds.has(externalId)) issues.push('DUPLICATE_EXISTING');

    const unusable = amount === null;
    let suggested: Classification;
    let suggestedNote = '';
    if (unusable || issues.some((code) => BLOCKING.has(code))) {
      suggested = 'held';
      suggestedNote = issues.filter((code) => BLOCKING.has(code)).map((code) => ISSUE_TEXT[code]).join('; ');
    } else if (type === 'realised_fee') {
      suggested = 'eligible';
    } else {
      suggested = 'excluded';
      suggestedNote = type === 'gross_volume' ? ISSUE_TEXT.GROSS_VOLUME : `${ENTRY_TYPE_LABEL[type]} is not fee revenue by default`;
    }

    return {
      rowIndex,
      raw,
      rawHash: rowHash(row),
      externalId,
      occurredAt,
      amountRaw,
      amount,
      currency,
      description,
      reference: cell(row, 'reference'),
      statusText: cell(row, 'status'),
      type,
      issues,
      suggested,
      suggestedNote,
      unusable,
    };
  });
}

/** Header names that map to a field without the operator touching the selector. Still shown for review. */
const HEADER_GUESSES: Record<MappableField, RegExp> = {
  date: /^(occurred_?at|date|timestamp|time|created_?at)$/i,
  amount: /^(amount|value|fee|fees|net_?fee|net)$/i,
  currency: /^(currency|ccy|asset)$/i,
  externalId: /^(external_?id|id|tx_?id|transaction_?id|ref_?id)$/i,
  description: /^(description|memo|note|details)$/i,
  status: /^(status|state)$/i,
  type: /^(fee_?type|type|category|kind)$/i,
  feePeriod: /^(fee_?period|period)$/i,
  reference: /^(source_?reference|reference|ref)$/i,
};

export function guessMapping(header: readonly string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const field of MAPPABLE_FIELDS) {
    const index = header.findIndex((h) => HEADER_GUESSES[field].test(h.trim()));
    if (index !== -1 && !Object.values(mapping).includes(index)) mapping[field] = index;
  }
  return mapping;
}

export const IMPORT_TEMPLATE_HEADER = ['external_id', 'occurred_at', 'description', 'amount', 'currency', 'fee_type', 'status', 'source_reference'] as const;
