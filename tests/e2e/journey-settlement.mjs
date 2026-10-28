// Drives sign-in, onboarding and a full period up to approval against a running dev server, using SAMPLE fixtures.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

import { makeUa } from '../fixtures/make-test-ua.mjs';

const BASE = process.env.SETRYA_BASE ?? 'http://localhost:3217';
const shots = new URL('./shots/', import.meta.url).pathname;
const csv = new URL('../fixtures/sample-fees.csv', import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.setDefaultTimeout(90_000);
page.setDefaultNavigationTimeout(90_000);
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('caret-color') && errors.push(`console: ${m.text().slice(0, 300)}`));
const shot = (n) => page.screenshot({ path: `${shots}${n}.png`, fullPage: true });
const step = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); await shot(`fail-${name}`); throw e; } };

await step('sign-in', async () => {
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel('Email').fill('owner@example.test');
  await page.getByLabel('Password').fill('Correct-Horse-42!x');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/unlock/);
  await page.getByLabel('Vault passphrase').fill('vault Passphrase 9 is long');
  await page.getByRole('button', { name: 'Unlock workspace' }).click();
  await page.waitForURL(/\/app\/p\//, { timeout: 30000 });
});
const projectUrl = page.url().match(/(.*\/app\/p\/[0-9a-f-]+)/)[1];

for (const [name, ua] of [['Partner A', makeUa('utest')], ['Partner B', makeUa('utest')]]) {
  await step(`partner ${name}`, async () => {
    await page.goto(`${projectUrl}/partners/new`);
    await page.getByLabel('Display name').fill(name);
    await page.getByLabel('Zcash unified address').fill(ua);
    await page.getByText('Shielded capable').waitFor({ timeout: 15000 });
    await page.getByLabel(/I confirmed this address/).check();
    await page.getByRole('button', { name: 'Save partner', exact: true }).click();
    await page.waitForURL(/partners\/[0-9a-f-]{36}$/);
  });
}
await shot('10-partner-profile');

for (const [partner, rate] of [['Partner A', '20'], ['Partner B', '10']]) {
  await step(`agreement ${partner}`, async () => {
    await page.goto(`${projectUrl}/agreements/new`);
    await page.getByLabel('Partner', { exact: true }).selectOption({ label: partner });
    await page.getByLabel('Agreement label').fill(`${partner} creator share`);
    await page.getByLabel('Effective from').fill('2026-09-01');
    await page.getByLabel('Rate').fill(rate);
    await page.getByLabel(/Terms will be snapshotted/).check();
    if (partner === 'Partner A') await shot('11-agreement-builder');
    await page.getByRole('button', { name: 'Activate', exact: true }).click();
    await page.waitForURL(/agreements\/[0-9a-f-]{36}$/);
  });
}

await step('import', async () => {
  await page.goto(`${projectUrl}/revenue/import`);
  await page.locator('input[type=file]').setInputFiles(csv);
  await page.getByText('SHA-256').waitFor();
  await page.getByRole('button', { name: 'Preview mapping' }).click();
  await shot('12-import-mapping');
  await page.getByRole('button', { name: 'Continue to classify' }).click();
  await page.getByText('Review commit', { exact: false }).waitFor();
  await shot('13-import-classify');
  const refund = page.locator('li', { hasText: '#3' });
  await refund.getByLabel('Decision').selectOption('eligible');
  await refund.getByPlaceholder('Why this decision').fill('Refund nets against the same period fees');
  await page.getByRole('button', { name: 'Review commit' }).click();
  await page.getByLabel(/I reviewed these rows/).check();
  await shot('14-import-commit');
  await page.getByRole('button', { name: 'Commit import' }).click();
  await page.waitForURL(/revenue\/import\/[0-9a-f-]{36}/);
  await shot('15-import-detail');
});

await step('period', async () => {
  if (process.env.SKIP_TO_PERIOD) return;
  await page.goto(`${projectUrl}/periods/new?start=2026-10-01&end=2026-10-31`);
  await page.getByLabel('Period name').fill('October creator fees');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Enter a quote' }).click();
  await page.getByLabel('Rate value X').fill('50');
  await page.getByLabel('Quote source').fill('SAMPLE test quote, not a market price');
  await page.getByLabel(/I approve this rate/).check();
  await page.getByRole('button', { name: 'Save approved rate' }).click();
  await page.getByRole('button', { name: 'Save approved rate' }).waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.querySelector('select')?.value !== '', null, { timeout: 15000 });
  await page.getByRole('button', { name: 'Continue' }).click();
  await shot('16-period-calculate');
  await page.getByRole('button', { name: 'Create draft period' }).click();
  await page.waitForURL(/periods\/[0-9a-f-]{36}$/);
  await shot('17-period-workspace');
});

await step('exceptions', async () => {
  await page.getByRole('link', { name: /Review exceptions/ }).click();
  await page.waitForURL(/exceptions/);
  await shot('18-exception-inbox');
  await page.getByLabel('Exclude with reason').check();
  await page.getByText('Preview before saving').waitFor();
  await page.getByLabel('Reason', { exact: true }).fill('Row is trading volume, not fees earned');
  await shot('19-exception-preview');
  await page.getByRole('button', { name: 'Save decision' }).click();
  await page.getByText('0 blocking').waitFor({ timeout: 20000 });
});

await step('freeze', async () => {
  await page.goto(page.url().replace('/exceptions', ''));
  await page.getByRole('button', { name: 'Freeze for approval' }).click();
  await page.getByRole('button', { name: 'Freeze snapshot' }).click();
  await page.waitForURL(/review$/, { timeout: 30000 });
  await shot('20-review');
});

console.log(JSON.stringify({ errors }, null, 2));
await browser.close();
