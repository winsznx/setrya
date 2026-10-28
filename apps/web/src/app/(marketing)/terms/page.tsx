import type { Metadata } from 'next';

import { PageIntro, Prose } from '@/components/marketing/prose';

export const metadata: Metadata = { title: 'Terms and limitations' };

export default function Terms() {
  return (
    <>
      <PageIntro eyebrow="Terms" title="Terms and limitations">This is informational, not legal advice. Setrya is software you run yourself.</PageIntro>
      <Prose>
        <h2>Your responsibilities</h2>
        <ul>
          <li>Checking that imported fees are correct and complete. Setrya records and calculates; it does not audit your platform.</li>
          <li>The agreements you enter, and that they match what you agreed with partners.</li>
          <li>Verifying each partner’s identity and payout address with them directly.</li>
          <li>Tax, reporting, licensing and sanctions obligations in every place they apply.</li>
          <li>Running and securing your server, database and wallet service, and backing up its seed.</li>
          <li>Backing up your Setrya data and, separately, your wallet.</li>
        </ul>
        <h2>ZEC and rates</h2>
        <p>ZEC prices change. Rates in Setrya are ones you enter and approve; Setrya does not quote, convert or exchange currency, and nothing in it is investment advice.</p>
        <h2>Privacy limits</h2>
        <p>Shielded transactions hide recipients and amounts from the public chain, not the existence or timing of a payment, and not anything readable on your server or in a compromised browser. See the privacy model for details.</p>
        <h2>No guarantees</h2>
        <p>Setrya is provided as is, without certification, warranty or guarantee of availability, correctness or privacy. Payments sent on a blockchain generally cannot be reversed. Use limited amounts until you have tested your own setup, and obtain an independent security review before relying on it for significant sums.</p>
      </Prose>
    </>
  );
}
