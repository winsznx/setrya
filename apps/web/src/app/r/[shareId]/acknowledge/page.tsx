import { AcknowledgeClient } from './acknowledge-client';

export default async function AcknowledgePage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  return <AcknowledgeClient shareId={shareId} />;
}
