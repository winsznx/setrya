'use client';

import { Button } from '@/components/ui/button';

export function PrintButton() {
  return <Button icon="print" onClick={() => window.print()}>Print</Button>;
}
