Short answers to the questions people ask most. Each one links to the page with the full detail.

## Money and custody

### Who holds the ZEC?

You do. The spending keys live in the signer on your own settlement host, with the seed encrypted at rest. Setrya asks that wallet to build and sign each payment. This is operator-managed custody on your own server, not a hosted wallet. See [Keys, vault and sessions](/docs/security).

### Can Setrya move money without me?

No. Every payment needs an approved snapshot and then a fresh password confirmation that is tied to that exact transaction. The job that signs runs only after you authorise it, and only while your workspace is unlocked. See [Approve and pay](/docs/approve-and-pay).

### What does it cost to send?

Each payment pays the Zcash network fee set by ZIP 317: 5,000 zatoshis per logical action, with a two-action minimum. Paying two partners plus change is three actions, or 15,000 zatoshis (0.00015 ZEC). You pay the fee on top of the payouts. See [Fees and limits](/docs/fees-and-limits).

### Does Setrya fetch ZEC prices?

No. Converting fees into ZEC uses a rate you enter, with its source and time, and approve. Amounts round down to whole zatoshis, and the remainder is recorded instead of paid. See [Conversion rates](/docs/rates).

### Why is a partner's payout held?

Something it depends on needs you. The usual causes are a missing or unchecked payout address, a source row that needs a decision, a missing rate, or an amount below the project's minimum payout, 10,000 zatoshis by default. A hold affects only that payout, so everyone else can still be paid. See [Periods and exceptions](/docs/periods).

## Privacy

### Is it anonymous?

No product can promise that. A fully shielded transaction keeps recipients and amounts off the public chain, but its existence and timing are public, and whoever runs your server can read your records while the workspace is unlocked. See [Privacy model](/docs/privacy).

### Can partners see each other?

No. Each statement covers one partner. A shared link is encrypted in your browser for that statement only, and the key travels in the link's `#` fragment, which browsers never send to the server.

### What does the chain server learn?

The lightwalletd server the signer talks to sees your server's IP address, when it connects, and the raw bytes of each transaction you broadcast. It never sees amounts, recipients or memos. Routing the signer through Tor hides your IP address. See [The Setrya signer](/docs/signer#what-a-lightwalletd-server-learns).

### Can I pay a transparent address?

No. Transparent addresses and TEX addresses reveal the amount and the recipient, so Setrya refuses them as payout addresses. Ask the partner for a unified address with an Orchard receiver.

## Payments

### What if a payment times out?

Setrya stores the signed transaction before broadcasting it. An unknown outcome is checked against the chain, and only those identical bytes are ever sent again, so a timeout cannot become a second payment. See [Payment states](/docs/payment-states#when-the-outcome-is-unknown).

### How many confirmations does Setrya wait for?

The project's target, 3 by default. A payout counts as paid only when its transaction reaches that target. Setrya keeps watching for 10 more confirmations in case a reorg moves the transaction back.

### Why did a prepared transaction fail before signing?

The wallet's inspection didn't match the approval. The diagnosis names the cause: **Not fully shielded** for a privacy problem, or **Prepared transaction does not match approval** for a payee, amount, total or fee that differs. Nothing was signed, and you can prepare again. See [Payment states](/docs/payment-states#the-inspection-before-signing).

### Can I pay from funds in the old Orchard pool?

Not directly. Since NU6.3, payments stay inside the Ironwood pool. Legacy Orchard funds have to be moved into Ironwood first, which reveals that amount on the chain (ZIP 318), so do it separately and on purpose.

## Running Setrya

### What does it need to run?

A Linux server for the API, PostgreSQL and the signer, which run together with Docker Compose. The web app can run anywhere Node.js runs, Vercel included. See [Getting started](/docs/getting-started).

### Why not Zallet and Zebra?

The latest Zallet release, v0.1.0-beta.3, cannot follow the testnet past NU7, which activated at height 4,465,026. The signer follows it, and it needs no full node. Setrya's adapter still speaks Zallet's methods, so you can switch back once a Zallet release supports NU7. See [The Setrya signer](/docs/signer#why-it-exists).

### Can more than one person use a workspace?

Not yet. Each installation has one owner, and there are no multi-user approvals.

### What happens if my server restarts mid-payment?

The payment job lives in the database and resumes after the restart. Every step reads the stored state first, so it continues the same transaction instead of building a new one. Signing resumes once you unlock the workspace again. See [Backups and recovery](/docs/recovery).

### Does Setrya check the fee figures my platform reports?

No. Setrya calculates from the figures you import. It keeps each row's original fields and the file's fingerprint so you can trace any number back, but it cannot confirm the platform's figures are right.
