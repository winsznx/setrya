// Approve → prepare → inspect → authorise → broadcast → confirm → statement → encrypted share → recipient view.
// Runs against a dev server wired to tests/integration/stub-rpc (TEST HARNESS, NOT ZCASH). Requires journey-settlement first.
import { chromium } from 'playwright';

const BASE = process.env.SETRYA_BASE ?? 'http://localhost:3218';
const STUB = 'http://127.0.0.1:18990';
const shots = new URL('./shots/', import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.setDefaultTimeout(90_000);
page.setDefaultNavigationTimeout(90_000);
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
const shot = (n, p = page) => p.screenshot({ path: `${shots}${n}.png`, fullPage: true });
const step = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); await shot(`fail-${name}`); throw e; } };
const control = (path, body) => fetch(`${STUB}/_control/${path}`, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((r) => r.json());
const PASSWORD = 'Correct-Horse-42!x';

await control('fault', { fault: process.env.FAULT ?? 'none' });
await step('sign-in', async () => {
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel('Email').fill('owner@example.test');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/unlock/);
  await page.getByLabel('Vault passphrase').fill('vault Passphrase 9 is long');
  await page.getByRole('button', { name: 'Unlock workspace' }).click();
  await page.waitForURL(/\/app\/p\//, { timeout: 30000 });
});
const projectUrl = page.url().match(/(.*\/app\/p\/[0-9a-f-]+)/)[1];

await step('approve', async () => {
  await page.goto(`${projectUrl}/periods`);
  await page.getByRole('link', { name: 'October creator fees' }).first().click();
  await page.waitForURL(/periods\/[0-9a-f-]{36}$/);
  const periodUrl = page.url();
  await page.goto(`${periodUrl}/review`);
  await page.getByText('Wallet is on testnet').waitFor();
  if (await page.getByText(/Changed since freezing/).count()) {
    await shot('29-review-stale');
    await page.getByRole('button', { name: 'Change something' }).click();
    await page.getByLabel('Reason', { exact: true }).fill('Payer account configured after the first freeze');
    await page.getByRole('button', { name: 'Start revision' }).click();
    await page.getByRole('button', { name: 'Freeze for approval' }).waitFor({ timeout: 30000 });
    await page.goto(periodUrl);
    await page.getByRole('button', { name: 'Freeze for approval' }).click();
    await page.getByRole('button', { name: 'Freeze snapshot' }).click();
    await page.waitForURL(/review$/, { timeout: 30000 });
  }
  await shot('30-review-ready');
  await page.getByLabel(/I confirm 6.9/).check();
  await page.getByLabel('Confirm with your password').fill(PASSWORD);
  await page.getByRole('button', { name: /Freeze and approve 2 payments/ }).click();
  await page.waitForURL(/approved=1/, { timeout: 30000 });
  await shot('31-approved');
});
const periodUrl = page.url().split('?')[0];

await step('prepare', async () => {
  await page.goto(`${periodUrl}/send`);
  await page.getByRole('button', { name: 'Prepare transaction' }).click();
  await page.getByText(process.env.FAULT === 'mismatch' || process.env.FAULT === 'transparent' ? /Diagnosis/ : 'Wallet inspection of the prepared transaction').first().waitFor({ timeout: 30000 });
  await shot('32-inspected');
});

if (process.env.FAULT === 'mismatch' || process.env.FAULT === 'transparent') {
  await step('blocked', async () => {
    await page.getByText(/Diagnosis/).waitFor({ timeout: 10000 });
    await shot(`33-blocked-${process.env.FAULT}`);
  });
} else {
  await step('authorise', async () => {
    await page.getByLabel('Confirm with your password').fill(PASSWORD);
    await page.getByRole('button', { name: /Authorise .* ZEC transaction/ }).click();
    await page.getByText(/txid/).first().waitFor({ timeout: 60000 });
    await shot('34-broadcast');
  });
  await step('confirm', async () => {
    await control('mine', { n: 3 });
    await page.getByRole('button', { name: 'Refresh from node' }).click().catch(() => {});
    await page.getByText('Confirmed on chain', { exact: false }).first().waitFor({ timeout: 60000 });
    await shot('35-confirmed');
  });
  await step('statement', async () => {
    await page.goto(`${projectUrl}/statements`);
    await page.locator('table a').first().click();
    await page.waitForURL(/statements\/[0-9a-f-]{36}$/);
    await page.getByText('Confirmed on chain', { exact: true }).first().waitFor();
    await shot('36-statement');
    await page.getByLabel(/I understand links can be forwarded/).check();
    await page.getByRole('button', { name: 'Create encrypted link' }).click();
    const link = await page.locator('code', { hasText: '/r/' }).innerText();
    const recipient = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await recipient.goto(link);
    await recipient.getByText('A private statement was shared with you').waitFor({ timeout: 20000 });
    await recipient.getByRole('heading', { name: 'Verify this payout' }).waitFor();
    await recipient.getByText('All checks passed').waitFor();
    const memo = await recipient.locator('code', { hasText: 'setrya:v1 ref=' }).first().innerText();
    await recipient.getByLabel('Paste the memo your wallet shows to compare').fill(memo);
    await recipient.getByText('Your wallet’s memo matches').waitFor();
    await shot('37-recipient-mobile', recipient);
    const html = await recipient.content();
    if (/Partner [AB]/.test(html) && html.includes('Partner A') && html.includes('Partner B')) throw new Error('Recipient view exposes another partner');
    const fresh = async (url) => { const p = await browser.newPage(); await p.goto(url); return p; };
    const tampered = await fresh(link.replace(/#k=(.)/, (_m, c) => `#k=${c === 'A' ? 'B' : 'A'}`));
    await tampered.getByText('The key cannot open this statement').waitFor();
    const keyless = await fresh(link.split('#')[0]);
    await keyless.getByText('The key is missing from this link').waitFor();
    await recipient.reload();
    await recipient.getByRole('link', { name: 'Acknowledge receipt' }).click();
    await recipient.getByLabel(/I confirm that I checked the payment/).check();
    await recipient.getByRole('button', { name: 'Send acknowledgment' }).click();
    await recipient.getByText('Acknowledgment sent').waitFor();
    await shot('38-ack', recipient);
  });
}
console.log(JSON.stringify({ errors }, null, 2));
await browser.close();
