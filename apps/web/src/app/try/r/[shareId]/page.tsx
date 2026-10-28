import { RecipientStatement } from '@/app/r/[shareId]/recipient-statement';

export default async function SandboxStatementPage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  return <RecipientStatement shareId={shareId} apiBase="/api/sandbox/v1" allowAcknowledge={false} />;
}
