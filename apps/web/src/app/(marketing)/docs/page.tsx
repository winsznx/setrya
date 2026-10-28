import type { Metadata } from 'next';
import Link from 'next/link';

import { CONTAINER, IconDisc } from '@/components/landing/primitives';
import { PageIntro, Prose } from '@/components/marketing/prose';
import type { IconName } from '@/components/ui/icons';

export const metadata: Metadata = { title: 'Documentation' };

const CARDS: [string, string, string, IconName][] = [
  ['Quick start', '/docs/getting-started', 'Install, provision the owner, connect the wallet, run a first period.', 'upload'],
  ['Supported network and deployment', '#deployment', 'Linux settlement host, wallet service, PostgreSQL.', 'settings'],
  ['Import formats', '#imports', 'CSV columns, dates, decimals, duplicates.', 'file'],
  ['Agreement rules', '#agreements', 'Percentages, fixed amounts, caps, refunds, pools.', 'agreements'],
  ['Wallet setup', '/docs/getting-started#wallet', 'Server-side connection settings.', 'wallet'],
  ['Privacy boundaries', '/privacy', 'What is protected and what is not.', 'shield'],
  ['How confirmations work', '#confirmations', 'From prepared to confirmed, and recovery.', 'clock'],
  ['Troubleshooting', '#troubleshooting', 'Common blocked states and what to do.', 'alert'],
  ['Backup and recovery', '#backup', 'Setrya backups versus wallet backups.', 'download'],
  ['Technical references', '#references', 'Zcash, librustzcash, Zallet and Zebra documentation.', 'external'],
];

export default function Docs() {
  return (
    <>
      <PageIntro eyebrow="Documentation" title="Documentation">How to run Setrya, and what each part of it does.</PageIntro>
      <nav aria-label="Documentation topics" className={`${CONTAINER} pt-12`}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {CARDS.map(([t, href, b, icon]) => (
            <li key={t}>
              <Link prefetch={false} href={href} className="flex h-full gap-4 rounded-workspace border border-border bg-surface p-card shadow-raised transition-colors duration-fast hover:border-border-strong md:p-6">
                <IconDisc name={icon} className="bg-accent-soft shadow-none" />
                <span className="min-w-0"><span className="block text-h3 text-ink">{t}</span><span className="mt-1 block text-body-s text-ink-secondary">{b}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <Prose>
        <h2 id="deployment">Supported network and deployment</h2>
        <p>Setrya is single-tenant and self-hosted: one owner per installation. The web app can run on a host like Vercel. The API, PostgreSQL 16 and the wallet service run on your Linux settlement host. The default wallet service is the Setrya signer, a light-client wallet built on librustzcash that reads the chain from a lightwalletd server. Zallet with a Zebra node on the same machine works through the same connection once a Zallet release supports NU7. Without a wallet connection, Setrya runs in accounting mode: imports, calculations and reviews work, and sending stays locked.</p>
        <p>Choose one network per installation with <code>SETRYA_NETWORK</code>: <code>mainnet</code>, <code>testnet</code> or <code>regtest</code>. The badge on every screen shows it.</p>
        <h2 id="imports">Import formats</h2>
        <p>UTF-8 CSV with a header row, comma, semicolon or tab separated, up to 5 MB and 20,000 rows. Map at least a date and an amount column. Recommended columns: <code>external_id, occurred_at, description, amount, currency, fee_type, status, source_reference</code>.</p>
        <ul>
          <li>Dates: ISO 8601 with or without time and offset, or MM/DD/YYYY and DD/MM/YYYY when you choose that format. Dates without an offset use the zone you pick.</li>
          <li>Amounts: up to 8 decimals, with optional currency symbols, thousands separators and parentheses for negatives.</li>
          <li>Rows typed as volume are excluded; refunds are held until you decide; a fee row whose text mentions volume is flagged.</li>
          <li>The same file for the same source cannot be committed twice. Repeated <code>external_id</code> values are flagged and can be skipped or held.</li>
        </ul>
        <h2 id="agreements">Agreement rules</h2>
        <p>An agreement is a percentage of eligible realised fees or a fixed amount per period, effective between two dates. Percentages allow 4 decimal places. Refunds can reduce the base or be ignored. An optional cap limits each period. Exclusive shares on one source cannot exceed 100%; independent obligations can, with your acknowledgement. Revisions create a new version from an effective date; frozen periods keep the version they used.</p>
        <h2 id="confirmations">How confirmations work</h2>
        <ol>
          <li>Approved: a hashed snapshot of amounts and destinations. Nothing signed.</li>
          <li>Prepared: the wallet service built a FullPrivacy PCZT, and Setrya compared its inspection with the approval.</li>
          <li>Signed: proofs and signatures created, bytes stored encrypted. Not broadcast yet.</li>
          <li>Broadcast: the network accepted the transaction.</li>
          <li>Confirmed: mined and buried under the confirmation depth you set (default 3). Only now does a statement say confirmed on chain.</li>
        </ol>
        <p>If a broadcast times out, the state is unknown. Setrya asks the node about that exact txid and offers to resubmit the same signed bytes; it never builds a second payment while the first could still be mined. A reorg demotes confirmed back to confirming, visibly.</p>
        <h2 id="troubleshooting">Troubleshooting</h2>
        <ul>
          <li><strong>Payout held: no approved rate.</strong> Attach a rate under Conversion rates on the draft period.</li>
          <li><strong>Approval blocked: frozen inputs changed.</strong> Something changed after freezing, such as an address or the payer account. Start a new revision.</li>
          <li><strong>Not fully shielded.</strong> The wallet could not build a single-pool shielded transaction. Check that funds and recipient receivers are in the same pool.</li>
          <li><strong>Insufficient confirmed funds.</strong> Fund the account’s shielded address from the Wallet page and wait for confirmations.</li>
          <li><strong>Wallet locked or syncing.</strong> Unlock or wait on the settlement host. Setrya never stores the wallet passphrase.</li>
        </ul>
        <h2 id="backup">Backup and recovery</h2>
        <p>A Setrya backup contains every table, sealed with a backup password; restoring also needs the host master key and the vault passphrase. It never contains wallet keys. Back up the wallet’s 24-word seed separately and offline. Restore into a fresh database with <code>pnpm --filter @setrya/api restore-backup &lt;file&gt;</code>.</p>
        <h2 id="references">Technical references</h2>
        <ul>
          <li><a href="https://github.com/zcash/librustzcash" rel="noreferrer">librustzcash</a>, the Zcash Rust libraries the Setrya signer is built on</li>
          <li><a href="https://zcash.github.io/zallet/rpc/index.html" rel="noreferrer">Zallet RPC methods</a> and <a href="https://zcash.github.io/zallet/guide/setup.html" rel="noreferrer">setup guide</a></li>
          <li><a href="https://github.com/ZcashFoundation/zebra" rel="noreferrer">Zebra</a></li>
          <li><a href="https://zips.z.cash/zip-0316" rel="noreferrer">ZIP 316, Unified Addresses</a> and <a href="https://zips.z.cash/zip-0317" rel="noreferrer">ZIP 317, fees</a></li>
          <li><a href="https://z.cash/upgrade/nu6-3/" rel="noreferrer">NU6.3 and the Ironwood pool</a></li>
        </ul>
      </Prose>
    </>
  );
}
