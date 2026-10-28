// Drives first-owner setup and onboarding against a running dev server. Usage: node journey-setup.mjs <setupToken>
import { chromium } from 'playwright';

const BASE = process.env.SETRYA_BASE ?? 'http://localhost:3217';
const token = process.argv[2];
const shots = new URL('./shots/', import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.setDefaultTimeout(90_000);
page.setDefaultNavigationTimeout(90_000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const shot = async (name) => page.screenshot({ path: `${shots}${name}.png`, fullPage: true });

await page.goto(`${BASE}/sign-in`);
await page.waitForURL(/setup-owner/);
await shot('01-setup-owner');
await page.getByLabel('Display name').fill('Ada Operator');
await page.getByLabel('Email').fill('owner@example.test');
await page.getByLabel('Sign-in password', { exact: true }).fill('Correct-Horse-42!x');
await page.getByLabel('Confirm password').fill('Correct-Horse-42!x');
await page.getByLabel('Vault passphrase', { exact: true }).fill('vault Passphrase 9 is long');
await page.getByLabel('Confirm vault passphrase').fill('vault Passphrase 9 is long');
await page.getByLabel('Setup token').fill(token);
await page.getByLabel(/I understand that only I can recover/).check();
await page.getByRole('button', { name: 'Create owner' }).click();
await page.waitForURL(/onboarding/, { timeout: 30000 });
await shot('02-onboarding-hub');

await page.getByRole('link', { name: 'Continue setup' }).click();
await page.waitForURL(/onboarding\/workspace/);
await page.getByLabel('Organisation display name').fill('Northwind Labs');
await page.getByLabel('Project or brand name').fill('Project Alpha');
await page.getByLabel('Issuer label on statements').fill('Northwind Labs Ltd');
await shot('03-workspace');
await page.getByRole('button', { name: 'Create workspace' }).click();
await page.waitForURL(/onboarding\/source/);
await page.getByLabel('Source name').fill('Creator fees');
await page.getByLabel('Platform label').fill('Launchpad dashboard');
await shot('04-source');
await page.getByRole('button', { name: 'Save source' }).click();
await page.waitForURL(/onboarding\/partner/);
await shot('05-partner');
console.log(JSON.stringify({ ok: true, url: page.url(), errors }, null, 2));
await browser.close();
