// Prints what is really on a page for a visitor: roles and names, and test ids.
// Usage: node scripts/page-snapshot.mjs '<path>'   (for example '#/register' or '/login')
import { chromium } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const [target = ''] = process.argv.slice(2);
const base = (process.env.WEB_URL || process.env.BASE_URL || '').replace(/\/*$/, '/');
if (base === '/') {
  console.error('Missing in .env: BASE_URL (and WEB_URL when the web app has another address).');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(15_000);
const response = await page.goto(new URL(target.replace(/^\//, ''), base).toString());
// A look, not a test: let the page render, but do not hang on apps that never go quiet.
await page.waitForLoadState('load');
await page.locator('body *').first().waitFor().catch(() => {});

console.log(`URL: ${page.url()}  (status ${response?.status() ?? 'same document'})\nTitle: ${await page.title()}\n`);
console.log(await page.locator('body').ariaSnapshot());

const testIds = await page.locator('[data-testid]').evaluateAll((elements) =>
  elements
    .filter((element) => element.checkVisibility())
    .map((element) => `${element.getAttribute('data-testid')}  <${element.tagName.toLowerCase()}>`),
);
console.log(`\nTest ids (${testIds.length}):\n${testIds.join('\n')}`);

await browser.close();
