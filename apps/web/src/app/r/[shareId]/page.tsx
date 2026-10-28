import { RecipientStatement } from './recipient-statement';

export default async function RecipientPage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  return <RecipientStatement shareId={shareId} />;
}
