This page covers what to back up, how to restore it, what to do if you lose a secret, and how Setrya picks up a payment that was interrupted. Back up before you settle your first period, not after something goes wrong.

## What to back up

You need three backups, kept in different places. Each one restores something the others can't.

| Back up | What it restores | Where to keep it |
| --- | --- | --- |
| Setrya's encrypted backup | Every record: projects, partners, agreements, imports, periods, payments, statements and the audit log | Off the settlement host |
| The host master key, `infra/vps/secrets/master.key` | Together with your vault passphrase, the ability to decrypt those records | Separate from the backup file |
| The wallet's 24 words | The ZEC in the payer account | Offline, written down |

Setrya's backups never contain wallet keys. If you lose the 24 words, Setrya can't help you recover the ZEC.

## Download an encrypted backup

1. Open **Settings**, then **Security and backups**.
2. Under **Encrypted backup**, enter **Your password** and choose a **Backup password**. It has to meet the same strength rules as your sign-in password.
3. Select **Download encrypted backup**. You'll get a file named `setrya-backup-` followed by today's date.

You can make 3 backups every 10 minutes. Store the backup password apart from the file.

## Check a backup

Under **Test a backup**, choose the **Backup file**, enter its **Backup password** and select **Verify backup**. Setrya decrypts the file in server memory and reports what it holds. Nothing is written.

## Restore a backup

A backup restores into a fresh, empty database on a settlement host with the same master key.

1. Install Setrya on a fresh host, run migrations, and put the same master key file in place.
2. From a checkout of the repository with dependencies installed, and `apps/api/.env.local` pointing at the new database and master key, run `pnpm --filter @setrya/api restore-backup <file>`. Enter the backup password when asked. The API's container image doesn't include this script, and the Compose stack doesn't publish the database, so run it where it can reach PostgreSQL, for example after publishing the database port on loopback for the restore.
3. Sign in with the original owner password, and unlock with the vault passphrase from the time of the backup.
4. Restore the wallet from its 24 words separately. Pipe them into the signer's `init` command with `--birthday` set to a block from before the wallet's first payment, then wait for it to sync.
5. Let Setrya reconcile every submitted or unknown transaction before you prepare anything new.

If you changed the vault passphrase after making a backup, that backup still needs the passphrase it was made with.

## If you lose your owner password

Reset it with `pnpm --filter @setrya/api owner:reset-password`, run from a checkout of the repository whose `apps/api/.env.local` points at your database. It asks for a new password, signs out every session, and leaves the vault alone. You still need your vault passphrase to unlock.

## If you lose your vault passphrase

Setrya can't recover it. Without the passphrase, the encrypted records can't be read, and no backup made under it can be restored. Your ZEC isn't affected, because the wallet doesn't depend on Setrya's vault. Restore the wallet from its 24 words to reach the funds.

## If you lose the wallet's 24 words

While the settlement host still runs, the wallet keeps working, because the signer stores the seed encrypted in its data volume. Make a new wallet, move the funds to it, and update `SETRYA_PAYER_ACCOUNT_UUID` before anything happens to that server. Once the host and its data volume are gone without the 24 words, the ZEC can't be recovered.

## When a payment is interrupted

A crash, a restart or a timeout can leave a payment in an unclear state. Setrya is built so that never pays anyone twice.

- The signed transaction is stored encrypted before it's broadcast. If the page reloads, the same bytes are used.
- Only one transaction per payer account is built at a time.
- If a broadcast times out, the payment moves to **Unknown broadcast outcome**. Setrya then checks the chain and the wallet before anything else happens.
- After a restart, payment jobs wait until you unlock the workspace again.

On the payment's page, these actions are available while its outcome is unknown.

| Action | What it does | When to use it |
| --- | --- | --- |
| **Refresh from node** | Asks the chain for the transaction's current state | Any time |
| **Investigate chain and wallet** | Looks the transaction up on the chain and in your wallet, then moves it on if it's found | First, after an unknown outcome |
| **Resubmit the same signed transaction** | Broadcasts exactly the stored bytes again. Same transaction ID, no new payment | When the investigation finds nothing and the transaction hasn't expired |
| **Declare not broadcast** | Records that the transaction never reached the network, and allows a new attempt | Only after its expiry height has passed |

Setrya refuses **Declare not broadcast** while the signed transaction could still be mined, with a message like "The signed transaction can still be mined until block 4552150 (chain is at 4552100). Wait until it expires before declaring it not broadcast." Any new attempt after that is a fresh proposal, with its own inspection and authorisation.

If a confirmed transaction disappears from the chain, Setrya marks it as reorged and keeps watching, because a reorganisation can still change it. [Payment states](/docs/payment-states) lists every state.
