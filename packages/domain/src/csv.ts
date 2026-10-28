/**
 * RFC 4180 CSV parsing with hard limits. The importer never evaluates cell content; formula-looking cells are kept
 * as text and neutralised again on export.
 */

export const CSV_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  maxRows: 20_000,
  maxColumns: 64,
  maxCellLength: 4_000,
} as const;

export class CsvError extends Error {
  constructor(
    readonly code: 'TOO_LARGE' | 'BAD_ENCODING' | 'TOO_MANY_ROWS' | 'TOO_MANY_COLUMNS' | 'CELL_TOO_LONG' | 'UNTERMINATED_QUOTE' | 'EMPTY',
    message: string,
  ) {
    super(message);
    this.name = 'CsvError';
  }
}

export interface ParsedCsv {
  delimiter: ',' | ';' | '\t';
  header: string[];
  rows: string[][];
  encoding: 'utf-8';
}

export function decodeCsvBytes(bytes: Uint8Array): string {
  if (bytes.byteLength > CSV_LIMITS.maxBytes) {
    throw new CsvError('TOO_LARGE', `File is larger than ${CSV_LIMITS.maxBytes / 1024 / 1024} MB`);
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new CsvError('BAD_ENCODING', 'File is not valid UTF-8. Export it again as UTF-8 CSV.');
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectDelimiter(text: string): ',' | ';' | '\t' {
  const firstLine = text.slice(0, text.search(/\r?\n/) === -1 ? undefined : text.search(/\r?\n/));
  const counts = { ',': 0, ';': 0, '\t': 0 } as Record<',' | ';' | '\t', number>;
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch as ',' | ';' | '\t'] += 1;
  }
  const best = (Object.entries(counts) as [',' | ';' | '\t', number][]).sort((a, b) => b[1] - a[1])[0];
  return best !== undefined && best[1] > 0 ? best[0] : ',';
}

export function parseCsv(text: string): ParsedCsv {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;

  const pushCell = () => {
    if (cell.length > CSV_LIMITS.maxCellLength) throw new CsvError('CELL_TOO_LONG', `A cell on row ${rows.length + 1} is too long`);
    row.push(cell);
    if (row.length > CSV_LIMITS.maxColumns) throw new CsvError('TOO_MANY_COLUMNS', `More than ${CSV_LIMITS.maxColumns} columns`);
    cell = '';
  };
  const pushRow = () => {
    pushCell();
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    if (rows.length > CSV_LIMITS.maxRows + 1) throw new CsvError('TOO_MANY_ROWS', `More than ${CSV_LIMITS.maxRows} rows`);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') inQuotes = true;
    else if (ch === delimiter) pushCell();
    else if (ch === '\n') pushRow();
    else if (ch === '\r') {
      if (text[i + 1] === '\n') i += 1;
      pushRow();
    } else cell += ch;
    i += 1;
  }
  if (inQuotes) throw new CsvError('UNTERMINATED_QUOTE', 'A quoted cell is never closed');
  if (cell !== '' || row.length > 0) pushRow();
  const [header, ...body] = rows;
  if (header === undefined || body.length === 0) throw new CsvError('EMPTY', 'The file has no data rows');
  return { delimiter, header: header.map((h) => h.trim()), rows: body, encoding: 'utf-8' };
}

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Escapes one cell for CSV export and neutralises spreadsheet formulas without changing numeric facts. */
export function csvCell(value: string | number | bigint | null | undefined, { numeric = false } = {}): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (!numeric && FORMULA_PREFIX.test(text)) text = `'${text}`;
  if (numeric && !/^-?\d+(\.\d+)?$/.test(text) && FORMULA_PREFIX.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: (string | number | bigint | null)[][], numericColumns: ReadonlySet<number> = new Set()): string {
  const lines = [header.map((h) => csvCell(h)).join(',')];
  for (const r of rows) lines.push(r.map((v, i) => csvCell(v, { numeric: numericColumns.has(i) })).join(','));
  return `${lines.join('\r\n')}\r\n`;
}
