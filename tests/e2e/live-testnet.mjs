// A real end-to-end settlement on Zcash testnet against a deployed Setrya: onboarding, partners with real unified
// addresses, agreements, a fee import with one exception, an approved rate, freeze and approval, then a real
// prepare, authorise, broadcast and chain confirmation, a statement and the partner's own view.
//
// Required env: SETRYA_BASE, OWNER_EMAIL, OWNER_PASSWORD, VAULT_PASSPHRASE, PARTNER_A_UA, PARTNER_B_UA.
// Optional: RATE_USD_PER_ZEC (default 2000, which keeps the two payouts near 0.17 TAZ), RECORD_DIR (records video),
// SLOW_MO (ms between actions, for footage).
import { chromium } from 'playwright';

const env = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`${name} is not set`);
  return value;
};
const BASE = env('SETRYA_BASE');
const OWNER = { email: env('OWNER_EMAIL'), password: env('OWNER_PASSWORD'), vault: env('VAULT_PASSPHRASE') };
const PARTNERS = [
  { name: 'Promoter Ana', rate: '20', address: env('PARTNER_A_UA') },
  { name: 'Creator Bo', rate: '10', address: env('PARTNER_B_UA') },
];
const RATE = env('RATE_USD_PER_ZEC', '2000');
const csv = new URL('../fixtures/sample-fees.csv', import.meta.url).pathname;
const shots = new URL('./shots/live-', import.meta.url).pathname;

const browser = await chromium.launch({ slowMo: Number(process.env.SLOW_MO ?? 0) });
const record = process.env.RECORD_DIR ? { recordVideo: { dir: process.env.RECORD_DIR, size: { width: 1440, height: 900 } } } : {};
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...record });
const page = await context.newPage();
page.setDefaultTimeout(120_000);
page.setDefaultNavigationTimeout(120_000);
const shot = (name, p = page) => p.screenshot({ path: `${shots}${name}.png`, fullPage: true });
const step = async (name, fn) => {
  const started = Date.now();
  try {
    await fn();
    console.log(`ok   ${name} (${Math.round((Date.now() - started) / 1000)}s)`);
  } catch (error) {
    console.log(`FAIL ${name}: ${error.message.split('\n')[0]}`);
    await shot(`fail-${name}`);
    await context.close();
    await browser.close();
    process.exit(1);
  }
};

await step('sign-in', async () => {
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/unlock/);
  await page.getByLabel('Vault passphrase').fill(OWNER.vault);
  await page.getByRole('button', { name: 'Unlock workspace' }).click();
  await page.waitForURL(/\/(app\/p\/|onboarding)/);
});

await step('workspace', async () => {
  if (page.url().includes('/app/p/')) return;
  await page.goto(`${BASE}/onboarding/workspace`);
  await page.getByLabel('Organisation display name').fill('Setrya Demo Studio');
  await page.getByLabel('Project or brand name').fill('Testnet launch');
  await page.getByLabel('Issuer label on statements').fill('Setrya Demo Studio');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await page.waitForURL(/onboarding\/source/);
  await page.getByLabel('Source name').fill('Creator fees');
  await page.getByLabel('Platform label').fill('Launchpad dashboard');
  await page.getByRole('button', { name: 'Save source' }).click();
  await page.waitForURL(/onboarding\/partner/);
  await page.goto(`${BASE}/app`);
  await page.waitForURL(/\/app\/p\//);
});
const projectUrl = page.url().match(/(.*\/app\/p\/[0-9a-f-]+)/)[1];

for (const partner of PARTNERS) {
  await step(`partner ${partner.name}`, async () => {
    await page.goto(`${projectUrl}/partners/new`);
    await page.getByLabel('Display name').fill(partner.name);
    await page.getByLabel('Zcash unified address').fill(partner.address);
    await page.getByText('Shielded capable').waitFor({ timeout: 20_000 });
    await page.getByLabel(/I confirmed this address/).check();
    await page.getByRole('button', { name: 'Save partner', exact: true }).click();
    await page.waitForURL(/partners\/[0-9a-f-]{36}$/);
  });
}

for (const partner of PARTNERS) {
  await step(`agreement ${partner.name}`, async () => {
    await page.goto(`${projectUrl}/agreements/new`);
    await page.getByLabel('Partner', { exact: true }).selectOption({ label: partner.name });
    await page.getByLabel('Agreement label').fill(`${partner.name} revenue share`);
    await page.getByLabel('Effective from').fill('2026-09-01');
    await page.getByLabel('Rate').fill(partner.rate);
    await page.getByLabel(/Terms will be snapshotted/).check();
    await page.getByRole('button', { name: 'Activate', exact: true }).click();
    await page.waitForURL(/agreements\/[0-9a-f-]{36}$/);
  });
}

await step('import', async () => {
  await page.goto(`${projectUrl}/revenue/import`);
  await page.locator('input[type=file]').setInputFiles(csv);
  await page.getByText('SHA-256').waitFor();
  await page.getByRole('button', { name: 'Preview mapping' }).click();
  await page.getByRole('button', { name: 'Continue to classify' }).click();
  await page.getByText('Review commit', { exact: false }).waitFor();
  const refund = page.locator('li', { hasText: '#3' });
  await refund.getByLabel('Decision').selectOption('eligible');
  await refund.getByPlaceholder('Why this decision').fill('Refund nets against the same period fees');
  await page.getByRole('button', { name: 'Review commit' }).click();
  await page.getByLabel(/I reviewed these rows/).check();
  await page.getByRole('button', { name: 'Commit import' }).click();
  await page.waitForURL(/revenue\/import\/[0-9a-f-]{36}/);
});

await step('period', async () => {
  await page.goto(`${projectUrl}/periods/new?start=2026-10-01&end=2026-10-31`);
  await page.getByLabel('Period name').fill('October creator fees');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Enter a quote' }).click();
  await page.getByLabel('Rate value X').fill(RATE);
  await page.getByLabel('Quote source').fill('Testnet demo rate, not a market price');
  await page.getByLabel(/I approve this rate/).check();
  await page.getByRole('button', { name: 'Save approved rate' }).click();
  await page.getByRole('button', { name: 'Save approved rate' }).waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.querySelector('select')?.value !== '', null, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Create draft period' }).click();
  await page.waitForURL(/periods\/[0-9a-f-]{36}$/);
  await shot('period');
});
const periodUrl = page.url();

await step('exception', async () => {
  await page.getByRole('link', { name: /Review exceptions/ }).click();
  await page.waitForURL(/exceptions/);
  await page.getByLabel('Exclude with reason').check();
  await page.getByText('Preview before saving').waitFor();
  await page.getByLabel('Reason', { exact: true }).fill('Row is trading volume, not fees earned');
  await page.getByRole('button', { name: 'Save decision' }).click();
  await page.getByText('0 blocking').waitFor({ timeout: 30_000 });
});

await step('freeze and approve', async () => {
  await page.goto(periodUrl);
  await page.getByRole('button', { name: 'Freeze for approval' }).click();
  await page.getByRole('button', { name: 'Freeze snapshot' }).click();
  await page.waitForURL(/review$/, { timeout: 60_000 });
  await page.getByText('Wallet is on testnet').waitFor();
  await shot('review');
  await page.getByLabel(/I confirm/).check();
  await page.getByLabel('Confirm with your password').fill(OWNER.password);
  await page.getByRole('button', { name: /approve 2 payments/i }).click();
  await page.waitForURL(/approved=1/, { timeout: 60_000 });
});

await step('prepare and inspect', async () => {
  await page.goto(`${periodUrl}/send`);
  await page.getByRole('button', { name: 'Prepare transaction' }).click();
  await page.getByText(/Wallet inspection of the prepared transaction|Diagnosis/).first().waitFor({ timeout: 180_000 });
  await shot('inspected');
  if (await page.getByText(/Diagnosis/).count()) throw new Error('The wallet inspection blocked this transaction; see live-inspected.png');
});

await step('authorise and broadcast', async () => {
  await page.getByLabel('Confirm with your password').fill(OWNER.password);
  await page.getByRole('button', { name: /Authorise .* ZEC transaction/ }).click();
  await page.getByText(/txid/).first().waitFor({ timeout: 600_000 });
  await shot('broadcast');
});

await step('confirmations', async () => {
  const deadline = Date.now() + 20 * 60_000;
  while (Date.now() < deadline) {
    if (await page.getByText('Confirmed on chain', { exact: false }).count()) break;
    await page.waitForTimeout(15_000);
    await page.getByRole('button', { name: 'Refresh from node' }).click().catch(() => undefined);
  }
  await page.getByText('Confirmed on chain', { exact: false }).first().waitFor({ timeout: 5_000 });
  await shot('confirmed');
  const txid = (await page.locator('code').filter({ hasText: /^[0-9a-f]{8,}/ }).first().innerText().catch(() => '')).trim();
  console.log(`txid ${txid}`);
});

await step('statement and partner view', async () => {
  await page.goto(`${projectUrl}/statements`);
  await page.locator('table a').first().click();
  await page.waitForURL(/statements\/[0-9a-f-]{36}$/);
  await page.getByText('Confirmed on chain', { exact: true }).first().waitFor();
  await shot('statement');
  await page.getByLabel(/I understand links can be forwarded/).check();
  await page.getByRole('button', { name: 'Create encrypted link' }).click();
  const link = await page.locator('code', { hasText: '/r/' }).innerText();
  const partner = await context.newPage();
  await partner.setViewportSize({ width: 390, height: 844 });
  await partner.goto(link);
  await partner.getByText('A private statement was shared with you').waitFor({ timeout: 30_000 });
  await shot('partner-view', partner);
  const html = await partner.content();
  if (PARTNERS.every((p) => html.includes(p.name))) throw new Error('The partner view shows another partner');
});

await context.close();
await browser.close();
