import { test, expect } from '@playwright/test';

test('user can checkout a single item', async ({ page }) => {
  const response = await page.goto('/products/123');
  expect(response?.status()).toBe(200);

  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('status', { name: 'Cart updated' })).toBeVisible();

  await page.getByRole('link', { name: 'Cart' }).click();
  await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible();

  await page.getByRole('button', { name: 'Checkout' }).click();
  await page.getByLabel('Email').fill('buyer@example.com');
  await page.getByLabel('Card number').fill('4242 4242 4242 4242');

  await page.getByRole('button', { name: 'Place order' }).click();

  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
  await expect(page.getByText('Order #')).toBeVisible();
});
