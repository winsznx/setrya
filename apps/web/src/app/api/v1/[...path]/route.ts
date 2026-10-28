import { createRelay } from '@/lib/api/relay';

const relay = createRelay('main');

export { relay as GET, relay as POST, relay as PUT, relay as PATCH, relay as DELETE };
