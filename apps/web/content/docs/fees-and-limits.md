This page lists every fee a payment pays and every limit Setrya applies, with where each one is enforced. Setrya itself charges nothing. It's software you run on your own server.

## Fees at a glance

| Fee | When it's paid | How much | Who pays it |
| --- | --- | --- | --- |
| Zcash network fee | Each payment transaction | The ZIP 317 conventional fee, from 10,000 zatoshis up | You, from the payer account |
| Setrya fee | Never | None | |
| Fee to receive a payment | Never | None | |

Partners receive exactly their approved amount. The network fee comes out of the payer account on top of the payouts, so it never reduces what a partner gets.

## The network fee

Zcash's conventional fee, ZIP 317, depends on how many actions a transaction has. Each payee is one output, the payer's change is another, and the wallet pads a shielded bundle to at least two actions.

- The fee is 5,000 zatoshis for each action, and never less than for two actions, which is 10,000 zatoshis.
- One partner plus change is two actions, so 10,000 zatoshis.
- Two partners plus change is three actions, so 15,000 zatoshis.

The wallet works out the fee when it builds the transaction. Setrya then checks that it's exactly the conventional fee before you can authorise the payment. A higher or lower fee fails the inspection with **Network fee matches the ZIP 317 conventional fee**, and nothing is signed. The payment page shows the fee next to **Network fee** and the full amount next to **Total leaving account**.

Fees for confirmed transactions are added up when you close a period, so the period report shows what the network cost.

## Rounding to whole zatoshis

ZEC has eight decimal places. The smallest unit, one zatoshi, is 0.00000001 ZEC. Setrya converts each amount owed into ZEC at the rate you approved, then rounds down to a whole zatoshi. It never rounds up, so no partner is paid more than they're owed. The part that's rounded away is recorded on the payout as **Residual not paid**.

## Limits on payouts and transactions

You set these per project in **Settings**, then **Settlement defaults**. They apply to future calculations and payments. Frozen snapshots and approvals never change.

| Setting | Default | Range | What it does |
| --- | --- | --- | --- |
| **Minimum payout (zatoshis)** | 10,000 | | Smaller payouts are held instead of rounded away, with "Amount is below the minimum useful payout" |
| **Maximum recipients per transaction** | 10 | 1 to 50 | Larger approvals split into several transactions, each with its own network fee |
| **Minimum input confirmations** | 1 | 1 or more | Notes must be this deep before the wallet may spend them |
| **Confirmations to count as paid** | 3 | 1 or more | No payout shows Confirmed before this depth |
| **Manual rate expiry (hours)** | 72 | 1 or more | The default expiry for a rate you enter. See [Conversion rates](/docs/rates) |
| **Step-up window (seconds)** | 300 | 60 to 900 | How long a password confirmation stays valid for one action |

## Limits on imports

| Limit | Value |
| --- | --- |
| File size | 5 MB, UTF-8 CSV |
| Rows per file | 20,000 |
| Columns | 64 |
| Characters per cell | 4,000 |

The web app passes uploads through to the API in requests of up to 4 MB, so when it runs separately from the API, keep each file under 4 MB.

## Other limits

| Limit | Value | Where to change it |
| --- | --- | --- |
| Shared statement links | Expire after 14 days | **Settings**, then **Privacy and data** |
| Workspace auto-lock | 15 minutes idle, from 1 to 240 | **Settings**, then **Security and backups** |
| Sign-in session | 12 hours, or 7 days if you choose | At sign-in |

[Keys, vault and sessions](/docs/security#rate-limits) lists the rate limits on sign-in, unlock, confirmations, backups and shared links.

## What a payment can't do

- It can't pay a transparent or TEX address, or an address without an Orchard receiver.
- It can't move value between shielded pools, or spend funds left in the old Orchard pool.
- It can't send more than the approved amount to anyone, or pay anyone who wasn't approved.
- It can't be reversed once it's confirmed.
