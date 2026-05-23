# Anti-pattern catalog

Walk through the test code and flag the following. Categorize each finding by priority (Critical / High / Medium / Low). If a priority bucket is empty, omit it from the report — don't pad.

## Table of contents

- [Critical](#critical) — almost certainly causes problems
- [High](#high) — strong code smell
- [Medium](#medium) — worth fixing but not urgent
- [Low](#low) — nice-to-have / cosmetic
- [Context-aware priority bumps](#context-aware-priority-bumps)

---

## Critical

### 1. `waitUntil: 'networkidle'`

- **Why:** many real sites have background polling (analytics, websockets, telemetry) that prevents networkidle from ever firing → timeout. Also some requests don't affect functional readiness, so waiting for them wastes time.
- **Fix:** wait for a concrete element instead. `await expect(page.getByRole('...')).toBeVisible()` after the navigation.

### 2. Missing `await` on a Playwright async call

- **Why:** floating promise — the test continues past the line, and ordering becomes nondeterministic. Classic root cause of "passes locally, flaky on CI".
- **Fix:** add `await`. Recommend wiring up ESLint with `@typescript-eslint/no-floating-promises` so it gets caught automatically.

### 3. `page.waitForTimeout(N)` with a hardcoded number

- **Why:** sleeping for a fixed time is the textbook flaky pattern. Either too short (flaky on slow CI) or too long (slow suite). Playwright has built-in auto-waiting; this disables it.
- **Fix:** wait for the actual condition — `await expect(...).toBeVisible()`, `await page.waitForLoadState('load')`, or wait for a network response with `page.waitForResponse(...)`.

---

## High

### 4. `beforeAll` / `afterAll` with shared mutable state

- **Why:** Playwright runs tests in parallel worker processes. `beforeAll` runs **once per worker**, not once globally. Any shared variable initialized in `beforeAll` is duplicated per worker, and order between workers is undefined.
- **Fix:** move to `beforeEach` (cheap thanks to browser contexts), or use worker-scoped fixtures, or — better — make each test self-contained.

### 5. Nested `describe` blocks

- **Why:** visual indentation grows, readability drops fast, and hooks defined in outer describes apply to inner tests in non-obvious ways. The "test as living documentation" pattern they were designed for is dead in practice.
- **Fix:** split into separate files. Each file is implicitly its own group.

### 6. `toContainText(...)` where exact match is intended

- **Why:** substring match. `"$100"` passes `toContainText("$1")`. Especially dangerous for prices, balances, currencies, IDs — all over iGaming and fintech.
- **Fix:** `toHaveText(exact)` for exact equality. Reserve `toContainText` for genuinely partial matches and add a comment why.

### 7. Unchecked `response.status()` after `page.goto()`

- **Why:** `goto()` resolves with a 4xx/5xx and does NOT throw. A test that "navigates" to a 500 page and then asserts the page title might still pass on a generic title.
- **Fix:** `const response = await page.goto(url); expect(response.status()).toBe(200);` — at least for navigation to protected/critical pages.

### 8. `click({ force: true })` without justification

- **Why:** `force: true` disables actionability checks (element visible, stable, attached, receiving events). It's a sledgehammer that masks real bugs — buttons that "click" in tests but users can't interact with.
- **Fix:** figure out why the element isn't actionable. Usually it's a covering overlay, animation, or wrong locator. If `force` truly is needed (e.g., scroll-into-view edge case), add a code comment with the reason.

### 9. `toContainText` on a plain string (not a Locator)

- **Why:** `toContainText` is a Locator matcher. Calling `expect('some string').toContainText(...)` is either a type error or silently always passes — depending on setup.
- **Fix:** for plain strings use `toContain` (Jest-style) or `toMatch`/`toEqual`.

---

## Medium

### 10. Locators by raw CSS / XPath when a `getBy*` exists

- **Why:** `getByRole`, `getByLabel`, `getByText`, `getByTestId` are resilient to DOM changes and reflect user intent. `page.locator('div.container > button:nth-child(2)')` breaks on refactor.
- **Priority order:** `getByRole` → `getByLabel` → `getByPlaceholder` → `getByText` → `getByTestId` → CSS as last resort.
- **Fix:** swap to the highest-priority one available. If only CSS works because the app lacks accessibility, flag it as accessibility-debt too.

### 11. `toBeChecked` on non-native checkboxes

- **Why:** works only with `<input type="checkbox">`. Most modern UI uses styled divs with `role="checkbox"` or `aria-checked`. The assertion silently behaves wrong on those.
- **Fix:** `toHaveAttribute('aria-checked', 'true')` or `toBeEnabled()` depending on what you actually mean.

### 12. `page.goto(url)` with `timeout: 0` not overridden

- **Why:** default 0 means "wait the full test timeout" — often 60s. Not infinite, but big. Can mask a hang.
- **Fix:** set `navigationTimeout` explicitly in `playwright.config.ts` (10–30s typical), or pass `timeout` to the specific `goto`.

### 13. Hardcoded URLs instead of `baseURL`

- **Why:** breaks environment switching, leaks prod URLs into the suite, and complicates running the same tests against staging/local.
- **Fix:** set `baseURL` in `playwright.config.ts` and use relative paths in `page.goto('/path')`.

### 14. Hardcoded test data that collides on rerun

- **Why:** fixed email like `newuser@test.com` works the first time, fails the second (already exists). Looks flaky, but it's deterministic and a data-cleanup problem.
- **Fix:** generate a unique value per run — `\`user-\${Date.now()}@test.com\`` — or use a fixture that creates and cleans up the user.

---

## Low

### 15. `.spec.ts` vs `.test.ts` inconsistency

- Cosmetic but: pick one convention across the project. The "spec" naming dates back to a defunct "tests as specification" idea.

### 16. Comments explaining `await`

- If you see `// await is needed here because async` — that's noise. Remove.

### 17. Captured response that's never asserted on

- `const response = await page.goto(...)` followed by no `response.status()` check is a misleading lint signal. Either drop the variable or check the status.

---

## Context-aware priority bumps

When the user mentions any of: **money, balances, transactions, KYC, iGaming, fintech, payments, wallets**, raise the priority of these findings by one level (Medium → High, High → Critical):

- `toContainText` on numeric values (rule 6) — substring match on `"950"` can match `"9509"`.
- Unchecked `response.status()` (rule 7) — silent 5xx on a wallet page can keep tests green while real users see a broken balance.
- Hardcoded URLs (rule 13) — accidentally pointing staging tests at prod with real money is a Sev-1 incident.

State the bump explicitly in the report so the reader knows you weighted it.
