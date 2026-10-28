# setrya-signer

A light-client Zcash wallet for Setrya's settlement host. It builds, inspects, proves, signs and broadcasts fully shielded payments as PCZTs (partially created Zcash transactions), and serves them over a JSON-RPC interface that is a strict subset of Zallet's wallet RPC and Zebra's node RPC. Setrya's wallet adapter points both its Zallet and its Zebra URL at this one process.

It is built on [librustzcash](https://github.com/zcash/librustzcash) at the revision [zcash-devtool](https://github.com/zcash/zcash-devtool) pins (`eb38d7a`, October 2026), which supports Ironwood (NU6.3) and testnet NU7.

## Why it exists

Setrya's design calls for Zallet next to a Zebra node. As of October 2026 that pairing cannot follow testnet:

- Testnet activated NU7 at height 4,465,026. Zebra 7.0.0 follows it and moved its state database to format v29.
- Zallet's latest release, v0.1.0-beta.3 (2026-08-26), reads only v28 state ([zcash/zallet#887](https://github.com/zcash/zallet/issues/887); the NU7 work is open in #898). Zallet's chain backend also only runs on Linux.

This signer needs no full node, which also saves the tens of gigabytes a Zebra state takes. Once a Zallet release follows NU7, Setrya can switch back by changing two URLs.

## What a lightwalletd server learns

Chain data comes from a public lightwalletd server (by default `testnet.zec.rocks:443` or `zec.rocks:443`).

- **What the server sees:** your IP address and when you connect, the wallet's birthday height (needed to start the note tree), the raw bytes of every transaction you broadcast, and which transaction IDs you look up.
- **What it can't see:** amounts, recipients and memos. Those stay encrypted, and trial decryption happens locally.
- **Transparent address lookups:** the sync engine also asks about the account's transparent addresses. The signer never hands those out, so the lookups reveal nothing about payments.
- **Trust:** a dishonest server can withhold or misreport chain data, which a self-hosted full node would rule out.
- **Hiding your IP:** pass `--socks5 127.0.0.1:9050` at `init`, or set `socks5` in `config.toml`, to route every connection through Tor.

## Policy enforced here

The signer refuses anything outside Setrya's FullPrivacy rule, so a bug or a compromised caller further up cannot weaken it:

- `pczt_create` accepts only `FullPrivacy` with fund source `orchard`.
- It spends only Ironwood notes. It never spends legacy Orchard notes, because moving them reveals the amount (ZIP 318), and never Sapling or transparent funds.
- Change goes back to Ironwood.
- Every recipient must be a unified address on the configured network with an Orchard receiver. Since NU6.3, an Orchard receiver is paid inside Ironwood.
- After building, the signer re-reads the PCZT and rejects it if any transparent, Sapling or Orchard output slipped in.
- `pczt_inspect` reports `privacy_policy: "FullPrivacy"` only for PCZTs this process built. Anything else is reported as created elsewhere, which Setrya's review treats as a failure.
- `pczt_sign` and `pczt_extract` refuse PCZTs this process did not build.
- `pczt_extract` stores the transaction in the wallet and returns its hex and txid. It never broadcasts. Broadcasting is a separate `sendrawtransaction` call, so Setrya can persist the signed bytes first.
- The RPC listens on loopback by default. A private-network address needs `--allow-private-bind`, and public or wildcard addresses are refused.
- Every request needs the cookie in `DATA_DIR/.cookie` as HTTP Basic auth (`__cookie__:<secret>`), the same scheme Zallet and Zebra use.

## Usage

```sh
# Create the wallet. Prints a 24-word recovery phrase once, the account UUID and the
# Orchard-only receiving address. Pipe a phrase on stdin to restore instead.
setrya-signer init --network test --data-dir /var/lib/setrya-signer

# Sync every 20 seconds and serve RPC.
setrya-signer serve --data-dir /var/lib/setrya-signer --listen 127.0.0.1:28232

setrya-signer address --data-dir /var/lib/setrya-signer
setrya-signer balance --data-dir /var/lib/setrya-signer
```

Point Setrya at it:

```
ZALLET_RPC_URL=http://127.0.0.1:28232
ZALLET_RPC_COOKIE_FILE=/var/lib/setrya-signer/.cookie
ZEBRA_RPC_URL=http://127.0.0.1:28232
ZEBRA_RPC_COOKIE_FILE=/var/lib/setrya-signer/.cookie
SETRYA_PAYER_ACCOUNT_UUID=<printed by init>
SETRYA_FUND_SOURCE=orchard
```

Received funds become spendable after the wallet's default confirmation policy (3 confirmations for the wallet's own change, 10 for funds received from others).

### Data directory

| File | Contents |
|---|---|
| `config.toml` | network, lightwalletd server, optional SOCKS5 proxy, birthday |
| `identity.txt` | age identity that decrypts the seed (0600) |
| `seed.age` | the recovery phrase, age-encrypted |
| `wallet.sqlite` | the wallet database |
| `.cookie` | RPC credential, rewritten at each start |

Back up the recovery phrase offline. `identity.txt` and `seed.age` together are as sensitive as the phrase itself, so keep the directory on an encrypted volume that only the service user can read.

### RPC methods

| Method | Notes |
|---|---|
| Wallet: `rpc.discover`, `getwalletstatus`, `getwalletinfo`, `z_listaccounts`, `z_getaddressforaccount`, `z_getbalanceforaccount` | Account and sync status |
| PCZT flow: `pczt_create`, `pczt_inspect`, `pczt_prove`, `pczt_sign`, `pczt_extract` | Parameter order and result fields follow Zallet |
| Wallet history: `z_viewtransaction`, `z_listtransactions` | Transactions involving this wallet |
| Chain, Zebra-shaped: `getinfo`, `getblockchaininfo` | Answered from lightwalletd |
| Chain, Zebra-shaped: `sendrawtransaction`, `getrawtransaction`, `getrawmempool` | Answered from lightwalletd. `getrawtransaction` omits `height`/`confirmations` while the transaction is in the mempool, and returns `-5` when unknown |

## Build and test

```sh
cargo test
cargo clippy --all-targets -- -D warnings
cargo build --release
docker build -t setrya-signer .
```

The image listens on loopback inside its own network namespace by default. For a private container network, run `serve --listen <container-ip>:28232 --allow-private-bind` and never publish the port on the host.

## Known limits

- Mainnet NU7 is not set in this librustzcash revision. Upgrade the pinned revision before mainnet reaches its NU7 height.
- One account per data directory.
- Proving keys are built on the first proof after a start, which takes tens of seconds. Setrya's adapter retries once after a timeout.
- `z_viewtransaction` reports status and confirmations only, without per-output detail.
