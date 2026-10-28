# Contributing

## Setup

Follow "Run locally" in the README. You need Node.js 22.12+, pnpm 10 and PostgreSQL 16. The signer also needs Rust stable.

## Before you open a pull request

```sh
pnpm typecheck
pnpm test
pnpm test:journeys                     # drops and recreates your LOCAL `setrya` database
(cd services/signer && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test)
```

CI runs all of these except the journeys.

## Ground rules

- **Money is exact.** Amounts are bigint zatoshis or `Dec` values. Never use floats, and never round silently. A residual is recorded, not dropped.
- **Privacy rules fail closed.** If an inspection can't prove a transaction is single-pool, fully shielded and exactly what was approved, it blocks signing. Don't add a path that skips the review.
- **No fabricated state.** A payment stage only advances on real wallet or chain evidence. Use the RPC harness in tests, never in the product.
- **Keep the boundary.** The web tier never imports server code. Pages read typed views from `apps/api/src/views` and import types from `@setrya/api/contract` only.
- **Keep secrets in the server.** Keys, seeds, cookies and decrypted partner data never reach the browser or the logs.
- **No type-check escapes.** No `any`, no `@ts-ignore` and no `@ts-expect-error`. No empty `catch`.
- **Migrations.** Change `packages/db/src/schema.ts`, then run `pnpm db:generate` and commit the generated migration.

## Commits and pull requests

Keep each pull request to one change, and say what it changes and how you tested it. A change to the payment pipeline, the signer policy or the inspection review needs a test that shows the unsafe case is rejected.

By contributing you agree your work is dual licensed under MIT OR Apache-2.0, as described in `LICENSE`.
