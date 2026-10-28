# Security policy

Setrya moves real money and handles private financial records, so security reports get priority over everything else.

## Reporting a vulnerability

Report it privately through GitHub's "Report a vulnerability" button on this repository's Security tab. Don't open a public issue, and don't include real wallet seeds, keys or partner data in a report.

Include what you can of:

- the affected component (`apps/web`, `apps/api`, `services/signer`, a package) and commit
- steps to reproduce, or a proof of concept against a local or testnet install
- the impact as you understand it, for example funds at risk, data exposed, or a privacy policy bypassed

You'll get an acknowledgement within three working days and a fix or mitigation plan once the report is confirmed.

## Scope

These are in scope:

- Anything that could build, sign or broadcast a transaction the owner didn't approve, or one that differs from the approval.
- Anything that lets a transaction leave FullPrivacy, such as transparent outputs, pool crossings, or an inspection that is skipped or spoofed.
- Session, step-up, CSRF or edge-key bypasses between the web tier and the API.
- Exposure of decrypted data, the vault key, the master key, the signer seed or its RPC cookie.
- A statement link revealing another partner's data, or anything beyond its own statement.
- Duplicate payments after a crash or an unknown broadcast outcome.

These are out of scope:

- Findings that need an already compromised settlement host or a malicious owner.
- Metadata that a lightwalletd server learns by design. It's documented in `services/signer/README.md`.
- Testnet-only funds.

## Supported versions

Only the latest commit on `main` gets fixes. The signer is built on pre-release librustzcash crates that are pinned to one revision, and the wallet stack upstream is beta software. Use testnet or small, consenting amounts.
