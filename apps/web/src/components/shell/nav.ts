import type { IconName } from '@/components/ui/icons';

export interface NavItem {
  label: string;
  href: (projectId: string) => string;
  icon: IconName;
  match: string;
}

const p = (rest: string) => (id: string) => `/app/p/${id}${rest}`;

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Overview', href: p(''), icon: 'overview', match: '' },
      { label: 'Revenue', href: p('/revenue'), icon: 'revenue', match: '/revenue' },
      { label: 'Partners', href: p('/partners'), icon: 'partners', match: '/partners' },
      { label: 'Agreements', href: p('/agreements'), icon: 'agreements', match: '/agreements' },
    ],
  },
  {
    label: 'Settlement',
    items: [
      { label: 'Periods', href: p('/periods'), icon: 'periods', match: '/periods' },
      { label: 'Payments', href: p('/payments'), icon: 'payments', match: '/payments' },
      { label: 'Statements', href: p('/statements'), icon: 'statements', match: '/statements' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Wallet', href: p('/wallet'), icon: 'wallet', match: '/wallet' },
      { label: 'Activity', href: p('/activity'), icon: 'activity', match: '/activity' },
      { label: 'Settings', href: p('/settings'), icon: 'settings', match: '/settings' },
    ],
  },
];

export const MOBILE_PRIMARY = ['Overview', 'Periods', 'Partners', 'Payments'];

export function isActive(pathname: string, projectId: string, item: NavItem): boolean {
  const base = `/app/p/${projectId}`;
  if (item.match === '') return pathname === base;
  return pathname === base + item.match || pathname.startsWith(`${base}${item.match}/`);
}
