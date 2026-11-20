# Spec template

```typescript
// tests/<slug>/<slug>.spec.ts
import { test, expect } from '@playwright/test';
// Or, if the project has a custom fixture:
// import { test, expect } from '../fixtures/<name>.fixture';

import { <Flow>Page } from './<slug>.page';
import { minimumPreset, fullPreset } from './<slug>.presets';

test.describe('<flow human name>', () => {
  test('happy path — <one-line scenario>', async ({ page }) => {
    const flow = new <Flow>Page(page);
    await flow.goto(process.env.APP_URL ?? 'http://localhost:3000');

    // SETUP_REQUIRED: login / wallet connect / API seed — replace with project's setup helper
    // e.g. await login(page, testUser); or await wallet.connect();

    await expect(flow.submitButton).toBeDisabled();

    await flow.fillFromPreset(minimumPreset);

    await expect(flow.submitButton).toBeEnabled();
    await flow.submit();

    // SETUP_REQUIRED: external confirmation (wallet sign / OTP / payment redirect)
    // e.g. await wallet.confirmTransaction();

    await expect(flow.successHeading).toBeVisible();
    await expect(page).toHaveURL(/\/<success-path>/);
  });

  test('validation — submit disabled until required fields are filled', async ({ page }) => {
    const flow = new <Flow>Page(page);
    await flow.goto(process.env.APP_URL ?? 'http://localhost:3000');

    await expect(flow.submitButton).toBeDisabled();
    await flow.titleInput.fill('only title');
    await expect(flow.submitButton).toBeDisabled();
  });

  // Add one test per gap / negative scenario from the user's notes
});
```

## SETUP_REQUIRED placeholder rules

When the flow needs auth / wallet / API seeding that the skill can't generate honestly, emit a clearly marked comment instead of fake code:

```typescript
// SETUP_REQUIRED: <one-line description of what needs to happen here>
// <optional: hint at the helper the user probably wants — e.g. "see tests/fixtures/auth.ts">
```

Never emit:

- `localStorage.setItem('token', 'fake-jwt')` — breaks in real CI
- Hardcoded session cookies — same
- Mock service worker / network mocking without checking the project uses MSW
- Wallet stubs — Web3 projects have specific tooling (Synpress, MetaMask Test Dapp, etc.) and need real fixtures

A clear placeholder is honest. Fake code creates a debugging session three weeks later.

## Web-first assertion rules

✅ Use:
- `expect(locator).toBeVisible()`
- `expect(locator).toHaveText(...)` with string or exact regex
- `expect(locator).toBeEnabled()` / `.toBeDisabled()`
- `expect(page).toHaveURL(...)`
- `expect(locator).toHaveCount(n)` for list assertions

❌ Avoid:
- `page.waitForTimeout(...)` — hardcoded sleeps are flaky and slow
- `page.waitForLoadState('networkidle')` for non-navigation waits — networkidle is unreliable on SPAs with background polling
- `expect(locator).toContainText('1')` on numeric strings — false-positive (`"10"` contains `"1"`). Use `toHaveText` or anchored regex `/^1$/`
- `force: true` on `.click()` — hides real visibility/overlap bugs
- `test.skip(...)` to hide setup gaps — use `test.fixme()` with a comment explaining what's missing
- Manual `await page.waitForSelector(...)` — Playwright assertions auto-wait

## Describe block structure

One `test.describe` per flow. Inside, group by scenario type if there are many:

```typescript
test.describe('<flow>', () => {
  test.describe('happy path', () => { /* ... */ });
  test.describe('validation', () => { /* ... */ });
  test.describe('gap coverage', () => { /* ... */ });
});
```

Nested describes are fine when they map to clear scenario buckets. Don't nest just to group two tests.

## What does NOT go in the spec

- Raw selectors — always through the Page Object
- Hardcoded baseUrl — use `process.env.APP_URL` or the project's config object
- Setup logic that the project's fixture should own (auth, browser context options, storage state)
- Helper functions that aren't used by other tests — inline them or move to the Page Object as an action
