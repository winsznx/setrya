import { describe, expect, it } from 'vitest';

import { createVault, DecryptError, decryptField, encryptField, redact, rewrapVault, unwrapVault } from '../src';
import { randomBytes } from 'node:crypto';

const master = randomBytes(32);

describe('field encryption', () => {
  it('round trips and binds associated data', () => {
    const key = randomBytes(32);
    const ct = encryptField(key, 'Partner A', 'partners:1:name');
    expect(decryptField(key, ct, 'partners:1:name')).toBe('Partner A');
    expect(() => decryptField(key, ct, 'partners:2:name')).toThrow(DecryptError);
  });
  it('detects tampering (P07)', () => {
    const key = randomBytes(32);
    const ct = encryptField(key, 'x', 'a');
    const parts = ct.split('.');
    const body = Buffer.from(parts[2]!, 'base64url');
    body[0] = body[0]! ^ 1;
    expect(() => decryptField(key, `${parts[0]}.${parts[1]}.${body.toString('base64url')}`, 'a')).toThrow(DecryptError);
  });
});

describe('vault', () => {
  it('unwraps with the right passphrase only, and survives rewrap', async () => {
    const { vault, dek } = await createVault('correct horse battery staple', master);
    expect((await unwrapVault(vault, 'correct horse battery staple', master))?.equals(dek)).toBe(true);
    expect(await unwrapVault(vault, 'wrong', master)).toBeNull();
    expect(await unwrapVault(vault, 'correct horse battery staple', randomBytes(32))).toBeNull();
    const next = await rewrapVault(dek, 'new passphrase here!', master);
    expect((await unwrapVault(next, 'new passphrase here!', master))?.equals(dek)).toBe(true);
  });
});

describe('redaction (P10)', () => {
  it('removes secrets and addresses', () => {
    const out = JSON.stringify(redact({ password: 'x', rpc: { authorization: 'Basic abc' }, msg: 'sent to u1l8xunezsvhq8fgzfl7404m450nwnd76zshscn6nfys7vyz2ywyh4cc5daaq0c7q', stage: 'ok' }));
    expect(out).not.toContain('Basic abc');
    expect(out).not.toContain('u1l8xunez');
    expect(out).toContain('"stage":"ok"');
  });
});

import { openJson, sealJson } from '../src';

describe('sealed backups', () => {
  it('round trips bigints and rejects a wrong password or purpose', () => {
    const file = sealJson({ zat: 123n, rows: [1] }, 'backup password 123!', 'setrya-backup').toString();
    expect(openJson<{ zat: bigint }>(file, 'backup password 123!', 'setrya-backup').zat).toBe(123n);
    expect(() => openJson(file, 'wrong', 'setrya-backup')).toThrow();
    expect(() => openJson(file, 'backup password 123!', 'setrya-other')).toThrow();
  });
});
