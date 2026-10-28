A statement is the document a partner gets for one period: how their payout was calculated, what was approved, and what the chain showed about the payment. Each statement covers one partner only. You can download it, print it, or share it through an encrypted link that opens just that statement and nothing else.

## How statements are made

Setrya issues a statement for each payout when you [approve a period](/docs/approve-and-pay#approve). As the payment moves on, the statement picks up what was observed, such as the txid and the confirmations. If a statement changes, it gets a new **Version**.

Each statement shows the issuer's header from your [project settings](/docs/projects-and-sources#project-settings), who it's prepared for, the period and dates, the fee source, a **How this amount was calculated** table with the agreement, eligible fees, amount owed and ZEC, the total, and a **Payment** box with the status, network, payment reference and transaction ID. ZEC amounts are rounded down to whole zatoshis, "so no more than the approved amount is ever sent."

## The stamp

The stamp on a statement says what Setrya actually observed. It never claims more.

| Stamp | What it means |
| --- | --- |
| `APPROVED, NOT PAID` | The payout is approved, and no transaction has been broadcast for it yet. |
| `PAYMENT PENDING` | A transaction is on its way and hasn't reached the confirmation threshold. |
| `CONFIRMED ON CHAIN` | The node saw the transaction at **Confirmations to count as paid** or more. |
| `PAYMENT NOT COMPLETED` | The transaction failed. |
| `HELD, NOT PAID` | The payout is held and wasn't sent. |

A confirmed statement adds that confirmation "is not a claim that the recipient independently verified the funds." If the partner [acknowledges receipt](#what-a-partner-sees), the statement also shows **Self-attested receipt**, which is their own declaration, separate from the chain.

## The statements list

**Statements** lists every statement with its **Reference**, **Partner**, **Period**, **Approved ZEC**, **Payment**, **Receipt**, **Version**, **Sharing** and **Generated** date. The list reminds you: "Not every statement means a payment succeeded. The payment column says exactly what was observed." **Sharing** shows **Link active**, **Revoked**, **Expired**, **Downloaded** or **Not shared**.

## Download or print

On a statement's page:

- **Print / PDF** opens the print view. Use your browser's print dialog to save a PDF.
- **Download CSV** downloads the statement's lines.

## Share a statement privately

1. Open the statement and find **Share privately**.
2. Set **Expires after (days)**, between 1 and 365. The default is 14 days, from the project's privacy settings.
3. Tick "I understand links can be forwarded, the host can see that a link was opened, and downloaded copies cannot be recalled".
4. Select **Create encrypted link**.
5. Select **Copy link** and send it to the partner. Then select **Done**.

"Setrya encrypts this one statement in your browser. The key goes into the link after the #, which browsers never send to a server. This host stores only ciphertext." That's why the link can't be shown again: "Copy it now. Setrya cannot show the key again, and anyone holding this link can open the statement until it expires or you revoke it."

Every link you've made is listed under the form. Select **Revoke link** to withdraw one. A link made for an earlier version keeps showing that version, so share again to send the current one.

## What a partner sees

The link opens a page with that one statement, decrypted in their browser. They can:

- select **Download PDF**,
- select **Copy payment reference**,
- select **How to verify with your wallet**, which explains how to find the incoming shielded transaction in a wallet that controls their address, and warns "Never share your seed phrase or viewing key to prove a payment. The issuer will not ask for it.",
- select **Acknowledge receipt**, tick **I confirm that I checked the payment in a wallet I control**, add an optional **Comment** of up to 280 characters, and select **Send acknowledgment**.

If the payment isn't confirmed yet, the page says "The issuer has not yet observed this payment confirmed on chain. Check the status again later."

If the link can't open, the partner sees one of these.

| What the partner sees | What it means |
| --- | --- |
| The key is missing from this link | The link was cut off before `#k=`. They need the complete link. |
| The key cannot open this statement | The link is incomplete, altered or for another statement. Nothing was revealed. |
| This statement link expired | The link passed its expiry date and the encrypted copy was removed. |
| This link was revoked | You withdrew it. A copy they downloaded earlier is still theirs. |
| Statement is temporarily unavailable | Try again in a moment. |
| You appear to be offline | Reconnect and reload. |

## Export several statements

On **Statements**, select **Export selected**, tick the statements you want, set an **Archive password** of at least 12 characters, tick **I understand this file contains private financial information**, and select **Encrypt and download**. Encryption happens in your browser. "The archive includes every selected partner's figures. It is for you, not for partners." Open it on your own machine with `node scripts/decrypt-export.mjs <file>` from the Setrya repository.
