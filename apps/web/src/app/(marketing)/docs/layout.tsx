import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { DocsChrome } from '@/components/docs/docs-chrome';

export const metadata: Metadata = {
  title: { default: 'Setrya docs', template: '%s · Setrya docs' },
  description: 'How to run Setrya and close a period: imports, agreements, approvals, shielded payments, statements, security and the API.',
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <DocsChrome>{children}</DocsChrome>;
}
