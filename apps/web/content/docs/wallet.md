The payer wallet is the Zcash wallet that pays your partners. It runs on your settlement host, as the Setrya signer or as Zallet, and holds the spending keys there. Setrya never sees or shows its seed. The **Wallet** page reads its health and balances, shows the address you fund it at, and lists what the wallet itself can see.

## The wallet's status

Open **Wallet** from the sidebar under **System**. The header shows the network badge and one status badge, which also appears at the bottom of the sidebar.

| Badge | What it means |
| --- | --- |
| **Ready to pay** | Every check below passes. |
| **Not ready to pay** | The wallet is reachable, but at least one check fails. |
| **Wallet offline** | The wallet service or the chain connection doesn't answer. |
| **Wallet not connected** | No wallet connection is configured on this server. |

Select **Refresh** to check again now.

When no wallet is configured, the page says **Accounting mode**: "No wallet connection is configured on this server. Everything except sending works." Imports, calculations, review and statements all work. Every send control stays locked.

## Health checks

The **Health** panel lists every check, each with its own detail line.

| Check | What it confirms |
| --- | --- |
| **Chain connection available** | Setrya can reach the chain connection. The detail names what it's connected to. |
| **Wallet service available** | Setrya can reach the wallet service. |
| **Chain sync current** | The chain connection and the wallet have caught up with the network. |
| **Network is testnet** (or mainnet) | The wallet reports the network this installation is configured for. |
| **Wallet unlocked** | The wallet can sign. If not, unlock it on the settlement host. "Setrya never stores its passphrase." |
| **Payer account exists** | The account set in `SETRYA_PAYER_ACCOUNT_UUID` is in the wallet. |
| **Ironwood-compatible PCZT path** | The wallet offers `pczt_create`, inspect, prove, sign and extract. |
| **Shielded spendable balance** | The wallet has spendable shielded ZEC in one pool. |
| **RPC private** | The wallet connection is on loopback or a private network, which the configuration enforces. |

The **Settle** page and the approval checks use the same results. A failing check blocks approval and preparing a payment, and the screen says which one.

## Balances

| Figure | What it shows |
| --- | --- |
| **Spendable shielded balance** | Ironwood funds with at least the minimum number of confirmations. Payments spend from Ironwood only, so no other pool is added in. |
| **Pending incoming** | Always **Not reported**. "The wallet reports confirmed balances by pool." |
| **Reserved for approved payouts** | What approved, unpaid payouts add up to. "Local planning only. Not locked on chain." |
| **Next payment requirement** | The same amount, "Plus the ZIP 317 fee the wallet calculates". It's highlighted when it's more than the spendable balance. |

**Balance by pool** breaks the wallet down into **Ironwood**, **Orchard**, **Sapling** and **Transparent**.

Payments are paid from **Ironwood** only. Since the NU6.3 network upgrade nothing can be sent into Orchard, and funds still in Orchard can't pay under FullPrivacy. Orchard funds are shown in their own row but never counted as spendable. Moving Orchard funds into Ironwood reveals the amount crossing, and Setrya never does it for you.

Two warnings can appear above the figures.

- **Some funds are still in the Orchard pool**: "Payments spend from Ironwood only, so Orchard funds are not counted as spendable."
- **Funding requires a different privacy policy or conversion**: the account only holds transparent funds, "which cannot pay under FullPrivacy." Shield them with your wallet first. "Setrya never downgrades the policy to spend them."

## Fund the wallet

The **Receive** card shows the payer account's receiving address as a QR code and a masked address you can reveal and copy. It's a "Unified Address with an Orchard receiver only, so incoming funds land shielded in the Ironwood pool." That's the address to fund. Funds that arrive there are ready to pay with, once they're confirmed.

With the Setrya signer, the same address comes back each time. With Zallet, each refresh asks the wallet for a fresh diversified address of the same account, and every one of them pays into the same account.

Only send from a wallet that can pay an Orchard receiver on the same network as this installation. On testnet, that's testnet ZEC, also called TAZ. Some testnet faucets can only pay transparent or Sapling addresses. Funds received that way land in the wrong pool for Setrya, which has no built-in way to move them into Ironwood. Shield them into Ironwood with another wallet, or fund from a wallet that pays Orchard receivers.

Received funds count as spendable once they have the project's **Minimum input confirmations**, which is 1 unless you change it in the project's settlement settings. Payments spend under the same threshold. On the settlement host, `setrya-signer address` prints the receiving address. `setrya-signer balance` prints balances under the signer's own default policy, which waits longer (3 confirmations for your own change, 10 for funds from others), so it can show less than the Wallet page.

## What the wallet can see

**Recent wallet transactions** lists the wallet's own transactions, and **All wallet activity** opens the full list. Each row shows the **txid**, the **Direction**, the amount **Visible to this wallet**, the **Date**, **Confirmations**, the **Fee**, and whether it's a **Matched** Setrya payout or **Unmatched wallet activity**.

"This is a wallet-scoped view, not a public-chain payment disclosure, and it can include transfers Setrya did not make." Funding transfers show up here as unmatched activity.

## Settings that affect the wallet

In **Settings**, **Settlement defaults**:

- **Minimum input confirmations**: "Notes must be this deep before the wallet may spend them." The default is 1.
- **Confirmations to count as paid**: "No payout shows Confirmed before this depth." The default is 3, and it can't be lower than the minimum input confirmations.

**Settings**, **Wallet integrations** opens **Integrations**, which shows the same connection status with **Check health**. **Download diagnostics** saves the wallet health report as `setrya-diagnostics.json`, with the account ID and connection name removed, for sharing when you ask for help.
