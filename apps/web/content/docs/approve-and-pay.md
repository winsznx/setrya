Paying a period takes two separate decisions. First you approve the frozen snapshot, which says who gets how much. Then, for each transaction, you read the wallet's inspection of what it actually built and authorise it, and only then is anything signed. Setrya checks the built transaction against your approval to the zatoshi in between, and blocks it if anything differs.

## Before you start

- [Freeze the period](/docs/periods#freeze-for-approval). Only a period that's **Frozen for review** can be approved.
- Connect the wallet and fund it with enough confirmed ZEC in the Ironwood pool to cover the payouts plus the network fee. See [Wallet and funding](/docs/wallet).
- Know your owner password. Approving and authorising each need a fresh password confirmation.

## Review for approval

On the frozen period's page, select **Review for approval**. The **Review settlement** page shows:

- **Eligible to pay**, each payout with its amount owed, ZEC amount and the address's short fingerprint.
- **Held or excluded**, the rows that aren't part of this payment. "They stay visible as unpaid and can carry forward when the period closes."
- **Total to send**, the **Network fee**, which is "Provisional. Calculated by the wallet (ZIP 317) and shown before signing.", **Shielded available**, the **Funding account**, the **Policy** and the **Snapshot** hash.
- **Checks before approval**, which all have to pass.

| Check | What it confirms |
| --- | --- |
| **Frozen inputs unchanged** | The snapshot still matches the source rows, agreements, rates, addresses and payer account. |
| **No payee address changed after review** | Each payee's address version is the one you froze. |
| **Wallet is on testnet** (or mainnet) | The wallet reports the same network as this installation. |
| **Payer account exists in the wallet** | The configured payer account is there. |
| **Chain connection and wallet are in sync** | The chain connection and the wallet have both caught up. |
| **Enough confirmed shielded ZEC in one pool** | The spendable balance covers the payouts, plus the network fee. |
| **FullPrivacy enforced, no transparent outputs** | Always passes. "Fixed policy. Setrya has no setting that weakens it." |
| **Wallet supports the PCZT path** | The wallet offers every method the payment needs. |

If any check fails, the page says **Approval blocked** and lists them. Review and calculations stay available.

## Approve

1. Check each destination against its fingerprint.
2. Tick "I confirm X ZEC to these N destinations, checked by fingerprint".
3. Enter your password in **Confirm with your password**.
4. Select **Freeze and approve N payments**.

Approval records the snapshot against the payer account and network, creates one payout per partner, splits them into transactions, and issues each partner's statement. It also builds the payout commitment, a Merkle root over every approved payout, and puts it in each payment's memo as `setrya:v1 ref=<payment reference> root=<commitment>`. See [Verifiable payouts](/docs/verifiable-payouts). Nothing is signed or sent. The period page then says **Approved, ready to prepare the transaction**: "Approval is not payment."

Payouts are grouped into transactions of up to **Maximum recipients per transaction**, 10 by default. Each transaction is prepared and authorised on its own.

| What the screen says | What it means | What to do |
| --- | --- | --- |
| Password not accepted. | The password is wrong. | Try again. |
| That confirmation expired, was already used, or was for a different action. Confirm again. | The password confirmation is older than the step-up window, 300 seconds by default. | Confirm again. |
| The total you confirmed does not match the frozen total. Reload and review again. | The period changed while you were reviewing. | Reload. |
| Approval blocked: … | A check failed. | Fix what the check names. |
| Freeze the period before approving it. | The period isn't frozen. | Freeze it first. |

## Prepare a transaction

On the period page, select **Prepare payment** to open **Settle approved payments**. The page warns that "Signed transactions are generally irreversible". If the wallet isn't ready, it says preparing and signing are blocked and why, with a link to **Wallet status**.

Each transaction has its own panel, **Transaction 1 of 1** and so on, with its payees, the **Total to recipients**, and these stages: **Checking wallet**, **Preparing transaction**, **Inspecting privacy**, **Waiting for approval**, **Creating proofs**, **Signing**, **Broadcasting**, **Awaiting network** and **Confirmed**.

Select **Prepare transaction**. "Preparing asks the wallet service for a FullPrivacy proposal from one shielded pool and inspects it. Nothing is signed." Setrya then compares the wallet's inspection with your approval.

### What the inspection checks

| Check | What it confirms |
| --- | --- |
| **Wallet proposal requires only FullPrivacy** | The wallet built it under FullPrivacy and says so. |
| **Transaction was created by this wallet** | The wallet recognises the transaction as its own. |
| **No transparent inputs or outputs** | Nothing touches the public transparent pool. |
| **Value stays inside one shielded pool** | The money stays in Ironwood. |
| **Nothing is sent into the closed Orchard pool** | No output with value goes to Orchard. |
| **Funds are not legacy Orchard notes** | Shown only when the funds are still in Orchard, and then it fails. |
| **No cross-pool amount is revealed** | No value crosses between pools. |
| **Every approved payee has exactly one matching output** | Each payee is paid at their exact address and zatoshi amount. |
| **No unexpected recipient outputs** | The only other output is the wallet's own change. |
| **Output total equals the approved total** | The outputs add up to the approval. |
| **Network fee matches the ZIP 317 conventional fee** | The fee is exactly what the Zcash fee rule says for this transaction's size. |

When every check passes, the panel shows **Wallet inspection of the prepared transaction**, with **Recipients**, **Network fee** and **Total leaving account**. "Inspection is the wallet's constructor metadata. Proofs and signatures are verified cryptographically when the transaction is extracted, before anything is broadcast."

When a check fails, the transaction stops as **Failed before broadcast**, with a diagnosis of **Not fully shielded** or **Prepared transaction does not match approval**. Nothing was signed. Select **Prepare a new transaction** after reading it.

## Authorise

1. Read the inspection.
2. Enter your password.
3. Select **Authorise X ZEC transaction**. X is the total leaving your account, the payouts plus the fee.

Setrya then creates the proofs, signs, stores the signed transaction encrypted, and broadcasts it. Creating proofs "can take longer on first use while the wallet loads its proving keys." There's no progress percentage, because the wallet doesn't report one. "You can leave this page; the job is recorded and cannot be started twice."

If you don't want to go ahead, select **Cancel this preparation**, write a reason and confirm. "Nothing has been signed. Cancelling discards this proposal; you can prepare again."

| What the screen says | What it means | What to do |
| --- | --- | --- |
| Another payment from this account is being built or signed. Finish or cancel it first. | One transaction at a time per payer account. | Finish or cancel the other one. |
| A payee address changed after approval. The prepared transaction was cancelled; approve a new revision. | An address changed between preparing and authorising. | Start a new revision, freeze and approve again. |
| Recipients changed. Nothing was signed. | The payees no longer match the approval. | Prepare again. |
| This approval was invalidated. Approve the new revision first. | The period was revised after approval. | Approve the current revision. |
| Approval is for testnet but the wallet is on mainnet. | The wallet is on another network. | Check the settlement host's configuration. |
| The configured payer account differs from the approved one. | The payer account changed after approval. | Restore the account, or approve again. |
| This transaction is already signed. It cannot be cancelled, only investigated. | You tried to cancel after signing. | Follow it to confirmation. |

## Broadcast and confirmation

Once broadcast, the panel shows the **txid** with **Copy txid**, **Confirmations N of M**, and whether the payment is **Wallet-visible**. Select **Refresh from node** to check now. Setrya also checks on its own.

A payout shows **Confirmed** only after the transaction reaches **Confirmations to count as paid**, 3 by default. "This is chain evidence, not proof that the recipient saw the funds in their own wallet."

### When the outcome isn't clear

| State | What it means | What to do |
| --- | --- | --- |
| **Signed, not yet broadcast** | "The signed bytes are stored encrypted. Submission to the network is next. If this page reloads, the same bytes are used." | Nothing. It continues on its own. |
| **Outcome unknown, investigate** | "The node may or may not have accepted this transaction. Sending again is disabled." | Select **Investigate chain and wallet**. If it isn't found, select **Resubmit the same signed transaction**. |
| **Investigation required** | The investigation couldn't settle it. | Keep investigating, or use **Declare not broadcast** once it can no longer be mined. |
| **Reorged, re-confirming** | "The block holding this transaction is no longer on the best chain." | Nothing. Setrya keeps watching, and it usually reconfirms. |
| **Broadcast rejected** | The network refused the transaction. | Read the reason, then prepare a new transaction. |

Resubmitting always sends the exact bytes that were signed, never a new transaction. **Declare not broadcast** is "Allowed only when the node has never seen this txid and the signed transaction has passed its expiry height, so it can no longer be mined." Before then it's refused with "The signed transaction can still be mined until block N. Wait until it expires before declaring it not broadcast." You write **What you checked**, and a new attempt then needs fresh preparation and authorisation.

### Diagnoses

A failed transaction shows **Diagnosis:** with one of these.

| Diagnosis | What it means |
| --- | --- |
| **Wallet unavailable** | The wallet service didn't answer. |
| **Wallet did not answer in time** | The wallet timed out. |
| **Wallet locked** | The wallet is locked on the settlement host. |
| **Insufficient confirmed funds** | Not enough confirmed ZEC in the paying pool. |
| **Not fully shielded** | The proposal or inspection broke the FullPrivacy rule. |
| **Prepared transaction does not match approval** | The built transaction differs from what you approved. |
| **Wallet does not support the PCZT path** | The wallet is missing a method the payment needs. |
| **Unable to prove** | Proving or signing failed. |
| **Broadcast rejected** | The network refused the transaction. |
| **Unknown broadcast outcome** | The broadcast may or may not have reached the network. |
| **Determined not broadcast after investigation** | You declared it not broadcast after it expired. |

## The Payments page

**Payments** lists every payout with its **Reference**, **Partner**, **Period**, **Amount**, masked **Payout address**, **txid**, **Stage**, **Age** and **Last checked**. A second view lists the actual chain transactions. Several payouts can share one transaction, and "A txid does not reveal which recipient got which amount."

The figures at the top are **Confirmed**, **Broadcast, awaiting confirmations**, **Failed or needs investigation**, and **Network fees paid**, "By you, never deducted from partners". **Export CSV** downloads the payouts, with **Include transaction IDs** on and **Include full payout addresses** off by default.

There's no freeform send. "Every payment comes from an approved calculation."

Opening a payout shows its **Financial snapshot**, its **Calculation trail**, its **Transaction**, and **Recovery and attempts**, with buttons such as **Continue this exact transaction** or **Investigate chain and wallet** depending on its state.

## Close the period

When every transaction has reached a final state, select **Close period** on the period page.

1. Check **Reconciliation**: **Total owed**, **Approved ZEC**, **Confirmed paid**, **Held or unpaid** and **Network fees (operator)**.
2. For each unpaid row, choose **Carry forward** (or **Carry credit forward**), **Waive with reason**, or **Remain open**. Waiving needs a reason.
3. Add an optional **Close note**.
4. Tick "I approve closing this period. Unpaid rows are recorded as chosen above, never as paid."
5. Select **Close period**.

A closed period can't be reopened. "Corrections go into a later period as linked adjustments." Closing is refused while a transaction is still in flight: "N transaction(s) are still in flight or under investigation. Resolve them before closing." After closing, **Final package** opens the period's statements and evidence.
