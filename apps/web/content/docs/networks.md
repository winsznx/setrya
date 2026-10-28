Zcash runs on more than one network. Each Setrya installation settles on exactly one of them, and every address, account and transaction is checked against it, so money and records from different networks never mix.

## The three networks in plain words

Mainnet is the live Zcash network, where ZEC is real money. Testnet is a public practice network. Its coin is called TAZ and has no value. Regtest is a private network you run yourself for development, where you make the blocks.

The networks work the same way, but nothing moves between them. A testnet address can't receive mainnet ZEC, and a payment on one network never shows up on another.

## How Setrya picks its network

The settlement host sets one network in `SETRYA_NETWORK` in `api.env`: `mainnet`, `testnet` or `regtest`. In production the API refuses to start without it. There's no network switch in the app. The badge in the sidebar, **MAINNET**, **TESTNET** or **REGTEST**, shows which one this installation settles on.

The wallet service is set to a network when you create its wallet, with `--network test` or `--network main`.

## How Setrya keeps networks apart

| Check | What happens |
| --- | --- |
| Partner payout addresses | An address for another network is flagged as the wrong network, and that partner's payouts stay held |
| Wallet health | The wallet's network is read from its receiving address. If it differs from `SETRYA_NETWORK`, the health check says "Wallet is on testnet but Setrya is configured for mainnet", or the reverse, and sending stays locked |
| Approvals | Each approval records its network. A payment is refused with "Approval is for mainnet but the wallet is on testnet." if the two differ |
| Payer account | If the configured payer account differs from the one in the approval, the payment is refused |

Addresses carry their network in their prefix, as the table shows.

| Address type | Mainnet | Testnet | Regtest |
| --- | --- | --- | --- |
| Unified address | `u1…` | `utest1…` | `uregtest1…` |
| Sapling address | `zs1…` | `ztestsapling1…` | `zregtestsapling1…` |
| Transparent address | `t1…`, `t3…` | `tm…`, `t2…` | Same as testnet |

Setrya refuses transparent and TEX addresses as payout addresses on every network, because a transparent payment shows its amount and recipient publicly.

## What's live on each network

| | Testnet | Mainnet | Regtest |
| --- | --- | --- | --- |
| Imports, agreements, periods and statements | Yes | Yes | Yes |
| Shielded payments through the signer | Yes | Not yet, see below | Not set up |
| Chain server the signer uses by default | `testnet.zec.rocks:443` | `zec.rocks:443` | You provide one |
| Funding the payer wallet | Faucets not paying on 28 October 2026 | Any wallet that can pay an Orchard receiver | You mine it |

The signer is built on a pre-release revision of the Zcash Rust libraries that knows testnet's NU7 upgrade but not mainnet's. Until that revision is updated, keep payments on testnet. Setrya's RPC test harness, used by its automated tests, only imitates a wallet and proves nothing about real payments.

## Network upgrades that matter

Zcash changes its rules at set block heights, called network upgrades.

- **NU6.3, Ironwood.** It added the Ironwood shielded pool. Since it activated, a wallet that sends to an Orchard receiver delivers into Ironwood, and nothing may be sent into the old Orchard pool. Setrya pays from Ironwood and refuses any transaction that sends value into Orchard. Funds left in Orchard have to be moved to Ironwood before they can pay, and that move reveals the amount.
- **NU7.** It activated on testnet at block 4,465,026. Wallet software has to know about it to build valid transactions. The released Zallet wallet, v0.1.0-beta.3, can't follow testnet past it ([zcash/zallet#887](https://github.com/zcash/zallet/issues/887)), which is why Setrya ships its own signer.

## Where to look up transactions

A shielded transaction only shows that it happened and when, so a block explorer tells a partner little more than that. Setrya tracks confirmations itself through the wallet service. Statements show the transaction ID and the confirmations Setrya observed, and [Statements and sharing](/docs/statements) explains what a partner can check in their own wallet.
