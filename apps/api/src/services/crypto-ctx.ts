import { decryptField, encryptField, keyedHash } from '@setrya/security';

/** Field encryption bound to `table:rowId:column`, so ciphertext cannot be swapped between rows or columns. */
export class Cipher {
  constructor(private readonly key: Buffer) {}

  enc(table: string, id: string, column: string, value: string): string {
    return encryptField(this.key, value, `${table}:${id}:${column}`);
  }

  encOpt(table: string, id: string, column: string, value: string | null | undefined): string | null {
    return value === null || value === undefined || value === '' ? null : this.enc(table, id, column, value);
  }

  dec(table: string, id: string, column: string, value: string): string {
    return decryptField(this.key, value, `${table}:${id}:${column}`);
  }

  decOpt(table: string, id: string, column: string, value: string | null): string | null {
    return value === null ? null : this.dec(table, id, column, value);
  }

  encJson(table: string, id: string, column: string, value: unknown): string {
    return this.enc(table, id, column, JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
  }

  decJson<T>(table: string, id: string, column: string, value: string): T {
    return JSON.parse(this.dec(table, id, column, value)) as T;
  }

  hash(purpose: string, value: string): string {
    return keyedHash(this.key, purpose, value);
  }
}
