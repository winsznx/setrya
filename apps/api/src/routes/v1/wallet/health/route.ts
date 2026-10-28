import { route } from '../../../../http/route';
import { walletHealth } from '../../../../services/wallet';

export const GET = route('session', async (req) => walletHealth({ maxAgeMs: new URL(req.url).searchParams.get('fresh') === '1' ? 0 : 15_000 }));
