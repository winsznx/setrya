The Setrya signer, `setrya-signer`, is the wallet that pays your partners. It is a light-client Zcash wallet built on librustzcash, the Zcash project's Rust libraries, and it runs on your settlement host next to the API. It holds one account, builds every payment as a PCZT (a partially created Zcash transaction), checks it against Setrya's privacy rule, proves it, signs it and broadcasts it. Setrya's API talks to it over a private network and never sees its keys.

## Why it exists

Setrya was designed around Zallet, the Zcash full-node wallet, running next to a Zebra node. As of October 2026 that pairing cannot follow the testnet:

- Testnet activated [NU7](/docs/glossary#nu7) at height 4,465,026. Zebra 7.0.0 follows it and moved its state database to format v29.
- Zallet's latest release, v0.1.0-beta.3, reads only the v28 format ([zcash/zallet#887](https://github.com/zcash/zallet/issues/887)). Its chain backend also runs only on Linux.

The signer needs no full node, which also saves the tens of gigabytes a Zebra state takes. It answers the same RPC methods Setrya's adapter calls on Zallet and Zebra, so switching back later means changing two URLs. [Architecture](/docs/architecture#wallet-backends) covers both backends.

## What a lightwalletd server learns

The signer reads the chain from a public lightwalletd server, `testnet.zec.rocks:443` on testnet and `zec.rocks:443` on mainnet by default.

| The server sees | The server cannot see |
| --- | --- |
| Your server's IP address and when it connects | Amounts |
| The wallet's birthday height, needed to start the note tree | Recipients |
| The raw bytes of every transaction you broadcast | Memos |
| Which transaction IDs you look up | Which notes belong to you, since decryption happens on your server |

A dishonest server could also withhold or misreport chain data, which a full node you run yourself would rule out. To hide your IP address, route the signer through Tor by setting a SOCKS5 proxy, for example `127.0.0.1:9050`, with `--socks5` at `init` or `socks5` in `config.toml`.

## Rules it enforces

The signer refuses anything outside Setrya's [FullPrivacy](/docs/glossary#fullprivacy) rule, so a bug or a compromised caller further up cannot weaken it.

- `pczt_create` accepts only the `FullPrivacy` policy with fund source `orchard`. Anything else is refused with error `-8`.
- It spends only [Ironwood](/docs/glossary#ironwood) notes. It never spends legacy Orchard notes, because moving them reveals the amount (ZIP 318), and never Sapling or transparent funds.
- Change goes back to Ironwood.
- Every recipient must be a unified address on the configured network with an Orchard receiver. Since NU6.3, an Orchard receiver is paid inside Ironwood.
- After building, the signer reads the PCZT back and refuses it if any transparent, Sapling or Orchard output slipped in.
- Amounts are decimal ZEC with at most 8 decimal places, greater than zero and within the 21 million ZEC supply. Exponent notation is refused.
- `pczt_inspect` reports `privacy_policy: "FullPrivacy"` only for PCZTs this process built. Setrya's own review treats anything else as a failure.
- `pczt_sign` and `pczt_extract` refuse PCZTs this process did not build.
- `pczt_extract` stores the transaction in the wallet and returns its hex and txid. It never broadcasts. Broadcasting is a separate `sendrawtransaction` call, so Setrya can store the signed bytes first.

## Commands

| Command | What it does |
| --- | --- |
| `setrya-signer init --network test --data-dir DIR` | Creates the wallet with one account named `payer`. Prints a 24-word recovery phrase once, the account UUID and an Orchard-only receiving address |
| `setrya-signer serve --data-dir DIR --listen 127.0.0.1:28232` | Syncs every 20 seconds and serves RPC |
| `setrya-signer address --data-dir DIR` | Prints a receiving address. Orchard-only by default |
| `setrya-signer balance --data-dir DIR` | Prints spendable balances by pool, in zatoshis |

### init options

| Option | Meaning |
| --- | --- |
| `--network test` or `--network main` | The network the wallet uses. It cannot change later |
| `--birthday H` | The first block height to scan. The default is the chain tip minus 100 |
| `--lightwalletd host:port` | A different lightwalletd server |
| `--socks5 host:port` | Route every connection through this SOCKS5 proxy |

To restore a wallet, pipe its recovery phrase to `init` on standard input and pass the original `--birthday`, so the scan starts early enough to find your funds.

### serve options

| Option | Meaning |
| --- | --- |
| `--listen ADDR` | Where RPC listens. The default is `127.0.0.1:28232` |
| `--allow-private-bind` | Allow a private network address, such as a container network |
| `--cookie-file PATH` | Where to write the RPC cookie. The default is `DATA_DIR/.cookie` |
| `--cookie-group-readable` | Write the cookie as mode 0640, so a client in the signer's group can read it |

The signer refuses to listen on a public address or on every interface (`0.0.0.0`). A private address needs `--allow-private-bind`.

### address options

| Option | Meaning |
| --- | --- |
| `--receiver orchard` | The default. Funds land in Ironwood and can pay right away |
| `--receiver sapling` | A Sapling address, for a funder that cannot create Orchard or Ironwood outputs |
| `--receiver transparent` | A transparent address, for a funder that can only pay transparent addresses. Everything about a transparent payment is public |

Sapling and transparent funds cannot pay under FullPrivacy. They have to be moved into Ironwood first, which reveals the amount.

## Data directory

| File | Contents |
| --- | --- |
| `config.toml` | Network, lightwalletd server, optional SOCKS5 proxy, birthday |
| `identity.txt` | The age identity that decrypts the seed, mode 0600 |
| `seed.age` | The recovery phrase, age-encrypted |
| `wallet.sqlite` | The wallet database |
| `.cookie` | The RPC credential, rewritten at every start, unless `--cookie-file` moves it |

Write the recovery phrase down and keep it offline. `identity.txt` and `seed.age` together are as sensitive as the phrase itself, so keep the directory on a volume only the service user can read. [Backups and recovery](/docs/recovery) covers what to back up.

## RPC methods

Every request is JSON-RPC 2.0 over HTTP POST, with HTTP Basic auth `__cookie__:<secret>` from the cookie file, the scheme Zallet and Zebra use. A missing or wrong credential gets HTTP 401.

| Group | Methods | Notes |
| --- | --- | --- |
| Wallet | `rpc.discover`, `getwalletstatus`, `getwalletinfo`, `z_listaccounts`, `z_getaddressforaccount`, `z_getbalanceforaccount` | `getwalletstatus` reports `locked: true` until the wallet has scanned to the tip |
| PCZT flow | `pczt_create`, `pczt_inspect`, `pczt_prove`, `pczt_sign`, `pczt_extract` | Parameter order and result fields follow Zallet |
| History | `z_viewtransaction`, `z_listtransactions` | Transactions that involve this wallet |
| Chain | `getinfo`, `getblockchaininfo` | Answered from lightwalletd, shaped like Zebra's |
| Chain | `sendrawtransaction`, `getrawtransaction`, `getrawmempool` | `getrawtransaction` leaves out `height` and `confirmations` while the transaction is in the mempool, and returns `-5` when it is unknown |

### Error codes

| Code | Meaning |
| --- | --- |
| `-32601` | Unknown method |
| `-32602` | Invalid parameters, such as an unreadable PCZT |
| `-8` | Policy refusal: wrong privacy policy or fund source, a rejected recipient, a bad amount |
| `-6` | Insufficient funds, with the amount needed including the fee |
| `-5` | No such transaction in the mempool or the chain |

## Known limits

- This librustzcash revision sets no NU7 height for mainnet. The pinned revision has to be upgraded before mainnet reaches its NU7 height.
- One account per data directory.
- Proving keys are built on the first proof after a start, which takes tens of seconds. Setrya's adapter retries once after a timeout.
- `z_viewtransaction` reports status and confirmations only, without detail for each output.
- Received funds become spendable after the wallet's default confirmation policy: 3 confirmations for the wallet's own change and 10 for funds received from others.
