Setrya is self-hosted software for paying the people you share revenue with. You import the fees your business actually earned, apply each partner's agreement, review anything that looks wrong, then pay every partner with one fully shielded [ZEC](/docs/glossary#zec) transaction and give each of them a statement of their own. The amounts and the recipients stay off the public chain.

## Who it's for

Setrya is for small crypto-native businesses that owe partners a share of their fees: a launch studio paying promoters, a platform paying creators, a protocol paying referrers. If you work this out in a spreadsheet today and pay from a wallet one address at a time, Setrya replaces both steps with a record you can show a partner or an accountant.

You run it yourself. One owner runs each installation, and the keys that move money live on a server you control. It's operator-managed custody on your own infrastructure. It isn't a hosted wallet, and it isn't a browser wallet.

## The problems it solves

### Payouts that nobody can check

A share of "revenue" means little until you know which revenue. Setrya keeps every fee row you import with its original fields and a fingerprint of the file, and you classify each row as an eligible fee, excluded or held. Trading volume, for example, is never counted as fees. Every payout then shows its fee base, the agreement version, the rate you approved and the exact [zatoshis](/docs/glossary#zatoshi). [Periods and exceptions](/docs/periods) shows how a period is calculated.

### Paying in public

A normal crypto payment puts the recipient, the amount and your treasury on a public ledger for anyone to read. Setrya pays only inside one shielded pool, so the chain shows that a transaction happened and when, and not who was paid or how much. [Privacy model](/docs/privacy) lists exactly who can see what.

### One problem stalling everyone

A missing address or a disputed row holds only the payouts it touches. Everyone else in the period can still be paid. [Partners and payout addresses](/docs/partners) explains what holds a payout.

### Payments you can't take back

Shielded payments can't be reversed, so Setrya checks before anything is signed. Your wallet builds the transaction, Setrya compares it with what you approved down to the zatoshi, and you confirm with your password before it's signed. If a payment's outcome is unclear after a crash or a timeout, Setrya checks the chain and only ever resubmits the same signed transaction. [Approve and pay](/docs/approve-and-pay) walks through it.

## What you can do today

- Create projects, each with its own revenue sources, partners, agreements and settlement periods.
- Import a fee export as CSV, map its columns, classify each row, and commit it once. The same file can't be counted twice.
- Add partners and check that each payout address can receive a shielded payment on your network.
- Write versioned agreements that turn eligible fees into an amount owed.
- Calculate a period, resolve its exceptions, freeze a hashed snapshot and approve it.
- Enter and approve the conversion rate from your fee currency to ZEC.
- Pay every payable partner in one fully shielded transaction, inspected before signing, and follow it to confirmation.
- Issue one statement per partner, as a print view, a CSV, or an encrypted link that shows them only their own line.
- Download an encrypted backup of every record.

## What runs where

| Part | Where it runs | What it holds |
| --- | --- | --- |
| Web app | Any Node host. Vercel works | Nothing. It renders pages and relays your requests to the API |
| API | Your Linux settlement host | Your account, the encrypted records and the payment jobs |
| Database | Your settlement host, PostgreSQL 16 | Every record, with sensitive fields encrypted |
| Wallet service | Your settlement host | The spending keys, with the seed encrypted at rest |

The wallet service is the [Setrya signer](/docs/signer), a light-client Zcash wallet built on the Zcash Rust libraries. [Architecture](/docs/architecture) explains how the parts connect.

## What's live on which network

| | Testnet | Mainnet |
| --- | --- | --- |
| Imports, agreements, periods and statements | Yes | Yes |
| Shielded payments through the signer | Yes | Not until the signer's Zcash libraries know mainnet's NU7 height |
| Funding the payer wallet | Faucets are not paying right now | Send ZEC from any wallet that can pay an Orchard receiver |

[Mainnet, testnet and regtest](/docs/networks) has the details.

## Where to go next

[Getting started](/docs/getting-started) takes you from an empty server to a first reviewed period. Before you move real money, read [Keys, vault and sessions](/docs/security) to see who holds what, and [Fees and limits](/docs/fees-and-limits) for what each payment costs.
