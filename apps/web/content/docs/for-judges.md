This page is a five-minute tour of a real Setrya workspace on Zcash testnet, ending with a payment you receive yourself. Everything you see is live: the payments are real shielded testnet transactions, paid in TAZ, the test coin, which has no value.

The workspace is shared. Everyone signing in with the demo login sees the same records, and anything that could lock other people out is turned off: changing the password or vault passphrase, signing other sessions out, backups and archiving a project. Each approval can pay at most 0.05 TAZ.

## Sign in

1. Open [setrya.xyz/sign-in](https://setrya.xyz/sign-in) and open **Judges: demo login** above the form. It shows the email, password and vault passphrase.
2. Enter the email and password, then select **Sign in**.
3. On **Unlock workspace**, enter the vault passphrase. The page repeats it for you.

The workspace opens on the **Testnet launch** project. A note at the top of every page says it's the shared demo workspace.

## See a period that was already paid

1. Open **Periods** and select **October creator fees**.
2. Open **Source rows**. The trading volume row is excluded, with the reason "Row is trading volume, not fees earned". Volume isn't money the business earned, so no one gets a share of it.
3. Open **Partner payouts**. Each line shows the fee base, the agreement rate, the conversion rate and the exact ZEC owed, rounded down to whole zatoshis.
4. Open **Payments** in the sidebar and select the confirmed payment. Its transaction ID is `0e73c774f62126365794efbba9ec1710121c123d42a4e1ca51c1cd65c753ce44`. One fully shielded transaction paid both partners, and it confirmed on chain about three minutes after it was broadcast.

[Approve and pay](/docs/approve-and-pay) explains each stage that payment went through.

## Open a statement the way a partner does

1. Open **Statements** and select one.
2. Confirm that you understand links can be forwarded, then select **Create encrypted link**.
3. Open the link on your phone. You see that partner's own statement and nothing about the other partner. The key to decrypt it sits after the `#` in the link, so it never reaches the server.

[Statements and sharing](/docs/statements) covers what the stamp on a statement means.

## Pay yourself

For this part you need a Zcash testnet wallet. [Zingo](https://zingolabs.org) can switch to testnet. Copy a receiving address from it. It needs an Orchard receiver, which a unified address starting with `utest1` from a current wallet has.

Give yourself your own project, so you don't collide with other judges:

1. Open **Settings**, then **Project**, and select **Add project**. Name it after yourself and select **Create project**.
2. Open **Revenue**, then **Sources**, and select **Add source**. Enter a **Source name** such as "Creator fees" and a **Platform label**, then select **Save source**.
3. Open **Partners** and add yourself. Paste your address into **Zcash unified address** and wait for **Shielded capable**. Tick the confirmation and select **Save partner**.
4. Open **Agreements** and select **New agreement**. Pick yourself as **Partner**, set **Effective from** to 1 September 2026 and **Rate** to 20, tick the snapshot confirmation and select **Activate**.
5. Download the [sample fee export](https://setrya.xyz/samples/sample-fees.csv). Open **Revenue**, select **Import revenue** and choose the file. Select **Preview mapping**, then **Continue to classify**. Mark row #3, the refund, as eligible with a short reason, select **Review commit**, tick the review confirmation and select **Commit import**.
6. Select **New settlement period** for 1 to 31 October 2026 and name it. Continue through the steps. At the rate step select **Enter a quote**, set **Rate value X** to 10000, enter a **Quote source** such as "Judge test rate", tick the approval and select **Save approved rate**. Then select **Create draft period**. Your share comes to 0.023 TAZ, under the 0.05 TAZ cap.
7. Select **Review exceptions**, choose **Exclude with reason** for the trading volume row, give a reason and select **Save decision**.
8. Select **Freeze for approval**, then **Freeze snapshot**. On the review page, confirm the total, enter the demo password and approve.
9. Open the period's **Settle** page and select **Prepare transaction**. Read the wallet's inspection: every check has to pass before anything can be signed.
10. Enter the demo password and authorise the transaction. Setrya proves, signs and broadcasts it, then follows it to confirmation. Select **Refresh from node** if you want to check sooner.

A few minutes later the payment shows up in your wallet. On the public chain, nobody can see that you were paid or how much.

## If something doesn't work

| What you see | What it means | What to do |
| --- | --- | --- |
| "This is a shared demo workspace, so this action is turned off." | You tried something the demo blocks, such as a backup or a password change. | Nothing. The rest of the workspace still works. |
| "The demo workspace pays at most 5000000 zatoshis per approval." | Your payouts add up to more than 0.05 TAZ. | Use a higher **Rate value X**, then recalculate and approve again. |
| **Not ready to pay** on the Settle page | The payer wallet's last payment is still confirming, so it has no confirmed funds right now. | Wait a minute or two and select **Refresh from node**. |
| The workspace asks you to unlock again | Demo unlocks end after a period without activity, and always within an hour. | Enter the vault passphrase again. |

To run Setrya for your own business, see [Getting started](/docs/getting-started).
