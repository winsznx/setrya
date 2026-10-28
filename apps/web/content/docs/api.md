The Setrya API is the backend on your settlement host. It serves the web app and nothing else: every request has to come through the web tier, which proves itself with a shared key. This page covers how the two connect, the request rules, the response format, the error codes and every endpoint.

> The API has no public API keys. Routes can change between releases. Build on them only if you run your own installation.

## How requests reach the API

The browser never calls the API directly. It calls `/api/v1/...` on the web app's own origin, and the web app relays the request.

| Step | What happens |
| --- | --- |
| Browser to web app | A normal same-origin request to `/api/v1/...` with the session cookie |
| Web app to API | The relay forwards only `accept`, `content-type`, `cookie`, `origin`, `user-agent` and `x-setrya-request`, then adds the edge key and the client's address |
| API to web app | The relay passes back only `cache-control`, `content-disposition`, `content-type` and any `set-cookie` |

The relay refuses a request body over 4 MB with HTTP 413. If the API can't be reached, it answers HTTP 502 with code `INTERNAL` and the message "The settlement server is not reachable. Try again in a moment."

The web tier connects with three settings:

| Setting | Purpose |
| --- | --- |
| `SETRYA_API_URL` | The API's base URL, for example `https://api.example.com:8444` |
| `SETRYA_EDGE_KEY` | The shared secret, at least 32 characters, the same value as on the API |
| `SETRYA_API_CA` | The API's self-signed certificate in PEM. The web tier trusts only this certificate for the connection |

## Edge headers

Every request under `/api/` must carry the edge key. Without it, the API answers HTTP 403 with code `FORBIDDEN` and "This endpoint is not public."

| Header | Set by | Meaning |
| --- | --- | --- |
| `x-setrya-edge-key` | The web tier | The shared secret, compared in constant time |
| `x-setrya-client-ip` | The web tier | The browser's address, taken from `x-forwarded-for`. It is the only client address the API trusts, for rate limits and the audit log |

`GET /healthz` answers `{"ok":true}` without the edge key, for container health checks.

## Sessions and access levels

Signing in sets an `HttpOnly`, `SameSite=Strict` cookie named `setrya_session`. A session lasts 12 hours, or 7 days if you chose to stay signed in. The API stores only a SHA-256 hash of the token.

Each endpoint needs one of three access levels:

| Level | Needs |
| --- | --- |
| `none` | Nothing, for setup, sign-in and recipient links |
| `session` | A valid session |
| `unlocked` | A valid session and an unlocked vault |

A missing session gets `UNAUTHENTICATED`. A locked vault gets `VAULT_LOCKED`. Actions that move money, approve a period, export data or change security also need a fresh step-up token, which you get from `POST /api/v1/auth/step-up` with your password. A step-up is tied to one action and to the exact state it covers, such as the snapshot hash and the recipients, and is used up once spent.

## Request rules

Every request other than `GET` and `HEAD` must pass all three checks, or it gets HTTP 403 with code `CSRF_REJECTED`:

- The `Origin` header must be one of the origins in `SETRYA_PUBLIC_ORIGIN`, which is a comma-separated list.
- The body must be `application/json` or `multipart/form-data`.
- The header `x-setrya-request: 1` must be present.

JSON bodies may be up to 256 KB. A body that doesn't match the endpoint's schema gets `INVALID_INPUT` with a message for each field.

## Response format

A success returns HTTP 200:

```json
{ "ok": true, "data": { "id": "6f0c…" }, "requestId": "3d2b9a1e-…" }
```

Amounts are strings of whole zatoshis or exact decimals, never floating-point numbers. bigint values are sent as strings.

An error returns this shape:

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Check the highlighted fields.",
    "fieldErrors": { "displayName": "Enter a name" },
    "canRetry": false,
    "recoveryAction": "/sign-in"
  },
  "requestId": "3d2b9a1e-…"
}
```

`fieldErrors` and `recoveryAction` appear only when they apply. An unexpected failure returns `INTERNAL` with "Something failed on the server. Reference" and the first 8 characters of the request ID, which you can find in the API's logs. File downloads, such as CSV exports and backups, return the file itself instead of this envelope.

## Error codes

| Code | HTTP status | Meaning |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | No valid session |
| `STEP_UP_REQUIRED` | 401 | This action needs a fresh password confirmation |
| `FORBIDDEN` | 403 | Not allowed, for example a wrong password or an archived project |
| `CSRF_REJECTED` | 403 | The request failed the origin, content type or header check |
| `NOT_FOUND` | 404 | No such record, or not yours |
| `STATEMENT_REVOKED` | 410 | The statement link was revoked |
| `STATEMENT_EXPIRED` | 410 | The statement link expired |
| `INVALID_INPUT` | 422 | The body didn't pass validation |
| `VAULT_LOCKED` | 423 | Unlock the workspace first |
| `RATE_LIMITED` | 429 | Too many attempts. Wait a minute |
| `INTERNAL` | 500 | Unexpected server failure |
| `DUPLICATE_IMPORT`, `SOURCE_AMBIGUOUS`, `AGREEMENT_OVERLAP` | 409 | The import or agreement conflicts with existing records |
| `STALE_PERIOD_REVISION`, `RATE_REQUIRED`, `RATE_EXPIRED` | 409 | The period changed, or a rate is missing or expired |
| `ADDRESS_UNSUPPORTED`, `ADDRESS_CHANGED`, `CHAIN_MISMATCH` | 409 | The payout address or network doesn't fit the payment |
| `WALLET_UNAVAILABLE`, `WALLET_NOT_SYNCED`, `WALLET_LOCKED`, `INSUFFICIENT_SHIELDED_FUNDS` | 409 | The wallet can't pay right now |
| `PRIVACY_POLICY_REJECTED`, `TRANSACTION_MISMATCH`, `SIGNATURE_FAILED` | 409 | The wallet refused, or the prepared transaction didn't match the approval |
| `BROADCAST_OUTCOME_UNKNOWN`, `REORG_DETECTED` | 409 | See [Payment states](/docs/payment-states#when-the-outcome-is-unknown) |
| `RESTORE_FAILED` | 409 | A backup file couldn't be opened with that password |
| `CONFLICT` | 409 | The record changed or is in a state that doesn't allow this |

A few endpoints override the status, for example a refused setup token returns 403.

## Views

Server-rendered pages read their data from one endpoint:

```text
GET /api/v1/views/:name?param=value
```

A view returns the same envelope, encoded so that bigint, Date and Map values survive the trip. It is sent as `application/vnd.setrya.wire+json`, and those values are tagged:

```json
{ "$setrya": "bigint", "v": "460000000" }
{ "$setrya": "date", "v": "2026-10-28T12:00:00.000Z" }
{ "$setrya": "map", "v": [["partner-id", { "…": "…" }]] }
```

An unknown view name returns 404. Most views need `unlocked` access and take a `projectId` parameter.

| Group | Views |
| --- | --- |
| Gates | `auth.status` (access `none`, returns only `ownerExists`, `signedIn` and `unlocked`), `auth.unlock` (access `session`) |
| Workspace | `shell.home`, `shell.project`, `shell.overview`, `shell.activity` |
| Onboarding | `onboarding.layout`, `onboarding.hub`, `onboarding.workspace`, `onboarding.source`, `onboarding.import`, `onboarding.partner`, `onboarding.agreement`, `onboarding.wallet`, `onboarding.ready` |
| Revenue | `revenue.list`, `revenue.import`, `revenue.sources`, `revenue.importDetail` |
| Partners | `partners.list`, `partners.new`, `partners.detail`, `partners.edit` |
| Agreements | `agreements.list`, `agreements.new`, `agreements.detail`, `agreements.edit` |
| Periods | `periods.list`, `periods.new`, `periods.detail`, `periods.exceptions`, `periods.close`, `periods.review`, `periods.send` |
| Payments | `payments.list`, `payments.detail` |
| Statements | `statements.list`, `statements.detail`, `print.statement` |
| Wallet | `wallet.overview`, `wallet.activity`, `wallet.transactions` |
| Settings | `settings.index`, `settings.privacy`, `settings.settlement`, `settings.security`, `settings.integrations`, `settings.project` |

## Endpoints

All paths start with `/api/v1`. `:projectId` and the other path parameters are UUIDs.

### Setup and sign-in

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /bootstrap/status` | none | Whether an owner exists |
| `POST /bootstrap/owner` | none | Create the owner and vault once, with the setup token |
| `POST /auth/session` | none | Sign in |
| `DELETE /auth/session` | none | Sign out |
| `POST /auth/password` | unlocked | Change the password, which signs out every other session |
| `DELETE /auth/sessions` | unlocked | Sign out every other session |
| `POST /auth/step-up` | unlocked | Confirm your password for one action and get a step-up token |
| `POST /vault/unlock` | session | Unlock the workspace with the vault passphrase |
| `POST /vault/lock` | session | Lock the workspace now |
| `POST /vault/passphrase` | unlocked | Change the vault passphrase. Records are not re-encrypted |
| `POST /settings/auto-lock` | unlocked | Set the idle lock, 1 to 240 minutes |

### Projects and sources

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /projects` | unlocked | List projects |
| `POST /projects` | unlocked | Create a project |
| `GET /projects/:projectId` | unlocked | Read a project |
| `PATCH /projects/:projectId` | unlocked | Update a project's settings |
| `POST /projects/:projectId/onboarding` | unlocked | Record the onboarding step |
| `GET /projects/:projectId/sources` | unlocked | List revenue sources |
| `POST /projects/:projectId/sources` | unlocked | Add a source |
| `PATCH /projects/:projectId/sources/:sourceId` | unlocked | Update a source |
| `GET /projects/:projectId/search?q=` | unlocked | Search partners, periods and payments in the unlocked workspace |

### Revenue

| Method and path | Access | Purpose |
| --- | --- | --- |
| `POST /projects/:projectId/imports/preview` | unlocked | Upload one CSV. Returns its header, ten sample rows and the file hash |
| `POST /projects/:projectId/imports/normalize` | unlocked | Apply a mapping and see each row's type and issues |
| `GET /projects/:projectId/imports` | unlocked | List imports |
| `POST /projects/:projectId/imports` | unlocked | Commit an import |
| `POST /projects/:projectId/imports/:importId/void` | unlocked | Void an import |
| `GET /projects/:projectId/imports/:importId/csv` | unlocked | Download an import's rows as CSV |
| `POST /projects/:projectId/revenue/classify` | unlocked | Change how rows are classified |
| `POST /projects/:projectId/revenue/manual` | unlocked | Add a manual revenue entry |

### Partners and agreements

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /projects/:projectId/partners` | unlocked | List partners |
| `POST /projects/:projectId/partners` | unlocked | Add a partner |
| `PATCH /projects/:projectId/partners/:partnerId` | unlocked | Update a partner |
| `POST /projects/:projectId/partners/:partnerId/address` | unlocked | Set a new payout address version |
| `POST /wallet/validate-recipient` | session | Check an address against the ZIP 316 rules, this installation's network and the payer's pool. No outside lookup |
| `GET /projects/:projectId/agreements` | unlocked | List agreements |
| `POST /projects/:projectId/agreements` | unlocked | Create an agreement |
| `POST /projects/:projectId/agreements/check` | unlocked | Check a draft agreement for overlaps and pool commitments before saving |
| `POST /projects/:projectId/agreements/:agreementId/revisions` | unlocked | Add a new version of an agreement |
| `POST /projects/:projectId/agreements/:agreementId/end` | unlocked | End an agreement |

### Periods and rates

| Method and path | Access | Purpose |
| --- | --- | --- |
| `POST /projects/:projectId/periods/preview` | unlocked | Dry run of a period's calculation. Nothing is saved |
| `GET /projects/:projectId/periods` | unlocked | List periods |
| `POST /projects/:projectId/periods` | unlocked | Create a period |
| `GET /projects/:projectId/periods/:periodId` | unlocked | Read a period |
| `POST /projects/:projectId/periods/:periodId/recalculate` | unlocked | Recalculate a draft period |
| `POST /projects/:projectId/periods/:periodId/exceptions/:exceptionId/preview` | unlocked | See what a decision on an exception would change |
| `POST /projects/:projectId/periods/:periodId/exceptions/:exceptionId/resolve` | unlocked | Decide an exception |
| `POST /projects/:projectId/periods/:periodId/rates` | unlocked | Attach or clear an approved rate on a draft period, then recalculate |
| `POST /projects/:projectId/periods/:periodId/freeze` | unlocked | Freeze a hashed snapshot for review |
| `POST /projects/:projectId/periods/:periodId/approve` | unlocked | Approve the snapshot. Needs a step-up and the expected total in zatoshis |
| `POST /projects/:projectId/periods/:periodId/revise` | unlocked | Start a new revision |
| `POST /projects/:projectId/periods/:periodId/discard` | unlocked | Delete a draft that was never frozen or approved |
| `POST /projects/:projectId/periods/:periodId/close` | unlocked | Close a period, with a decision for each unpaid line |
| `GET /projects/:projectId/periods/:periodId/report` | unlocked | Download the period report as CSV |
| `GET /projects/:projectId/rates` | unlocked | List rates |
| `POST /projects/:projectId/rates` | unlocked | Enter a rate with its source and time |

### Payments

| Method and path | Access | Purpose |
| --- | --- | --- |
| `POST /payments/prepare` | unlocked | Build and inspect a transaction for an approved batch. Returns the existing one if a transaction is already in progress |
| `GET /payments/transactions/:txId` | unlocked | A transaction's state, txid, fee, confirmations and attempts. Never the PCZT or signed bytes |
| `POST /payments/transactions/:txId/sign` | unlocked | Authorise with a step-up token. Queues the prove, sign and broadcast job |
| `POST /payments/transactions/:txId/cancel` | unlocked | Cancel before signing, with a reason |
| `POST /payments/transactions/:txId/reconcile` | unlocked | Look the transaction up on the chain now |
| `POST /payments/transactions/:txId/resubmit` | unlocked | Resubmit the identical signed bytes after an unknown outcome |
| `POST /payments/transactions/:txId/declare-not-broadcast` | unlocked | Mark an investigated transaction as never broadcast, after its expiry height |
| `GET /projects/:projectId/payments/export` | unlocked | Download payouts as CSV. `addresses=1` adds addresses, `txids=0` leaves txids out |
| `GET /wallet/health` | session | The wallet and chain status. `fresh=1` skips the 15-second cache |

### Statements and sharing

| Method and path | Access | Purpose |
| --- | --- | --- |
| `GET /projects/:projectId/statements/:statementId/csv` | unlocked | Download a statement as CSV |
| `POST /projects/:projectId/statements/export` | unlocked | Return up to 500 statements to your browser, which encrypts them with a password before saving |
| `POST /projects/:projectId/statements/:statementId/shares` | unlocked | Store an encrypted share. Only ciphertext reaches the server |
| `POST /projects/:projectId/statements/:statementId/shares/:shareId/revoke` | unlocked | Revoke a share link |
| `GET /public-shares/:shareId` | none | Fetch a share's ciphertext for the recipient's browser to decrypt |
| `POST /public-shares/:shareId/acknowledgments` | none | Record the recipient's own acknowledgment, once per link |

### Backups

| Method and path | Access | Purpose |
| --- | --- | --- |
| `POST /backup` | unlocked | Download an encrypted backup of every table |
| `POST /backup/verify` | unlocked | Check that a backup opens with its password. Writes nothing |

## Rate limits

Unauthenticated and sensitive endpoints are limited for each client address or session, for example 8 sign-ins every 5 minutes for each address and each email, 6 unlock attempts every 5 minutes, 5 setup attempts a minute, 10 step-ups every 5 minutes, 10 prepares a minute and 30 share fetches a minute. A limited request gets `RATE_LIMITED` with `canRetry: true`.
