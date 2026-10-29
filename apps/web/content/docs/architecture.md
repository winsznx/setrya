Setrya runs as four parts. The web app renders pages and holds no data. The API owns your records and the payment pipeline. PostgreSQL stores everything, encrypted where it matters. The signer holds the wallet keys and talks to the Zcash network. This page shows how they connect and what each one can see.

## The four parts

```text
 browser ──HTTPS──▶ web app (Next.js, for example on Vercel)
                      │  server side only: edge key and a pinned TLS certificate
                      ▼
                 API (settlement host)
                   │                 │
                   ▼                 ▼  private network, cookie auth
               PostgreSQL       setrya-signer
                                     │
                                     ▼  gRPC over TLS, optionally through Tor
                               lightwalletd server
```

| Part | Code | Runs on | Holds |
| --- | --- | --- | --- |
| Web app | `apps/web` | Any Node.js host, Vercel included | Nothing but the edge key and the API's certificate |
| API | `apps/api` | The settlement host | Sessions, the unlocked vault key in memory, the payment job runner |
| Database | PostgreSQL 16 | The settlement host | Every record, with sensitive fields encrypted |
| Signer | `services/signer` | The settlement host | The wallet seed, encrypted at rest, and the wallet database |

## Web app

The web app renders every page on the server. It loads each page's data from a named [view](/docs/api#views) on the API and relays browser calls to `/api/v1` through one route. It never reads the database and never sees a key.

Two values connect it to the API:

- `SETRYA_EDGE_KEY`, a shared secret the API requires on every request.
- `SETRYA_API_CA`, the API's self-signed certificate. The web app trusts only that certificate for the connection, so nobody else can stand in for the API.

The browser only ever talks to the web app's own origin. Because of that, the API needs no public certificate and can sit on a port of its own.

## API

The API is a Hono server on Node.js 22. It checks the edge key, then the session, then whether the vault is unlocked, before any handler runs. It also checks the request's origin on every mutation. [API](/docs/api) lists its endpoints and rules.

The API also runs the durable job loop. Jobs live in PostgreSQL. The loop claims them with `FOR UPDATE SKIP LOCKED` and a 15-minute lease, so a job that crashed is picked up again once its lease lapses. Two job types move money:

| Job | What it does |
| --- | --- |
| `prove_sign_broadcast` | Re-inspects the stored transaction, proves, signs, stores the signed bytes, then broadcasts |
| `reconcile_tx` | Looks the transaction up on the chain and moves its state on what it observes |

[Payment states](/docs/payment-states) covers each step.

## Database

PostgreSQL holds projects, sources, revenue rows, partners, agreements, periods, approvals, payments, statements, sessions and the audit log. Partner names, addresses, agreement terms, revenue rows, prepared transactions, signed bytes and statements are encrypted field by field with AES-256-GCM. Each field is bound to its table, row and column, so a ciphertext copied into another row fails to decrypt.

The data key that encrypts those fields is itself wrapped by your vault passphrase together with the host master key. It exists unwrapped only in the API's memory while your workspace is unlocked. [Keys, vault and sessions](/docs/security) covers the vault in full.

## Signer

The signer is a light-client Zcash wallet built on librustzcash. It keeps one account, syncs compact blocks from a lightwalletd server every 20 seconds, and serves the part of Zallet's wallet RPC and Zebra's chain RPC that Setrya uses. [The Setrya signer](/docs/signer) covers it in detail.

The API reaches the signer at a fixed private address, `172.31.77.10:28232`, and authenticates with the signer's cookie. The signer writes that cookie to its own shared volume, which the API mounts read-only. The API never sees the signer's data directory, where the encrypted seed lives.

## The settlement host

The settlement host runs the API, the signer and PostgreSQL with Docker Compose, from `infra/vps`.

| Service | Network | Published | Memory limit |
| --- | --- | --- | --- |
| `db` | `data` (internal only) | No | 512 MB |
| `signer` | `wallet`, at `172.31.77.10` | No | 1.5 GB |
| `migrate` | `data` | No | One-shot, runs before the API |
| `api` | `data` and `wallet` | Port 8444, TLS | 768 MB |

The `data` network has no route out, so the database is reachable only from the API and the migration job. The API runs as uid 10002, which no host account uses, and joins the signer's group 10001 only to read the RPC cookie. `infra/vps/bootstrap.sh` creates the master key, the database password, the edge key, the setup token, the TLS certificate and `api.env`. Re-running it keeps the secrets that already exist.

## Wallet backends

The API talks to a wallet through one adapter, which speaks Zallet's wallet methods and Zebra's chain methods. Any backend that answers those methods works:

| Backend | Chain data from | Status |
| --- | --- | --- |
| Setrya signer | A lightwalletd server | Used today. Follows Ironwood and NU7 on testnet |
| Zallet with a co-located Zebra node | Your own full node | Supported by the adapter. The latest Zallet release, v0.1.0-beta.3, cannot follow testnet past NU7 ([zcash/zallet#887](https://github.com/zcash/zallet/issues/887)) |

Switching backends means changing `ZALLET_RPC_URL` and `ZEBRA_RPC_URL`. With the signer, both point at the signer.

## What each part can see

| Part | Can read | Cannot read |
| --- | --- | --- |
| Web app | Pages as they render for a signed-in owner | The database, the vault key, the seed |
| API | Every record while your workspace is unlocked | The seed and the signer's data directory |
| Database | Encrypted fields and plain metadata such as dates and states | Anything encrypted, without the vault key |
| Signer | Its own wallet and the transactions it builds | Partner names, agreements or revenue |
| lightwalletd server | Your server's IP address, request timing, the raw bytes you broadcast | Amounts, recipients, memos |

[Privacy model](/docs/privacy) goes further on what each viewer learns.

## The public sandbox

The sandbox behind [setrya.xyz/try](https://setrya.xyz/try) is a second, separate installation on the same host: its own PostgreSQL database, master key, signer wallet (at `172.31.78.10`) and API, published on port 8446. It shares no keys or data with an operator's workspace. The web app reaches it through its own relay at `/api/sandbox/v1`, which never forwards cookies, so an operator's session can't reach it.

With `SETRYA_SANDBOX=1`, the API creates its own owner on first start and drives its own routes in-process for each claim: a sample ZEC project, the visitor as a partner, approval with a payout commitment, inspection, signing and confirmation. Claims run one at a time. Each visitor address can claim once, and each IP three times an hour. The statement link is sealed on the server and its key is returned only to the claimant. The sandbox refuses to start on mainnet.

## Demo mode

With `SETRYA_DEMO_MODE=1`, a testnet workspace can be shared with people who aren't its owner. Changing the password or vault passphrase, signing other sessions out, backups and archiving a project are refused with `DEMO_MODE`. Each approval is capped by `SETRYA_DEMO_MAX_ZAT`, and every unlock ends within an hour. Startup fails if demo mode is on with `SETRYA_NETWORK=mainnet`.
