// Host-shell owner password reset. Bumps auth_version so every session is revoked. Does not touch the vault.
import { getDb, schema, sql } from '@setrya/db';
import { hashPassword, passwordStrength } from '@setrya/security';
import { createInterface } from 'node:readline/promises';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question('New owner password: ');
rl.close();
const strength = passwordStrength(password);
if (!strength.ok) {
  console.error(strength.problems.join('\n'));
  process.exit(1);
}
const updated = await getDb()
  .update(schema.owners)
  .set({ passwordHash: await hashPassword(password), authVersion: sql`${schema.owners.authVersion} + 1`, updatedAt: new Date() })
  .returning({ id: schema.owners.id });
console.log(updated.length ? 'Password reset. All sessions are signed out.' : 'No owner exists yet.');
process.exit(0);
