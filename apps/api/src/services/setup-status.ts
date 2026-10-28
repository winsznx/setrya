import { getDb, schema, eq, and, sql } from '@setrya/db';

import type { WalletHealth } from './wallet';

export interface SetupStatus {
  workspace: boolean;
  source: boolean;
  partner: boolean;
  agreement: boolean;
  wallet: boolean;
  import: boolean;
}

export async function setupStatus(projectId: string | null, health: WalletHealth): Promise<SetupStatus> {
  if (!projectId) return { workspace: false, source: false, partner: false, agreement: false, wallet: health.canPay, import: false };
  const count = async (table: typeof schema.sources | typeof schema.partners | typeof schema.importBatches) => {
    const [r] = await getDb().select({ n: sql<number>`count(*)::int` }).from(table).where(eq(table.projectId, projectId));
    return r?.n ?? 0;
  };
  const [agreements] = await getDb().select({ n: sql<number>`count(*)::int` }).from(schema.agreements).where(and(eq(schema.agreements.projectId, projectId), eq(schema.agreements.status, 'active')));
  return {
    workspace: true,
    source: (await count(schema.sources)) > 0,
    partner: (await count(schema.partners)) > 0,
    agreement: (agreements?.n ?? 0) > 0,
    wallet: health.canPay,
    import: (await count(schema.importBatches)) > 0,
  };
}
