import type { Metadata } from 'next';

import { PageIntro, Prose } from '@/components/marketing/prose';

export const metadata: Metadata = { title: 'Getting started' };

export default function GettingStarted() {
  return (
    <>
      <PageIntro title="Getting started">From a fresh server to a first reviewed period. Read each warning; this software moves real money.</PageIntro>
      <Prose>
        <p><strong>Start on testnet.</strong> The signer builds on pre-release Zcash libraries, and Zallet is beta software. Use limited, consenting amounts on mainnet.</p>
        <h2>1. Requirements</h2>
        <ul><li>A Linux settlement host (x86_64 or aarch64) for the API, PostgreSQL 16 and the wallet service. Docker Compose files for it are in <code>infra/vps</code>.</li><li>A host for the web app, such as Vercel, or the same server.</li><li>Node.js 22.12 or newer and pnpm 10 to build from source.</li></ul>
        <h2>2. Install Setrya</h2>
        <pre>{`cd infra/vps
PUBLIC_ORIGIN=https://your-app.example API_HOSTS="api.your-app.example 203.0.113.7" ./bootstrap.sh
docker compose build
docker compose up -d`}</pre>
        <p><code>bootstrap.sh</code> creates the host master key, database password, setup token, the key the web app uses to reach the API, and a TLS certificate for the API. It never overwrites an existing secret. Back up the master key apart from the database. Give the web app <code>SETRYA_API_URL</code>, <code>SETRYA_EDGE_KEY</code> and the certificate as <code>SETRYA_API_CA</code>.</p>
        <h2>3. Create the owner</h2>
        <p>Open <code>/setup-owner</code>, enter the setup token, your password, and a separate vault passphrase. The page stops working once an owner exists. Workspace recovery and Zcash spending-key recovery are different things: losing the vault passphrase without a backup loses your records, and has nothing to do with your ZEC.</p>
        <h2 id="wallet">4. Create the payer wallet</h2>
        <p>The settlement host runs the Setrya signer, a light-client Zcash wallet built on the Zcash Rust libraries. It knows the Ironwood pool and NU7. It holds the spending keys, syncs from a lightwalletd server, builds FullPrivacy transactions, signs them and broadcasts them. Create its wallet once:</p>
        <pre>{`docker compose run --rm --no-deps --entrypoint setrya-signer signer init --network test --data-dir /data`}</pre>
        <p>It prints 24 words once. Write them down offline. They are the only way to recover the ZEC, and Setrya backups never contain them. It also prints the account UUID and an address with only an Orchard receiver. Put the UUID in <code>SETRYA_PAYER_ACCOUNT_UUID</code> in <code>api.env</code> and restart.</p>
        <p>The signer learns about the chain from a lightwalletd server, <code>testnet.zec.rocks</code> by default. That server sees your host’s IP address, when you connect, and the raw transaction when you broadcast. It does not learn amounts, recipients or which notes are yours, because decryption happens on your host. It could withhold or misreport chain data, which your own full node would rule out. Routing through Tor with a SOCKS5 proxy hides the IP address.</p>
        <p>Open Wallet status. Every check should pass: wallet and chain connection reachable and in sync, network matches, account exists, and a shielded balance in one pool.</p>
        <h3>Alternative: Zallet and Zebra</h3>
        <p>Setrya can also use Zallet with a Zebra node on the same Linux machine, through the same settings (<code>ZALLET_RPC_URL</code>, <code>ZEBRA_RPC_URL</code> and their cookie files). The released Zallet v0.1.0-beta.3 cannot follow testnet past the NU7 upgrade (zcash/zallet#887), so use it only once a release supports NU7.</p>
        <h2>5. Fund the payer account</h2>
        <p>On testnet, request funds from a testnet faucet such as <a href="https://faucet.testnet.valargroup.dev" rel="noreferrer">faucet.testnet.valargroup.dev</a>, using the Orchard-only address from the Wallet page. Since NU6.3, an Orchard receiver delivers into the Ironwood pool, which is where Setrya pays from. Funds become spendable after 10 confirmations.</p>
        <p>Transparent funds cannot pay under FullPrivacy. Funds still in the old Orchard pool must be migrated to Ironwood first, and that migration reveals the amount on-chain (ZIP 318), so do it deliberately and separately.</p>
        <h2>6. Source, partner, agreement</h2>
        <p>Add a revenue source and say what its amount column means. Add a partner with a unified address that has an Orchard receiver, and confirm it with them through a separate channel. Create an agreement.</p>
        <h2>7. A safe first payment</h2>
        <p>Import a real fee file, create a period, resolve exceptions, freeze and approve. Prepare the transaction and read the wallet inspection before you authorise it. Start with a small amount on testnet and watch it reach the confirmation threshold.</p>
        <h2>8. Issue the statement</h2>
        <p>Open the partner’s statement, print it or share an encrypted link. Then close the period, choosing what happens to any unpaid rows.</p>
      </Prose>
    </>
  );
}
