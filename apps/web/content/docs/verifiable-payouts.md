When you pay partners, each of them has to trust that you paid them by the same approved numbers as everyone else. Setrya lets every partner check that from their own wallet, without learning anything about the other partners.

## What a partner can check

When a partner opens their statement link, the page shows **Verify this payout** with three checks. They all run in the partner's browser, and nothing is sent anywhere.

| Check | What it means |
| --- | --- |
| **Your line matches this statement** | The committed line names this statement and carries the amount owed and the zatoshis paid that the statement shows. |
| **Your line is part of the approved payment** | A short proof rebuilds the payment's commitment from this partner's line plus hashes of the other lines. |
| **The payment memo carries the same commitment** | The memo attached to their shielded payment contains that same commitment. |

The page also shows the exact memo the partner's wallet should display for this payment, and a box where they can paste the memo from their wallet to compare. Zcash wallets such as Zashi and Zingo show a payment's memo. The memo is encrypted to the partner, so nobody else can read it.

Together, these show that the partner's line is part of the exact snapshot you approved, and that the payment they received was sent against it.

## How it works

1. **At approval**, Setrya turns every approved payout into a line, called a leaf. Each leaf holds the period, the revision, the partner's statement reference, the agreement version, the amount owed, the currency, the zatoshis paid, and a random 32-byte salt. Leaves never hold partner names.
2. Setrya hashes the leaves into a Merkle tree, using the same construction as Certificate Transparency (RFC 6962), and stores its root on the approval. You see it as **Commitment** on the period and payment pages.
3. **Every payment's memo** then reads `setrya:v1 ref=<payment reference> root=<commitment>`. The memo travels inside the shielded payment, encrypted to its recipient.
4. **Each statement** carries that partner's leaf and an inclusion proof: the hashes needed to rebuild the root from their leaf.

The salt makes each leaf hash a hiding commitment. A partner sees the hashes of other lines in their proof, but can't work out an amount or a reference from them.

## Check it without Setrya

On the statement page, a partner can select **Download proof file**. The open-source verifier checks it with its own implementation, using only Node.js:

```
node scripts/verify-payout.mjs setrya-proof-ST-XXXX.json --memo "setrya:v1 ref=... root=..."
```

Each check prints `PASS` or `FAIL`, and the script exits non-zero if anything fails.

## For auditors

On the period's close page, select **Download commitment bundle**. It holds every leaf, salts included, plus each payment's memo, so an auditor can rebuild the whole tree. Keep it private: it reveals every partner's amount. Running the verifier on the bundle checks that every leaf matches its stored hash, that the leaves rebuild the approved root, and that every memo carries that root.

## What this does not prove

- **That every partner got the same root.** A single partner sees only their own memo. To confirm everyone was paid against one snapshot, partners can compare commitments with each other, or an auditor can check the bundle.
- **That the fee figures are right.** The amounts start from the fee export your platform gave you. Setrya doesn't verify that report independently.
- **Anything about payments made before this feature.** Approvals made earlier have no commitment, and their statements show no **Verify this payout** panel.

It also doesn't replace the chain. Confirmations still come from the chain, and the partner's wallet is still the authority on what arrived. See [Payment states](/docs/payment-states) and [Statements and sharing](/docs/statements).
