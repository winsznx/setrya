export const SITE_URL = 'https://setrya.xyz';
export const INTRODUCTION_SLUG = 'introduction';

export interface DocPage {
  slug: string;
  title: string;
  description: string;
}

export interface DocSection {
  title: string;
  pages: readonly DocPage[];
}

export const DOC_SECTIONS: readonly DocSection[] = [
  {
    title: 'Start here',
    pages: [
      { slug: INTRODUCTION_SLUG, title: 'What is Setrya', description: 'Revenue-share settlement in fully shielded ZEC: who it is for, what it does, and what runs where.' },
      { slug: 'for-judges', title: 'For judges: a five-minute tour', description: 'Sign in to the shared testnet workspace, see a settled period, open a partner statement and pay yourself.' },
      { slug: 'getting-started', title: 'Getting started', description: 'Deploy the settlement host and the web app, create the owner, fund the wallet and close a first period.' },
      { slug: 'networks', title: 'Mainnet, testnet and regtest', description: 'What each Zcash network is for, how Setrya keeps them apart, and what is live on each.' },
    ],
  },
  {
    title: 'Using Setrya',
    pages: [
      { slug: 'projects-and-sources', title: 'Projects and revenue sources', description: 'A project holds one business’s partners and periods. A source is where its fee figures come from.' },
      { slug: 'import-revenue', title: 'Import revenue', description: 'Upload a fee export, map its columns, classify each row and commit it without counting anything twice.' },
      { slug: 'partners', title: 'Partners and payout addresses', description: 'Add the people you pay, check that their address can receive a shielded payment, and what holds a payout.' },
      { slug: 'agreements', title: 'Agreements', description: 'Versioned terms that turn eligible fees into what each partner is owed, and how revisions take effect.' },
      { slug: 'periods', title: 'Periods and exceptions', description: 'Calculate a period, resolve the rows that need a decision, and freeze a snapshot for approval.' },
      { slug: 'rates', title: 'Conversion rates', description: 'Rates you enter and approve to convert fees into ZEC, and how rounding to whole zatoshis works.' },
      { slug: 'approve-and-pay', title: 'Approve and pay', description: 'Approve a frozen snapshot, read the wallet’s inspection, authorise the payment and follow it to confirmation.' },
      { slug: 'statements', title: 'Statements and sharing', description: 'One statement per partner, what its stamp means, and encrypted links that show a partner only their own line.' },
      { slug: 'wallet', title: 'Wallet and funding', description: 'The payer wallet’s health, balances by pool, its receiving address, and how to fund it.' },
    ],
  },
  {
    title: 'Safety and trust',
    pages: [
      { slug: 'security', title: 'Keys, vault and sessions', description: 'Who holds the spending keys, how records are encrypted, and the confirmations money movement needs.' },
      { slug: 'verifiable-payouts', title: 'Verifiable payouts', description: 'How each partner proves their payout is part of the approved snapshot, from their own wallet, without seeing anyone else’s.' },
      { slug: 'privacy', title: 'Privacy model', description: 'Exactly what you, each partner, the public chain and the chain server can see, and what Setrya cannot hide.' },
      { slug: 'recovery', title: 'Backups and recovery', description: 'What to back up, how to restore it, and how Setrya reconciles payments after an interruption.' },
      { slug: 'fees-and-limits', title: 'Fees and limits', description: 'The network fee every payment pays, minimum payouts, rounding, and the limits Setrya enforces.' },
    ],
  },
  {
    title: 'Reference',
    pages: [
      { slug: 'architecture', title: 'Architecture', description: 'The web app, the API, the database and the signer, how they connect, and what each one holds.' },
      { slug: 'signer', title: 'The Setrya signer', description: 'The light-client wallet that builds, inspects, signs and broadcasts payments, and the rules it enforces.' },
      { slug: 'payment-states', title: 'Payment states', description: 'Every state a payment can be in, what moves it on, and what Setrya does when the outcome is unknown.' },
      { slug: 'api', title: 'API', description: 'How the web tier reaches the API, authentication, response format and the main endpoints.' },
      { slug: 'faq', title: 'FAQ', description: 'Direct answers to the questions operators and partners ask about Setrya.' },
      { slug: 'glossary', title: 'Glossary', description: 'Plain-word definitions of the Zcash and settlement terms in the app and these docs.' },
    ],
  },
];

export interface IndexedDocPage extends DocPage {
  section: string;
  path: string;
  url: string;
}

export function docPath(slug: string): string {
  return slug === INTRODUCTION_SLUG ? '/docs' : `/docs/${slug}`;
}

export const DOC_PAGES: readonly IndexedDocPage[] = DOC_SECTIONS.flatMap((section) =>
  section.pages.map((page) => ({ ...page, section: section.title, path: docPath(page.slug), url: `${SITE_URL}${docPath(page.slug)}` })),
);

export function findDocPage(slug: string): IndexedDocPage | undefined {
  return DOC_PAGES.find((page) => page.slug === slug);
}
