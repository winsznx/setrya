This page describes Setrya's privacy as it's built: what you, each partner, the public chain and the chain server can see, how a payment stays shielded, and what Setrya can't hide. Where something isn't protected, it says so.

## Who can see what

| | You, the operator | Each partner | The public chain |
| --- | --- | --- | --- |
| Project revenue and fee sources | Yes | Only the fee base on their statement | No |
| Other partners | Yes | No | No |
| Agreement terms | Yes | Their own terms only | No |
| Wallet spending key | Held by the wallet service on your host, never in Setrya's database | No | No |
| That a payment happened, and when | Yes | Yes, if you share the transaction ID | Yes |
| Who was paid and how much | Through your own wallet view | Their own payment, in their wallet | Not from a fully shielded transaction |
| Statement link key | Only when creating the link | Whoever holds the link | No |

## How a payment stays shielded

Setrya asks the wallet for its FullPrivacy policy: a transaction that stays inside one shielded value pool, with no transparent inputs or outputs. Moving value between pools can reveal the amount crossing, so Setrya refuses that kind of transaction instead of weakening the policy. There's no setting that weakens privacy inside the normal settlement flow.

Since the NU6.3 upgrade, Orchard receivers deliver into the Ironwood pool, and Setrya pays from Ironwood into Ironwood. Funds still in the old Orchard pool can't pay until they're moved to Ironwood in a separate step. That move reveals the amount crossing between the pools, so it needs your explicit decision. The signer doesn't have a command for that move yet.

A partner's payout address has to have an Orchard receiver. Paying a Sapling-only address would cross pools, so Setrya holds that payout and asks for a unified address with an Orchard receiver.

## What's stored on your server

Your revenue imports, partners, agreements, rates, calculations, approvals, payments, statements and audit log live in PostgreSQL on your settlement host. The sensitive fields are encrypted, as [Keys, vault and sessions](/docs/security#how-your-records-are-encrypted) explains.

Amounts, currencies, dates, statuses, transaction IDs and row counts are stored in clear so the database can enforce its rules. Someone with database access sees how many partners and payments you have and their sizes, but not who they are or why.

The web app keeps nothing. It renders pages from the API and passes your requests through.

## What the chain server sees

The [Setrya signer](/docs/signer) is a light-client wallet. It learns about the chain from a lightwalletd server, `testnet.zec.rocks` or `zec.rocks` by default, instead of running a full node.

| The chain server sees | The chain server can't see |
| --- | --- |
| Your settlement host's IP address and when it connects | Amounts, recipients or memos |
| The wallet's birthday height, when the wallet is created | Which notes belong to your wallet |
| The raw bytes of each transaction you broadcast | Your records in Setrya |
| Which transaction IDs you look up | |

Decryption happens on your host, which is why the server never learns which notes are yours. A dishonest server could withhold or misreport chain data, which your own full node would rule out. Routing the signer through Tor with its SOCKS5 option hides your IP address from the server. Running Zallet with your own Zebra node removes the chain server entirely, once Zallet supports NU7.

## Statement links

A shared statement link is encrypted in your browser with a 256-bit key that sits after the `#` in the link. Browsers don't send that part to any server, so neither Setrya nor your host ever sees the key. The link shows one partner's statement, and nothing about other partners, your revenue or your balance. Statement pages ask the browser not to send a referrer, so the key doesn't leak to sites the partner visits next.

Links expire after the number of days set in **Settings**, then **Privacy and data**, and you can revoke one at any time. The encrypted contents of expired and revoked links are deleted automatically. [Statements and sharing](/docs/statements) shows how to create one.

## What Setrya can't hide

- That a shielded transaction happened, and when.
- That you run a server, and that it talks to a chain server.
- Anything your host administrator, or a compromised browser, can read while your workspace is unlocked.
- Statements and links that partners choose to forward.

## Proof of payment

Each partner can prove their payout is part of the approved snapshot without seeing anyone else's line. The proof uses a salted Merkle commitment carried in their encrypted payment memo, and it's checked in their browser. See [Verifiable payouts](/docs/verifiable-payouts).

Setrya never asks for or shares a full viewing key. Payment disclosure proofs, ZIP 311, are still a draft without Ironwood support, so Setrya doesn't offer a "verified payment proof". A statement keeps three things apart: the confirmations Setrya observed on the chain, what your own wallet reports, and a partner's own acknowledgment, which is labelled as their declaration.

## Exports and retention

Bulk exports and backups are encrypted with a password you choose. Paid records stay, because they're your accounting history. Report a vulnerability privately to whoever maintains your installation, and don't include real keys, seeds or partner data.
