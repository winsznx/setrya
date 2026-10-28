import { agreementTermsSchema, CLASSIFICATIONS, ENTRY_TYPES, isValidTimeZone, MAPPABLE_FIELDS, startOfDayInZone } from '@setrya/domain';
import { z } from 'zod';

export const currencyCode = z.string().trim().toUpperCase().regex(/^[A-Z]{3,5}$/, 'Use a 3 to 5 letter currency code');
export const timezone = z.string().refine(isValidTimeZone, 'Choose a valid time zone');
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date');
export const uuid = z.string().uuid();
export const reason = z.string().trim().min(3, 'Give a short reason').max(500);
const optText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

export const projectSchema = z.object({
  orgName: z.string().trim().min(1, 'Enter the organisation name').max(120),
  name: z.string().trim().min(1, 'Enter a project name').max(120),
  issuerLabel: z.string().trim().min(1, 'Enter how statements should name the issuer').max(120),
  currency: z.enum(['USD', 'ZEC']),
  timezone,
  description: optText(500),
  contact: optText(200),
  logo: z.string().max(200_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Logo must be a PNG, JPEG or WebP image').optional().nullable(),
});

export const sourceSchema = z.object({
  name: z.string().trim().min(1, 'Name the source').max(120),
  platform: optText(120),
  note: optText(500),
  referenceUrl: z.string().trim().url('Enter a full URL').max(300).optional().nullable().or(z.literal('')).transform((v) => (v ? v : null)),
  defaultCurrency: currencyCode,
  feeType: z.enum(['realised_fee', 'gross_volume', 'other']),
  timezone,
  kind: z.enum(['csv', 'manual']),
});

export const partnerSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter a display name').max(120),
  shortRef: optText(40),
  contact: optText(200),
  notes: optText(2000),
  category: z.enum(['promoter', 'creator', 'contributor', 'other']),
  active: z.boolean(),
});

export const agreementSchema = z.object({
  partnerId: uuid,
  sourceIds: z.array(uuid).min(1, 'Choose at least one revenue source'),
  title: z.string().trim().min(1, 'Name the agreement').max(160),
  externalRef: optText(120),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.optional().nullable().or(z.literal('')).transform((v) => (v ? v : null)),
  terms: agreementTermsSchema,
  activate: z.boolean(),
  acknowledgeSnapshot: z.boolean(),
});

export const classificationSchema = z.object({
  entryIds: z.array(uuid).min(1).max(1000),
  classification: z.enum(CLASSIFICATIONS),
  type: z.enum(ENTRY_TYPES).nullable(),
  reason,
});

export const mappingSchema = z.object(Object.fromEntries(MAPPABLE_FIELDS.map((f) => [f, z.number().int().min(0).max(63).optional()])) as Record<(typeof MAPPABLE_FIELDS)[number], z.ZodOptional<z.ZodNumber>>);
export const normalizeSchema = z.object({ token: z.string().uuid(), sourceId: z.string().uuid(), mapping: mappingSchema, dateFormat: z.enum(['iso', 'mdy', 'dmy']), decimalSeparator: z.enum(['.', ',']), timeZone: timezone });


export const periodInputSchema = z.object({
  label: z.string().trim().min(1, 'Name the period').max(120),
  startDate: isoDate,
  endDate: isoDate,
  sourceIds: z.array(z.string().uuid()).min(1, 'Choose at least one source'),
  rateSnapshotIds: z.record(z.string(), z.string().uuid()).default({}),
});

/** The operator picks inclusive calendar dates; Setrya stores the half-open UTC range [start, day after end). */
export function periodRange(startDate: string, endDate: string, zone: string) {
  const startAt = startOfDayInZone(startDate, zone);
  const end = new Date(`${endDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const endAt = startOfDayInZone(end.toISOString().slice(0, 10), zone);
  return { startAt, endAt };
}
