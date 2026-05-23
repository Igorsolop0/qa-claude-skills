import { test, expect } from '@playwright/test';

let authToken: string;

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('https://example.com/login', { waitUntil: 'networkidle' });
  await page.locator('#email').fill('user@example.com');
  await page.locator('#password').fill('hunter2');
  page.locator('button.submit-btn').click();
  await page.waitForTimeout(3000);
  authToken = await page.evaluate(() => localStorage.getItem('auth_token') ?? '');
});

test.describe('Login flow', () => {
  test.describe('happy path', () => {
    test('user can login with valid credentials', async ({ page }) => {
      await page.goto('https://example.com/dashboard', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await expect(page.locator('.welcome-banner')).toContainText('Welcome');
    });

    test('token is present after login', async ({ page }) => {
      expect(authToken).toContainText('eyJ');
    });
  });
});
