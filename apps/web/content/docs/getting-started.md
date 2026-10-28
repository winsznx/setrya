This page takes you from an empty server to a first reviewed period. You'll set up the settlement host, deploy the web app, create the owner account, walk through the six setup steps and fund the payer wallet. Read each warning on the way. This software moves real money.

## Before you start

You need four things.

- A Linux server for the settlement host, with Docker and Docker Compose. It runs the API, the database and the wallet service, and keeps the spending keys.
- A host for the web app. Vercel works, and so does any Node.js 22.12 or newer.
- A domain, with one name for the web app and one for the API, such as `example.com` and `api.example.com`.
- About 10 minutes for the setup, plus time for the wallet to sync.

Start on testnet. The wallet service is built on pre-release Zcash libraries, and [Mainnet, testnet and regtest](/docs/networks) explains what works on each network today.

## Set up the settlement host

The settlement host runs everything in `infra/vps` as one Compose project, with a memory limit on each service. Only the API is published, on port 8444 over TLS.

1. Copy the repository to the server.
2. In `infra/vps`, create the secrets and the API's settings. Use your web app's address as `PUBLIC_ORIGIN`, and every name and IP the web app will use to reach the API as `API_HOSTS`:

   ```sh
   PUBLIC_ORIGIN=https://example.com API_HOSTS="api.example.com 203.0.113.7" ./bootstrap.sh
   ```

   This writes the host master key, the database password, the edge key, a one-time setup token, a self-signed TLS certificate for the API, and `api.env`. Running it again keeps the secrets it already made.
3. Create the payer wallet:

   ```sh
   docker compose run --rm --no-deps --entrypoint setrya-signer signer init --network test --data-dir /data
   ```

   It prints a 24-word recovery phrase once, the account UUID, and an address that only has an Orchard receiver. Write the 24 words down and keep them offline. Setrya can't recover them for you.
4. Open `api.env` and set `SETRYA_PAYER_ACCOUNT_UUID` to the account UUID from step 3.
5. Start the stack with `docker compose up -d --build`. Database migrations run first, in their own container, then the API starts.

To restore a wallet you already have instead of creating one, pipe its 24 words into the `init` command on standard input, and pass `--birthday` with a block height from before its first payment.

## Point your domain at it

Add these records at your DNS provider. The web app's records come from your web host. Vercel shows its own values when you add the domain to the project.

| Type | Name | Value | For |
| --- | --- | --- | --- |
| A | `api` | Your server's IP address | The API on the settlement host |
| A or CNAME | `@` or `www` | The value your web host gives you | The web app |

Browsers never call the API directly. Only the web app's server does, and it checks the API's certificate against the one `bootstrap.sh` made, so the API doesn't need a public certificate.

## Deploy the web app

The web app holds no data and no keys. It needs three settings to reach the API.

| Setting | Value |
| --- | --- |
| `SETRYA_API_URL` | `https://api.example.com:8444` |
| `SETRYA_EDGE_KEY` | The contents of `infra/vps/secrets/edge_key` |
| `SETRYA_API_CA` | The PEM text of `infra/vps/secrets/tls.crt` |

On Vercel, set the project's root directory to `apps/web` and turn on including files outside the root directory, then run `vercel deploy --prod` from the repository root. The API refuses any request without the edge key, and refuses changes from any origin other than `PUBLIC_ORIGIN`.

## Create the owner account

Each installation has one owner. Open `/setup-owner` on your web app. The page only works until an owner exists.

1. Under **Owner account**, fill in **Display name**, **Email**, **Sign-in password**, **Confirm password** and **Time zone**. The email only identifies the account. Setrya never sends it anything.
2. Under **Workspace vault**, choose a **Vault passphrase** and confirm it. It has to be different from your sign-in password. Together with the host's master key, it encrypts partner names, addresses, agreements, revenue rows and statements.
3. Under **Installation**, paste the **Setup token** from `infra/vps/secrets/setup_token`.
4. Tick **I understand that only I can recover this workspace, and that wallet keys are backed up separately.**, then select **Create owner**.

Both secrets need at least 12 characters. The vault passphrase can't recover ZEC, and the 24 words can't open your records, so keep each one somewhere safe. [Keys, vault and sessions](/docs/security) explains why there are three.

## Sign in and unlock

After the first time, you open Setrya in two steps.

1. At **Sign in**, enter your **Email** and **Password**. **Keep me signed in on this device for 7 days** extends the session from 12 hours.
2. At **Unlock workspace**, enter your **Vault passphrase**. Until you do, your records stay encrypted and payment jobs wait.

The workspace locks itself after 15 minutes without activity. You can change that in **Settings**, then **Security and backups**, from 1 to 240 minutes.

## Walk through setup

Creating the owner opens **Set up your settlement workspace**. Six steps take you from an empty install to a period you can review. Each one saves as you go, so you can leave and come back. Every step after the first can be skipped.

1. **Workspace**: name the organisation and the first project. A project groups fee sources, partner agreements, settlement periods and payer wallet settings.
2. **Revenue source**: where your fees come from. Every import and agreement is tied to a source. See [Projects and revenue sources](/docs/projects-and-sources).
3. **First partner**: someone you share revenue with. Their payout address can wait, but nothing is paid to them until it passes the shielded address check. See [Partners and payout addresses](/docs/partners).
4. **First agreement**: the terms that turn eligible fees into an amount owed. See [Agreements](/docs/agreements).
5. **Wallet status**: read-only checks against the wallet service. See [Wallet and funding](/docs/wallet).
6. **First import**: upload the fee statement you actually received, map its columns and review each row before you commit it. See [Import revenue](/docs/import-revenue).

**Setup summary** then shows what's done. A green check only appears for something Setrya verified. Until the wallet step passes, Setrya works for imports, calculations and review, and every send control stays locked.

## Fund the payer wallet

Payments come from the payer account the signer created. **Wallet status** shows its health checklist and, once the wallet is reachable, a QR code of its shielded receiving address under **Fund the payer account**.

Send ZEC to that address from a wallet that can pay an Orchard receiver. Since the NU6.3 upgrade, money sent to an Orchard receiver lands in the Ironwood pool, which is the pool Setrya pays from. The funds can be spent once they're as deep as the project's **Minimum input confirmations**, 1 block by default.

On testnet you'd normally use a faucet. On 28 October 2026 the public testnet faucets we checked weren't paying: one refuses every address type and another is paused for the NU7 upgrade. Until one works again, ask someone on testnet to send you a little TAZ, testnet's ZEC.

| What **Wallet status** says | What it means | What to do |
| --- | --- | --- |
| No wallet connection is configured | The API has no wallet settings | Check `ZALLET_RPC_URL` and `ZEBRA_RPC_URL` in `api.env` |
| Connection settings are invalid | A wallet setting failed its check, for example a public address | Fix the setting the message names |
| This balance cannot pay under FullPrivacy | Your funds are transparent or in a pool Setrya doesn't pay from | Send shielded funds to the Orchard receiver address |

## Close a first period

With fees imported, a partner with a checked address, an agreement and a funded wallet, you can settle.

1. Create a period for the dates you're paying and calculate it. See [Periods and exceptions](/docs/periods).
2. Enter and approve a conversion rate to ZEC. See [Conversion rates](/docs/rates).
3. Resolve the exceptions, freeze the snapshot and approve it with your password.
4. Prepare the payment, read the wallet's inspection, authorise it, and wait for confirmations. See [Approve and pay](/docs/approve-and-pay).
5. Issue each partner's statement. See [Statements and sharing](/docs/statements).

Before you rely on it, download an encrypted backup from **Settings**, then **Security and backups**, and read [Backups and recovery](/docs/recovery).
