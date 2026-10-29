# Changelog

## Unreleased

- Verifiable payouts. Approval commits every payout line to a salted RFC 6962 Merkle root, stored with the approval and written into each recipient's shielded memo. Statements carry each partner's inclusion proofs and a "Verify this payout" panel; auditors download the full bundle; `scripts/verify-payout.mjs` checks either offline.
- Public testnet sandbox at `/try`: a separate installation pays a visitor's own address 0.01 TAZ through the real approval, inspection, signing and confirmation steps, then hands them a sealed statement they can verify.
- Demo mode (`SETRYA_DEMO_MODE=1`) for a shared judge workspace: blocks password, passphrase, session, backup and archive changes, caps each approval, refuses mainnet and shows the demo login on sign-in.
- The web app and API are now split. `apps/web` holds no database or keys and reads typed page views from `apps/api` over an edge-key-authenticated, certificate-pinned connection.
- Added `services/signer`, a librustzcash light-client wallet that is Ironwood- and NU7-aware and serves Setrya's wallet and chain RPC. Released Zallet can't follow testnet past NU7 (zcash/zallet#887).
- PCZT review changes:
  - It now requires Ironwood as the paying pool after NU6.3.
  - It rejects valued Orchard outputs and flags legacy Orchard funds.
  - It checks the ZIP 317 conventional fee.
  - It fails closed when the inspection reports no privacy policy.
- The unified address parser now enforces the ZIP 316 Revision 0 consumer rules: MUST-understand metadata, mixed transparent receivers, receiver lengths and a required shielded receiver.
- Added a Docker Compose stack and bootstrap script for the settlement host, plus CI.
