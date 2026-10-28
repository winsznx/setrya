// Visits key screens at phone width and fails on horizontal overflow. Run after the journeys.
import { chromium } from 'playwright';

const BASE = process.env.SETRYA_BASE ?? 'http://localhost:3218';
const shots = new URL('./shots/', import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
page.setDefaultTimeout(60_000);
await page.goto(`${BASE}/sign-in`);
await page.getByLabel('Email').fill('owner@example.test');
await page.getByLabel('Password').fill('Correct-Horse-42!x');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(/unlock/);
await page.getByLabel('Vault passphrase').fill('vault Passphrase 9 is long');
await page.getByRole('button', { name: 'Unlock workspace' }).click();
await page.waitForURL(/\/app\/p\//);
const root = page.url().match(/(.*\/app\/p\/[0-9a-f-]+)/)[1];
const periodId = await page.evaluate(async (r) => (await (await fetch(`${r.replace('/app/p/', '/api/v1/projects/')}/periods`)).json()).data[0]?.id, root);
const paths = ['', '/revenue', '/partners', '/agreements', '/periods', `/periods/${periodId}`, `/periods/${periodId}/exceptions`, `/periods/${periodId}/send`, '/payments', '/statements', '/wallet', '/settings/security'];
let failures = 0;
for (const p of paths) {
  await page.goto(`${root}${p}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const name = `m-${p.replace(/[^a-z]+/g, '-') || 'overview'}`;
  await page.screenshot({ path: `${shots}${name}.png`, fullPage: true });
  console.log(overflow > 1 ? 'OVERFLOW' : 'ok      ', `${overflow}px`, p || '/');
  if (overflow > 1) failures += 1;
}
await browser.close();
process.exit(failures ? 1 : 0);
