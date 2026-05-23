import { test, expect } from '@playwright/test';

let initialBalance: number;

test.beforeAll(async () => {
  initialBalance = 1000;
});

test('user can place a bet and balance decreases', async ({ page }) => {
  await page.goto('https://casino.example.com/wallet');

  const balanceEl = page.locator('div.wallet-widget > span.balance-value');
  await expect(balanceEl).toContainText('1,000');

  await page.locator('button.bet-50').click({ force: true });

  await page.waitForTimeout(1500);

  await expect(balanceEl).toContainText('950');
  expect(initialBalance - 50).toBe(950);
});

test('jackpot pool is visible', async ({ page }) => {
  await page.goto('https://casino.example.com/jackpot', { waitUntil: 'networkidle' });
  const pool = page.locator('.jackpot-pool-amount');
  await expect(pool).toContainText('$');
});
