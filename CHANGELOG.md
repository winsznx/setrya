# Changelog

## Unreleased

- The web app and API are now split. `apps/web` holds no database or keys and reads typed page views from `apps/api` over an edge-key-authenticated, certificate-pinned connection.
- Added `services/signer`, a librustzcash light-client wallet that is Ironwood- and NU7-aware and serves Setrya's wallet and chain RPC. Released Zallet can't follow testnet past NU7 (zcash/zallet#887).
- PCZT review changes:
  - It now requires Ironwood as the paying pool after NU6.3.
  - It rejects valued Orchard outputs and flags legacy Orchard funds.
  - It checks the ZIP 317 conventional fee.
  - It fails closed when the inspection reports no privacy policy.
- The unified address parser now enforces the ZIP 316 Revision 0 consumer rules: MUST-understand metadata, mixed transparent receivers, receiver lengths and a required shielded receiver.
- Added a Docker Compose stack and bootstrap script for the settlement host, plus CI.
