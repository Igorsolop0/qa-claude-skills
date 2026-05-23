import { test, expect } from '@playwright/test';

test('new user can sign up', async ({ page }) => {
  const response = await page.goto('https://example.com/signup');

  await page.locator('input[name="email"]').fill('newuser@test.com');
  await page.locator('input[name="password"]').fill('Password123!');
  await page.locator('input[name="confirmPassword"]').fill('Password123!');

  await page.locator('div.terms-checkbox-container > div.inner').click({ force: true });

  await page.locator('button[type="submit"]').click({ force: true });

  await page.waitForTimeout(5000);

  const welcome = page.locator('div.app > div.main > section:nth-child(2) > h1');
  await expect(welcome).toBeVisible();
  expect(welcome).toContainText('Welcome');
});
