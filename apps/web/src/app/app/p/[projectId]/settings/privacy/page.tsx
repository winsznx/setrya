import { Card, Panel } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { loadView } from '@/lib/api/views';
import { projectPath } from '@/lib/paths';

import { DraftCleanup, PrivacyForm } from './privacy-client';

const MATRIX: [string, string, string, string][] = [
  ['Project revenue and sources', 'Yes', 'Only the fee base in their statement', 'No'],
  ['All partners and agreements', 'Yes', 'Only their own terms', 'No'],
  ['Wallet spending key', 'Never. It stays in the wallet service on your host', 'No', 'No'],
  ['Transaction existence and timing', 'Yes', 'The txid if shared', 'Yes'],
  ['Shielded recipient and amount', 'Through your wallet view', 'In their own wallet', 'Not from the chain alone'],
  ['Statement link key', 'At creation only', 'Whoever holds the link', 'No'],
];

export default async function PrivacySettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { project, drafts, shares } = await loadView('settings.privacy', { projectId }, `/app/p/${projectId}/settings/privacy`);
  const p = (rest: string) => projectPath(project.id, rest);
  return (
    <>
      <PageHeader crumbs={[{ label: project.name, href: p('') }, { label: 'Settings', href: p('/settings') }, { label: 'Privacy and data' }]} title="Privacy and data" description="What Setrya encrypts, what it cannot hide, and what you control." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-h3">What is encrypted</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-body-s text-ink-secondary">
            <li>Partner names, contacts, notes and payout addresses</li>
            <li>Agreement terms, revenue rows and raw CSV fields</li>
            <li>Calculations, snapshots, statements and audit details</li>
            <li>Prepared and signed transaction bytes</li>
          </ul>
          <p className="mt-3 text-body-s text-ink-secondary">Encryption is AES-256-GCM under a data key that needs both your vault passphrase and this host&apos;s master key. Amounts, currencies, dates, statuses and txids are stored in clear so the database can enforce constraints. Analytics and third-party scripts are off and cannot be turned on.</p>
        </Card>
        <PrivacyForm projectId={project.id} version={project.version} initial={{ shareExpiryDays: project.shareExpiryDays, revealTimeoutSeconds: project.revealTimeoutSeconds }} />
        <Panel title="Visibility" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-body-s">
              <thead><tr className="border-b border-border text-left text-label text-ink-secondary"><th className="px-5 py-2 font-medium">Field</th><th className="px-3 py-2 font-medium">You</th><th className="px-3 py-2 font-medium">Recipient</th><th className="px-3 py-2 font-medium">Public chain</th></tr></thead>
              <tbody>{MATRIX.map((r) => <tr key={r[0]} className="border-b border-border last:border-0"><th scope="row" className="px-5 py-2 text-left font-medium">{r[0]}</th><td className="px-3 py-2">{r[1]}</td><td className="px-3 py-2">{r[2]}</td><td className="px-3 py-2">{r[3]}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="space-y-1 border-t border-border px-5 py-3 text-body-s text-ink-secondary">
            <p>Whoever administers this host can read decrypted data while the workspace is unlocked. A compromised browser can read what is on screen. Recipients can forward their statement. Transaction timing is public. Imported fee data and manual rates are only as accurate as their sources.</p>
          </div>
        </Panel>
        <Card>
          <h2 className="text-h3">Shared links</h2>
          <p className="mt-1 text-body-s text-ink-secondary">{shares.active} active link(s). Revoke individual links from each statement. Expired and revoked ciphertext is purged automatically within the hour ({shares.purgeable} waiting).</p>
          <a className="mt-3 inline-block text-body-s font-medium text-accent-text hover:underline" href={p('/statements?share=active')}>Review active links</a>
        </Card>
        <Card>
          <h2 className="text-h3">Export and drafts</h2>
          <p className="mt-1 text-body-s text-ink-secondary">Export all project data as an encrypted backup from <a className="text-accent-text hover:underline" href={p('/settings/security#backup')}>Security and backups</a>. Logs redact addresses, amounts, names, secrets and CSV content.</p>
          <DraftCleanup projectId={project.id} drafts={drafts} />
        </Card>
      </div>
    </>
  );
}
