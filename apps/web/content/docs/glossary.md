Plain-word definitions of the Zcash and settlement terms you meet in Setrya and these docs. Each term has its own anchor, so other pages can link straight to it.

## Zcash

### ZEC

The currency of the Zcash network. Setrya pays every partner in ZEC. One ZEC is 100,000,000 [zatoshis](#zatoshi).

### Zatoshi

The smallest unit of ZEC, 0.00000001 ZEC. Setrya works in whole zatoshis. When a conversion lands between two zatoshis, it rounds down and records the remainder.

### Shielded

Encrypted on the chain. A shielded payment hides its sender, recipient, amount and memo from everyone except the people who hold the right keys. Setrya only sends fully shielded payments.

### Transparent

Public on the chain, like Bitcoin. A transparent address shows every amount sent to it and from it. Setrya refuses transparent payout addresses. Transparent addresses start with `t1` or `t3` on mainnet and `tm` or `t2` on testnet.

### Unified address

One Zcash address that bundles several [receivers](#receiver), so any wallet can pick the most private one it supports. Unified addresses start with `u1` on mainnet and `utest1` on testnet. Setrya checks every unified address against ZIP 316 before it accepts one.

### Receiver

One part of a [unified address](#unified-address), for one pool: transparent, [Sapling](#sapling) or [Orchard](#orchard). Setrya needs an Orchard receiver, because that is what lets it pay inside [Ironwood](#ironwood).

### Sapling

An older shielded pool. Its addresses start with `zs` on mainnet and `ztestsapling` on testnet. Paying a Sapling-only address from Ironwood would cross pools and reveal the amount, so Setrya holds those payouts and asks for a unified address.

### Orchard

The shielded pool that came before [Ironwood](#ironwood). Since [NU6.3](#nu6-3), nothing may be sent into Orchard. A payment to an Orchard receiver is delivered into Ironwood instead. Funds still in Orchard can only leave through a move that reveals the amount crossing pools (ZIP 318).

### Ironwood

The shielded pool added in [NU6.3](#nu6-3). It uses the same keys and address format as Orchard, with its own note tree. Setrya pays from Ironwood into Ironwood, so the payment stays inside one pool and reveals nothing.

### TEX address

A transparent-source-only address (ZIP 320) that accepts funds only from transparent inputs. It starts with `tex` on mainnet and `textest` on testnet. Setrya refuses TEX addresses, because a shielded payment can't reach one.

### NU6.3

The Zcash network upgrade that added the [Ironwood](#ironwood) pool and closed the Orchard pool to new funds. It activated on mainnet at height 3,428,143 on 28 July 2026 and on testnet at height 4,134,000.

### NU7

The Zcash network upgrade after NU6.3. It activated on testnet at height 4,465,026 on 4 October 2026, and mainnet activation is set for height 3,543,405. Wallets have to understand NU7 to keep building valid testnet transactions, which is why Setrya uses [its own signer](/docs/signer#why-it-exists).

### PCZT

A partially created Zcash transaction. It lets one program build a payment, another inspect it, and another prove and sign it, before it is turned into a final transaction. Setrya inspects every PCZT against your approval before anything is signed.

### FullPrivacy

The wallet policy Setrya requires for every payment: fully shielded, inside one shielded pool, with no transparent inputs or outputs and no amount revealed by crossing pools. A payment that would need a weaker policy is refused.

### ZIP 317

The Zcash rule for the conventional network fee: 5,000 zatoshis per logical action, with a minimum of two actions. Setrya checks that every prepared payment pays exactly this fee. See [Fees and limits](/docs/fees-and-limits).

### Viewing key

A key that can see a wallet's transactions but can't spend from it. The signer's wallet database holds its own viewing key, which identifies the account without exposing the seed.

### Seed phrase

The 24 words that recreate the payer wallet and every key in it. Anyone who has them can spend the wallet's ZEC. Setrya never stores them. The signer prints them once at `init`, and you keep them offline. Also called the recovery phrase.

### lightwalletd

A server that gives light wallets compact block data and accepts their transactions, so they don't need a full node. The signer uses one, by default `testnet.zec.rocks` or `zec.rocks`. It sees your server's IP address and the transactions you broadcast, but not amounts or recipients.

### Zallet

A full-node Zcash wallet, still in beta. Setrya's wallet adapter speaks its RPC methods, so Zallet can replace the signer once a release follows NU7.

### Zebra

The Zcash Foundation's full node. Zallet reads the chain from a Zebra node on the same machine. Setrya's adapter also speaks Zebra's chain methods, which the signer answers from lightwalletd.

## The chain

### Mempool

Where a broadcast transaction waits before a miner puts it in a block. A Setrya payment in the mempool shows as **In mempool**.

### Confirmation

A block on top of the one that holds a transaction, counting that block itself. More confirmations make the payment harder to undo. A Setrya payout counts as paid at the project's target, 3 confirmations by default.

### txid

A transaction's ID, a 64-character hex string. It shows that a transaction exists, but for a shielded payment it reveals neither the recipient nor the amount.

## Settlement

### Period

A span of time, such as a month, whose eligible fees Setrya turns into what each partner is owed. A period moves from **Draft** to **Frozen for review**, **Approved**, **In payment**, **Payments resolved** and **Closed**. See [Periods and exceptions](/docs/periods).

### Snapshot

The frozen record of everything a period's payouts depend on: the source rows, agreement versions, rates, address versions and the payer account. Setrya hashes it, and your approval is bound to that hash. If any input changes, the approval stops matching.

### Payout commitment

A Merkle root over every payout in an approved snapshot, stored on the approval and carried in each payment's memo. Each partner's statement includes a proof that their line is in it. See [Verifiable payouts](/docs/verifiable-payouts).

### Merkle root

A single hash that commits to a list of items. A short proof shows that one item is in the list without revealing the others. Setrya salts each item so the other hashes in a proof give nothing away.

### Exception

A row or payout that needs your decision before it can be paid, such as an unclassified row or an address that failed its check. An exception holds only the payouts it affects.

### Held payout

A payout Setrya will not pay yet, because something it depends on needs you. The reason is always shown next to it. Everyone else in the period can still be paid.

### Vault

The encryption that protects your records. Your vault passphrase, together with the host's master key, unwraps the key that encrypts partner names, addresses, agreements, revenue rows and statements. Unlocking the workspace opens the vault for your session. See [Keys, vault and sessions](/docs/security).

### Step-up

A fresh password confirmation for one sensitive action, such as approving a period or authorising a payment. It is tied to that action and the exact state it covers, and it can be used once.

### Edge key

The shared secret the web app sends on every request to the API. The API refuses any request without it, so only your own web app can reach it. See [API](/docs/api#edge-headers).
