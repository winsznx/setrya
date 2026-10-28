import type { Metadata } from 'next';

import { CONTAINER } from '@/components/landing/primitives';
import { PageIntro, Prose } from '@/components/marketing/prose';

import { VisibilityMatrix } from './visibility-matrix';

export const metadata: Metadata = { title: 'Privacy model', description: 'What Setrya protects, what it stores, and what it cannot hide.' };

export default function PrivacyPage() {
  return (
    <>
      <PageIntro eyebrow="Privacy model" title="Private onchain settlement. Clear limits.">This page describes the architecture as built. Where something is not protected, it says so.</PageIntro>
      <div className={`${CONTAINER} pt-12`}><VisibilityMatrix /></div>
      <Prose>
        <h2>Data the operator holds</h2>
        <p>Your revenue imports, partners, agreements, rates, calculations, approvals, payments, statements and audit log live in PostgreSQL on your server. Sensitive fields are encrypted with AES-256-GCM under a data key. That key is wrapped by a key derived from your vault passphrase (Argon2id) combined with a host master key stored outside the database. Neither alone is enough.</p>
        <h2>What is not encrypted</h2>
        <p>Amounts, currencies, dates, statuses, transaction IDs and row counts are stored in clear so the database can enforce uniqueness and state rules. Someone with database access sees how many partners and payments you have and their sizes, but not who they are or why.</p>
        <h2>Decrypted data in memory</h2>
        <p>When you unlock, the data key sits in server memory for your session and is dropped on lock, sign-out, idle timeout or restart. Payment jobs that resume after a restart wait until you unlock again.</p>
        <h2>Wallet keys and RPC isolation</h2>
        <p>Spending keys live in the wallet service on your settlement host, not in Setrya’s database. Setrya talks to it over loopback or a private network only, and a public RPC address is rejected at startup. The browser never receives a PCZT, signed bytes or RPC credentials, and can only call a fixed set of methods through Setrya’s own API. Every signing step needs a fresh password check bound to that exact transaction.</p>
        <h2>What “fully shielded” means here</h2>
        <p>Setrya requests the wallet’s FullPrivacy policy: a transaction that stays inside one shielded value pool, with no transparent inputs or outputs. Moving value between pools can reveal the amount crossing, so Setrya refuses it rather than downgrading. After NU6.3, Orchard receivers deliver into the Ironwood pool, and Setrya pays from Ironwood. Funds left in the old Orchard pool need a separate migration that reveals the amount (ZIP 318) before they can pay.</p>
        <p>The wallet service learns about the chain from a lightwalletd server. That server sees your host’s IP address, request timing and the raw transaction when it is broadcast. It does not learn amounts, recipients or which notes are yours, because decryption happens on your host. It could withhold or misreport chain data, which your own full node would rule out. Routing the connection through Tor hides the IP address.</p>
        <h2>What the chain and network still show</h2>
        <ul><li>That a transaction exists, its size and when it was mined.</li><li>Your server’s network traffic and timing.</li><li>Patterns, if you pay the same partners on a predictable schedule.</li></ul>
        <h2>Statement links</h2>
        <p>Links are encrypted in your browser with a 256-bit key placed after the <code>#</code>, which browsers do not send to servers. Setrya stores ciphertext and its expiry only. Anyone holding the full link can open it until it expires or you revoke it, and a partner can always forward or save what they decrypted.</p>
        <h2>Viewing keys</h2>
        <p>Setrya never asks for or shares a full viewing key. Payment disclosure proofs (ZIP 311) are still a draft without Ironwood support, so Setrya does not offer a “verified payment proof” feature. It distinguishes chain confirmation, your own wallet’s view, and a partner’s self-attested acknowledgment.</p>
        <h2>Exports and retention</h2>
        <p>Bulk exports and backups are encrypted with a password you choose. Expired and revoked statement links are purged automatically. Paid records stay, because they are your accounting history.</p>
        <h2>Not covered</h2>
        <ul><li>A compromised server or a host administrator with access while you are unlocked.</li><li>A compromised browser or extension reading your screen.</li><li>Errors in the fee data your platform gives you.</li><li>Legal, tax or sanctions obligations, which remain yours.</li></ul>
        <h2>Reporting a security issue</h2>
        <p>Report vulnerabilities privately to the maintainers of your Setrya installation. Do not include real keys, seeds or partner data in a report.</p>
      </Prose>
    </>
  );
}
