import { createRelay } from '@/lib/api/relay';

const relay = createRelay('sandbox');

export { relay as GET, relay as POST };
