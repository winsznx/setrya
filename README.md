# Setrya

Settle revenue-sharing obligations privately, with a clear statement for every partner.

You import the fees you earned, apply versioned partner agreements, resolve exceptions, then freeze and approve a hashed snapshot. Setrya pays each partner with a fully shielded ZEC transaction that your own settlement host builds, inspects against the approval and signs. Each partner gets a statement of their own, optionally through an encrypted link that only shows them their line.

Setrya is single-owner and self-hosted. Custody is operator-managed on your own infrastructure. It is not a hosted or browser wallet.

## Architecture

```
 browser ──HTTPS──▶ web (Next.js, e.g. Vercel)            no database, no keys
                      │  server-side only: edge key + pinned TLS certificate
                      ▼
                 API (Hono, settlement host)               auth, vault, period engine, payment jobs
                   │                 │
                   ▼                 ▼  private network, cookie auth
               PostgreSQL       setrya-signer             seed (encrypted at rest), PCZT build/prove/sign
                                     │
                                     ▼  gRPC over TLS (optionally Tor)
                               lightwalletd (testnet.zec.rocks / zec.rocks)
```

- **Web** (`apps/web`) renders every page on the server from typed API views and relays browser calls to `/api/v1`. It holds no data and no secrets beyond the edge key.
- **API** (`apps/api`) owns sessions, the encrypted vault, imports, the period engine, approvals with step-up, the payment state machine and its durable job runner. It accepts requests only from the web tier, which proves itself with `SETRYA_EDGE_KEY`.
- **Signer** (`services/signer`) is a librustzcash light-client wallet that is Ironwood- and NU7-aware. It serves the subset of Zallet's wallet RPC and Zebra's chain RPC that Setrya uses, so the same adapter can also drive Zallet plus Zebra once Zallet follows NU7 ([zcash/zallet#887](https://github.com/zcash/zallet/issues/887)). Its README covers what a lightwalletd server can and cannot learn.

The payment path is `pczt_create` (FullPrivacy, Ironwood only), then `pczt_inspect`, compared with the approval to the zatoshi, including the ZIP 317 fee. Then come owner step-up, `pczt_prove`, `pczt_sign` and `pczt_extract`. The signed bytes are stored encrypted before `sendrawtransaction`, and confirmations come from chain lookups. An unknown broadcast outcome is investigated and resubmitted byte for byte, never rebuilt.

## Live testnet proof

On 29 October 2026, Setrya ran a full settlement on Zcash testnet through https://setrya.xyz:
- It imported a fee export and excluded a trading-volume row as an exception, then froze and approved the period.
- It paid two partners in one fully shielded Ironwood transaction:
  [`0e73c774f62126365794efbba9ec1710121c123d42a4e1ca51c1cd65c753ce44`](https://testnet.zcashexplorer.app/transactions/0e73c774f62126365794efbba9ec1710121c123d42a4e1ca51c1cd65c753ce44).
- It confirmed on chain 196 seconds after broadcast.
- Each partner's own wallet then showed exactly the approved amount in Ironwood: 0.115 TAZ and 0.0575 TAZ.

`tests/e2e/live-testnet.mjs` repeats that run against any deployment.

## Layout

```
apps/web                 Next.js app: public pages, operator workspace, recipient view, API relay
apps/api                 HTTP API, typed page views, services, payment pipeline and job runner
services/signer          Rust light-client wallet (PCZT, Ironwood, lightwalletd)
packages/domain          Exact money, CSV import, agreements, period engine, snapshots, ZIP 316 parser, wire codec
packages/security        Argon2id, AES-256-GCM field encryption, vault key wrapping, sealed backups, redacted logs
packages/wallet-adapter  Wallet and chain RPC client, method allowlist, PCZT inspection review
packages/db              Drizzle schema and migrations (PostgreSQL 16)
infra/docker             API container image
infra/vps                Compose stack and bootstrap for the settlement host
tests/e2e                Playwright browser journeys
tests/integration        RPC test harness (not a Zcash node)
```

## Run locally

Requirements: Node.js 22.12+, pnpm 10 and PostgreSQL 16. The signer also needs Rust stable.

```sh
pnpm install
node scripts/setup-keys.mjs secrets/master.key        # prints a one-time SETRYA_SETUP_TOKEN
cp apps/api/.env.example apps/api/.env.local          # DATABASE_URL, master key, setup token, SETRYA_EDGE_KEY
cp apps/web/.env.example apps/web/.env.local          # same SETRYA_EDGE_KEY, SETRYA_API_URL=http://127.0.0.1:8444
createdb setrya && DATABASE_URL=postgres://localhost:5432/setrya pnpm db:migrate
pnpm dev:api                                          # http://127.0.0.1:8444
pnpm dev:web                                          # http://localhost:3217
```

Open `/setup-owner` once to create the owner and vault. The route closes afterwards. Without a wallet connection Setrya runs in accounting mode. Imports, calculations, review and statements all work, and every send control stays locked.

To pay on testnet locally, run the signer (see `services/signer/README.md`). Then point `ZALLET_RPC_URL` and `ZEBRA_RPC_URL` at it, with both cookie files set to its `.cookie`.

## Deploy

The settlement host runs the API, the signer and PostgreSQL with Docker Compose. The web app deploys to any Node host, and Vercel works.

1. **Copy the repository to the host.**
2. **Create the secrets.** In `infra/vps`, run:

   ```sh
   PUBLIC_ORIGIN=https://your.domain API_HOSTS="api.your.domain <ip>" ./bootstrap.sh
   ```

   It writes the master key, database password, edge key, setup token, a self-signed TLS certificate and `api.env`.
3. **Create the wallet.** Run:

   ```sh
   docker compose run --rm --no-deps --entrypoint setrya-signer signer init --network test --data-dir /data
   ```

   Write down the 24 words, and put the printed account UUID into `api.env` as `SETRYA_PAYER_ACCOUNT_UUID`.
4. **Start the stack** with `docker compose up -d --build`. Only the API is published, on port 8444 over TLS. Every service has a memory limit.
5. **Configure the web tier.** Set `SETRYA_API_URL=https://api.your.domain:8444`, `SETRYA_EDGE_KEY` (from `secrets/edge_key`) and `SETRYA_API_CA` (the PEM in `secrets/tls.crt`). On Vercel, set the project root to `apps/web` with "include files outside the root directory" on, then run `vercel deploy --prod` from the repository root.

Updating the stack means syncing the source and running `docker compose up -d --build` again. Migrations run first, in their own one-shot container.

## Tests

```sh
pnpm typecheck
pnpm test                 # domain, security and wallet-adapter unit tests
pnpm test:journeys        # resets the LOCAL database, then drives the web app and API in a browser against the RPC harness
cd services/signer && cargo clippy --all-targets -- -D warnings && cargo test
```

`tests/integration/stub-rpc/server.mjs` answers with Zallet- and Zebra-shaped responses over an in-memory chain. It injects faults: `mismatch`, `transparent`, `timeout_once` and `reject`. It exercises Setrya's state machine and UI. It is not a Zcash node and proves nothing about real payments. Real payments are tested on testnet through the signer.

## Operations

- **Backups.** Settings, then Security, downloads an encrypted backup of every table. Restore it into a fresh database with `pnpm --filter @setrya/api restore-backup <file>`. Restoring needs the backup password, the same master key and the vault passphrase. Wallet keys are never included, so keep the signer's 24 words separately.
- **Lost owner password.** Run `pnpm --filter @setrya/api owner:reset-password` on the host. It revokes all sessions and leaves the vault alone.
- **Exports.** `node scripts/decrypt-export.mjs <file>` opens password-encrypted statement archives.
- **Verify a payout.** `node scripts/verify-payout.mjs <proof.json | bundle.json>` checks a partner's proof file or an auditor's commitment bundle with its own implementation, so it needs nothing from Setrya. See [Verifiable payouts](https://setrya.xyz/docs/verifiable-payouts).

## Known limits

- One owner per installation. There are no multi-user approvals, TOTP or passkeys yet.
- There are no payment disclosure proofs. ZIP 311 is a draft without Ironwood support.
- The light-client route trusts a lightwalletd server for chain data, and that server sees the host's IP address and the broadcast transaction bytes. A self-run node, through Zallet and Zebra once Zallet supports NU7, removes both.
- Legacy Orchard funds can't pay under FullPrivacy until they are migrated to Ironwood, which reveals the amount (ZIP 318).
- PDF export uses the browser's print dialog on the canonical print view.

## License

Licensed under either of [Apache License 2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT), at your option. See [LICENSE](LICENSE). Security reports go through [SECURITY.md](SECURITY.md), and contributions through [CONTRIBUTING.md](CONTRIBUTING.md).
