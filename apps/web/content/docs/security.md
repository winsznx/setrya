This page explains who holds the keys that move money, how your records are encrypted, what each sign-in step protects, and the checks that run before a payment is signed. It ends with the risks we already know about.

## Three secrets, three jobs

Setrya keeps the secret that moves money apart from the secrets that protect your records. Losing one never exposes the others, and none of them can stand in for another.

| Secret | What it protects | Where it lives | If you lose it |
| --- | --- | --- | --- |
| Sign-in password | Access to your account | Hashed with Argon2id in the database | Reset it on the host. See [Backups and recovery](/docs/recovery#if-you-lose-your-owner-password) |
| Vault passphrase | Your encrypted records | Never stored. Only you know it | Encrypted records can't be read. Setrya can't recover them |
| Wallet seed, 24 words | The ZEC in the payer account | Encrypted on the settlement host, and your offline copy | The ZEC can't be recovered |

Setrya's own backups never contain the wallet seed, so back up the 24 words separately.

## Who holds the spending keys

The spending keys belong to the wallet service on your settlement host, the [Setrya signer](/docs/signer). Its seed is stored encrypted in the signer's data volume, which nothing else on the host can read.

- The API never stores or sees the seed. It asks the signer to build, prove and sign each transaction.
- The API reaches the signer over a private network with a credential the signer writes to its own shared folder. A public address for the wallet connection is refused at startup.
- Your browser never receives a partially built transaction, the signed bytes or any wallet credential. It can only call Setrya's own API.

You hold the keys, on infrastructure you control. Anyone with full control of your settlement host could also reach them, so treat that server like a wallet.

## How your records are encrypted

Partner names, contacts, notes and payout addresses, agreement terms, revenue rows and raw CSV fields, calculations, snapshots, statements and audit details, and prepared and signed transaction bytes are all encrypted in the database with AES-256-GCM.

- A data key encrypts them. That data key is wrapped by a key built from your vault passphrase, using Argon2id, combined with the host's master key. The master key lives in a file outside the database. Neither the passphrase nor the master key is enough alone.
- Each encrypted field is bound to its table, row and column, so a value copied into another row fails to decrypt.
- Amounts, currencies, dates, statuses, transaction IDs and row counts are stored in clear so the database can enforce its rules. Someone with database access can see how many partners and payments you have and their sizes, but not who they are.

When you unlock, the data key sits in the API's memory for your session. Locking, signing out, the idle timeout and a restart all drop it. Payment jobs that resume after a restart wait until you unlock again.

## Sign-in, unlock and the idle lock

| Step | What you enter | How long it lasts |
| --- | --- | --- |
| **Sign in** | **Email** and **Password** | 12 hours, or 7 days with **Keep me signed in on this device for 7 days** |
| **Unlock workspace** | **Vault passphrase** | Until you lock, sign out, or go idle for the auto-lock time |

The auto-lock time is 15 minutes by default. Change **Lock after inactivity (minutes)** under **Auto-lock** in **Settings**, then **Security and backups**, to anything from 1 to 240 minutes. The new time applies from your next unlock. **Lock** in the sidebar, or **Lock workspace** on the Settings page, locks it straight away.

Changing your password signs out every session, including the one you're using, and locks the vault. **Sign out other sessions** ends every session except this one. **Change passphrase** re-wraps the data key without re-encrypting your records. Backups made before the change still need the passphrase they were made with.

## The confirmation money movement needs

Some actions need your password again, right before they happen. Setrya calls this step-up.

| Action | Window | What the confirmation is tied to |
| --- | --- | --- |
| Approve a period | **Step-up window (seconds)**, 300 by default | The frozen snapshot, the network and the payer account |
| Authorise a transaction | The same window | That exact prepared transaction |
| Export data and change security settings | 120 seconds | That one action |

The server works out what a confirmation covers from its own records, so the browser can't get one for different values. Each confirmation works once. If it has expired, was already used, or was for a different action, Setrya says "That confirmation expired, was already used, or was for a different action. Confirm again." Set the window from 60 to 900 seconds in **Settings**, then **Settlement defaults**.

## What runs before a payment is signed

When you prepare a payment, the wallet builds the transaction under its FullPrivacy policy, and Setrya inspects it before you can authorise it. Every check has to pass.

- The proposal was built under FullPrivacy, and the wallet says so. A missing policy counts as a failure.
- There are no transparent inputs or outputs.
- Value stays inside one shielded pool, Ironwood, and nothing is sent into the closed Orchard pool.
- Every approved partner has exactly one output with their address and the exact zatoshi amount, and there are no other recipients besides the wallet's own change.
- The total paid equals the approved total.
- The network fee equals the ZIP 317 conventional fee for that transaction. See [Fees and limits](/docs/fees-and-limits).

If any check fails, nothing is signed and the payment shows a diagnosis. [Approve and pay](/docs/approve-and-pay) shows what each one looks like.

## How the web app and the API trust each other

The web app and the API can run on different machines, so every request between them is authenticated.

- The API only answers requests that carry the shared edge key, compared in constant time.
- The web app checks the API's TLS certificate against the one made for your settlement host, so it can't be pointed at an impostor.
- A change, such as an approval, is only accepted from your web app's origin, as JSON or a file upload, with Setrya's own request header. A form on another site can't forge one.
- Your session cookie is `HttpOnly`, `SameSite=Strict`, and `Secure` in production. The database stores only a hash of its token.

## Rate limits

| What | Limit |
| --- | --- |
| Sign-in | 8 tries per 5 minutes, per address and per email |
| Unlock | 6 tries per 5 minutes, per session |
| Step-up confirmations | 10 per 5 minutes, per session |
| Encrypted backups | 3 per 10 minutes |
| Opening a shared statement link | 30 per minute, per address |
| A partner's acknowledgment | 5 per minute, per address |

## Known risks

- The signer is built on pre-release Zcash libraries pinned to one revision. Use testnet, or small amounts you can afford to lose.
- The signer learns about the chain from a lightwalletd server, which sees your server's IP address and the transactions you broadcast. See [Privacy model](/docs/privacy#what-the-chain-server-sees).
- One owner per installation. There are no multi-user approvals, and no two-factor sign-in or passkeys yet.
- Anyone who controls the settlement host while your workspace is unlocked can read your records, and can reach the wallet's keys.
- Setrya doesn't verify the fee figures your platform reports. It works from what you import.
