#!/usr/bin/env node
// Creates the host master key (if missing) and prints a one-time setup token. Never overwrites an existing key.
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const target = resolve(process.argv[2] ?? 'secrets/master.key');
if (existsSync(target)) {
  console.log(`Master key already exists at ${target}; left unchanged.`);
} else {
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  writeFileSync(target, randomBytes(32).toString('base64'), { mode: 0o600 });
  chmodSync(target, 0o600);
  console.log(`Wrote master key to ${target} (mode 600). Back it up separately from the database.`);
}
console.log(`SETRYA_SETUP_TOKEN=${randomBytes(24).toString('base64url')}`);
