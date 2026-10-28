Every payment Setrya makes is one Zcash transaction that pays one approved batch of partners. The transaction moves through a fixed set of states, and Setrya refuses any move that isn't on the list below. A state only changes on something Setrya observed from the wallet or the chain. Nothing advances on a timer.

## The happy path

1. **Preparing.** You chose **Prepare** for an approved batch. The wallet builds a PCZT under FullPrivacy from Ironwood notes.
2. **Prepared, awaiting authorisation.** The wallet's inspection matched the approval, check by check. Nothing is signed yet.
3. **Creating proofs and signing.** You authorised with your password. The job re-inspects the stored PCZT, then proves and signs it.
4. **Signed, not yet broadcast.** The signed bytes and the txid are stored, encrypted, before anything leaves your server.
5. **Broadcast.** The network accepted the transaction.
6. **In mempool.** The chain server sees the transaction, but it is not in a block yet.
7. **Confirming.** It is in a block, with fewer confirmations than the project's target.
8. **Confirmed.** It reached the target, 3 confirmations by default.

## Every state

| State | Label in the app | What it means |
| --- | --- | --- |
| `PREPARING` | Preparing | The wallet is building the transaction |
| `PREPARED_INSPECTED` | Prepared, awaiting authorisation | The inspection matched the approval. Waiting for you |
| `PROVING` | Creating proofs and signing | The job is proving and signing |
| `SIGNED_EXTRACTED` | Signed, not yet broadcast | Signed bytes are stored. Nothing has been sent |
| `BROADCAST_SUBMITTED` | Broadcast | The network accepted the transaction |
| `MEMPOOL_OBSERVED` | In mempool | Seen by the chain server, not yet mined |
| `CONFIRMING` | Confirming | Mined, below the confirmation target |
| `CONFIRMED` | Confirmed | Reached the confirmation target |
| `CANCELLED_BEFORE_SIGN` | Cancelled before signing | You cancelled, or a payee address changed after approval |
| `FAILED_PRE_BROADCAST` | Failed before broadcast | The inspection failed, the wallet failed, or an investigation found it was never broadcast |
| `BROADCAST_OUTCOME_UNKNOWN` | Outcome unknown, investigate | The broadcast timed out or the connection dropped. It may or may not have reached the network |
| `BROADCAST_REJECTED` | Broadcast rejected | The network refused the transaction |
| `STALE_OR_REORGED` | Reorged, re-confirming | A block that held it was replaced. Setrya watches it again |
| `INVESTIGATION_REQUIRED` | Investigation required | The chain doesn't know a transaction that was submitted or whose outcome is unknown |

## Allowed moves

| From | To |
| --- | --- |
| `PREPARING` | `PREPARED_INSPECTED`, `FAILED_PRE_BROADCAST`, `CANCELLED_BEFORE_SIGN` |
| `PREPARED_INSPECTED` | `PROVING`, `CANCELLED_BEFORE_SIGN`, `FAILED_PRE_BROADCAST` |
| `PROVING` | `SIGNED_EXTRACTED`, `FAILED_PRE_BROADCAST` |
| `SIGNED_EXTRACTED` | `BROADCAST_SUBMITTED`, `BROADCAST_OUTCOME_UNKNOWN`, `BROADCAST_REJECTED` |
| `BROADCAST_SUBMITTED` | `MEMPOOL_OBSERVED`, `CONFIRMING`, `CONFIRMED`, `BROADCAST_OUTCOME_UNKNOWN`, `BROADCAST_REJECTED`, `INVESTIGATION_REQUIRED` |
| `MEMPOOL_OBSERVED` | `CONFIRMING`, `CONFIRMED`, `INVESTIGATION_REQUIRED` |
| `CONFIRMING` | `CONFIRMED`, `STALE_OR_REORGED`, `MEMPOOL_OBSERVED` |
| `CONFIRMED` | `STALE_OR_REORGED` |
| `STALE_OR_REORGED` | `CONFIRMING`, `MEMPOOL_OBSERVED`, `CONFIRMED`, `INVESTIGATION_REQUIRED` |
| `BROADCAST_OUTCOME_UNKNOWN` | `MEMPOOL_OBSERVED`, `CONFIRMING`, `CONFIRMED`, `INVESTIGATION_REQUIRED`, `BROADCAST_SUBMITTED` |
| `INVESTIGATION_REQUIRED` | `MEMPOOL_OBSERVED`, `CONFIRMING`, `CONFIRMED`, `BROADCAST_SUBMITTED`, `FAILED_PRE_BROADCAST` |

`CANCELLED_BEFORE_SIGN`, `FAILED_PRE_BROADCAST` and `BROADCAST_REJECTED` are final. After one of them you can prepare the batch again, which builds a new transaction under a new lineage and needs its own inspection and authorisation.

Every move also checks a version number on the transaction. If two workers try to move it at once, the second gets a `CONFLICT` error and changes nothing.

## The inspection before signing

Preparing ends with the wallet's inspection of the PCZT, compared with the approval. Every check has to pass, or the transaction goes to `FAILED_PRE_BROADCAST` with nothing signed.

| Check | What it requires |
| --- | --- |
| Wallet proposal requires only FullPrivacy | The wallet built and reported the transaction under FullPrivacy. A missing policy fails |
| Transaction was created by this wallet | The PCZT came from the payer wallet |
| No transparent inputs or outputs | Nothing visible on the public chain |
| Nothing is sent into the closed Orchard pool | No Orchard output carries value |
| Funds are not legacy Orchard notes | The value moves inside Ironwood, not out of Orchard |
| No cross-pool amount is revealed | Exactly one pool's balance changes, by exactly the fee |
| Every approved payee has exactly one matching output | Matched by address and exact zatoshis |
| No unexpected recipient outputs | Only approved payees and the wallet's own change |
| Output total equals the approved total | To the zatoshi |
| Network fee matches the ZIP 317 conventional fee | 5,000 zatoshis per logical action, with a two-action minimum |

The diagnosis names the cause. **Not fully shielded** means a privacy check failed. **Prepared transaction does not match approval** means a payee, amount, total or fee check failed. The job runs the same inspection again on the stored PCZT before proving, so a transaction that changed in storage is never signed.

## When the outcome is unknown

A broadcast that times out may still have reached the network. Setrya never builds a new transaction for it, because that could pay twice.

1. The transaction moves to `BROADCAST_OUTCOME_UNKNOWN`, and a reconcile job starts looking it up.
2. If the chain server finds it, it moves on to `MEMPOOL_OBSERVED`, `CONFIRMING` or `CONFIRMED`.
3. If the chain doesn't know it, it moves to `INVESTIGATION_REQUIRED`.
4. From there you have two choices on the payment's page:
   - **Resubmit the same bytes.** Setrya checks the chain first, then sends the identical signed transaction again, with the same txid. That cannot create a second payment.
   - **Declare not broadcast.** Allowed only when the chain has never seen the txid and the chain is past the transaction's expiry height, so the signed bytes can no longer be mined. You record a reason, and the transaction becomes `FAILED_PRE_BROADCAST`.

## Reorgs

A transaction that was `CONFIRMING` or `CONFIRMED` and then shows up back in the mempool, or disappears, moves to `STALE_OR_REORGED`. Setrya keeps looking it up and moves it on as the chain settles. The reconcile job keeps watching a confirmed transaction until it is 10 confirmations past the target, because a reorg can still demote it until then.

## One payment at a time

Only one transaction per payer account can be in flight between `PREPARING` and broadcast. Preparing takes a database lock on the account, and a second **Prepare** gets "Another payment from this account is being built or signed. Finish or cancel it first."

## How payouts and periods follow

Each payout shows a simpler stage derived from its transaction. A payout counts as paid only when its transaction is `CONFIRMED`.

| Payout stage | Transaction states |
| --- | --- |
| Approved | No transaction yet |
| Prepared | `PREPARING`, `PREPARED_INSPECTED`, `PROVING` |
| Signed | `SIGNED_EXTRACTED` |
| Broadcast | `BROADCAST_SUBMITTED` |
| In mempool | `MEMPOOL_OBSERVED` |
| Confirming | `CONFIRMING`, `STALE_OR_REORGED` |
| Confirmed | `CONFIRMED` |
| Broadcast unknown | `BROADCAST_OUTCOME_UNKNOWN`, `INVESTIGATION_REQUIRED` |
| Cancelled | `CANCELLED_BEFORE_SIGN` |
| Failed | `FAILED_PRE_BROADCAST`, `BROADCAST_REJECTED` |

A period moves to **In payment** once any batch has a live transaction, and to **Payments resolved** once every batch is confirmed or finally failed, with at least one confirmed. [Approve and pay](/docs/approve-and-pay) walks through the screens.
