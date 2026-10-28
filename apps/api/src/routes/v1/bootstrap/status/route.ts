import { clientKey, rateLimit, route } from '../../../../http/route';
import { ownerExists } from '../../../../services/owner';

export const GET = route('none', async (req) => {
  rateLimit(`bootstrap:${clientKey(req)}`, 30, 60_000);
  return { provisioned: await ownerExists() };
});
