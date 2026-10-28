#!/usr/bin/env node
// Decrypts a Setrya password-encrypted export (statements or project data). Usage: node scripts/decrypt-export.mjs <file>
import { readFileSync } from 'node:fs';
import { createDecipheriv, pbkdf2Sync } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

const file = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (file.format !== 'setrya-archive' || file.v !== 1) throw new Error('Not a Setrya archive');
const rl = createInterface({ input: process.stdin, output: process.stderr });
const password = await rl.question('Export password: ');
rl.close();
const b = (s) => Buffer.from(s, 'base64url');
const key = pbkdf2Sync(password, b(file.kdf.salt), file.kdf.iterations, 32, 'sha256');
const ct = b(file.ct);
const d = createDecipheriv('aes-256-gcm', key, b(file.iv));
d.setAAD(Buffer.from(`setrya-archive-v1|${file.purpose}`));
d.setAuthTag(ct.subarray(ct.length - 16));
process.stdout.write(Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]).toString('utf8'));
